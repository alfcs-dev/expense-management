import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import { idSchema } from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return user.id;
}

async function assertOwnedCreditAccount(userId: string, accountId: string) {
  const account = await db.account.findFirst({
    where: { id: accountId, userId, type: "credit" },
    select: { id: true, currency: true },
  });
  if (!account) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Credit account not found for current user",
    });
  }
  return account;
}

export const creditCardStatementRouter = router({
  list: protectedProcedure
    .input(z.object({ accountId: idSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      return db.creditCardStatement.findMany({
        where: {
          accountId: input?.accountId,
          account: { userId },
        },
        include: {
          account: { select: { id: true, name: true, currency: true } },
          _count: { select: { expenses: true, statementPayments: true } },
        },
        orderBy: [{ closingDate: "desc" }, { createdAt: "desc" }],
      });
    }),

  close: protectedProcedure
    .input(
      z.object({
        accountId: idSchema,
        periodStart: z.coerce.date(),
        periodEnd: z.coerce.date(),
        closingDate: z.coerce.date(),
        dueDate: z.coerce.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      await assertOwnedCreditAccount(userId, input.accountId);
      if (input.periodEnd < input.periodStart) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Statement period end date must be after start date",
        });
      }

      const existing = await db.creditCardStatement.findUnique({
        where: {
          accountId_periodStart_periodEnd: {
            accountId: input.accountId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
          },
        },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Statement already exists for the selected period",
        });
      }

      const inPeriodExpenses = await db.expense.findMany({
        where: {
          userId,
          accountId: input.accountId,
          date: {
            gte: input.periodStart,
            lte: input.periodEnd,
          },
        },
        select: { id: true, amount: true, statementId: true },
      });

      const statementBalance = inPeriodExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
      );

      const statement = await db.creditCardStatement.create({
        data: {
          accountId: input.accountId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          closingDate: input.closingDate,
          dueDate: input.dueDate,
          statementBalance,
          status: "closed",
          closedAt: new Date(),
        },
      });

      const assignableExpenseIds = inPeriodExpenses
        .filter((expense) => !expense.statementId)
        .map((expense) => expense.id);

      if (assignableExpenseIds.length) {
        await db.expense.updateMany({
          where: { id: { in: assignableExpenseIds } },
          data: { statementId: statement.id },
        });
      }

      return db.creditCardStatement.findUniqueOrThrow({
        where: { id: statement.id },
        include: {
          account: { select: { id: true, name: true, currency: true } },
          _count: { select: { expenses: true, statementPayments: true } },
        },
      });
    }),

  recordPayment: protectedProcedure
    .input(
      z.object({
        statementId: idSchema,
        fromAccountId: idSchema,
        amountApplied: z.number().int().positive(),
        date: z.coerce.date(),
        notes: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const statement = await db.creditCardStatement.findFirst({
        where: {
          id: input.statementId,
          account: { userId },
        },
        include: {
          account: {
            select: {
              id: true,
              currency: true,
            },
          },
        },
      });
      if (!statement) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Statement not found for current user",
        });
      }

      const fromAccount = await db.account.findFirst({
        where: { id: input.fromAccountId, userId },
        select: { id: true },
      });
      if (!fromAccount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Source account not found for current user",
        });
      }

      await db.$transaction(async (tx) => {
        const transfer = await tx.transfer.create({
          data: {
            userId,
            sourceAccountId: input.fromAccountId,
            destAccountId: statement.account.id,
            amount: input.amountApplied,
            currency: statement.account.currency,
            date: input.date,
            notes: input.notes?.trim() || null,
          },
        });

        await tx.statementPayment.create({
          data: {
            statementId: statement.id,
            transferId: transfer.id,
            amountApplied: input.amountApplied,
          },
        });

        const paymentsApplied = statement.paymentsApplied + input.amountApplied;
        const isPaid = paymentsApplied >= statement.statementBalance;
        await tx.creditCardStatement.update({
          where: { id: statement.id },
          data: {
            paymentsApplied,
            status: isPaid ? "paid" : "partial",
            paidAt: isPaid ? new Date() : null,
          },
        });
      });

      return db.creditCardStatement.findUniqueOrThrow({
        where: { id: statement.id },
        include: {
          account: { select: { id: true, name: true, currency: true } },
          statementPayments: {
            include: {
              transfer: {
                select: {
                  id: true,
                  amount: true,
                  date: true,
                  notes: true,
                  sourceAccount: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }),
});
