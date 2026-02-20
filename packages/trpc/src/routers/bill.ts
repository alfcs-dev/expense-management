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

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const billInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  categoryId: idSchema,
  amountType: z.enum(["fixed", "variable"]),
  defaultAmount: z.number().int().min(0).optional(),
  dueDay: z.number().int().min(1).max(31),
  payingAccountId: idSchema.optional(),
  fundingAccountId: idSchema.optional(),
  isActive: z.boolean().default(true),
  notes: z.string().trim().max(400).optional(),
});

function computeDueDateForMonth(month: string, dueDay: number): Date {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const safeDay = Math.min(dueDay, lastDay);
  return new Date(Date.UTC(year, monthIndex, safeDay, 12, 0, 0));
}

async function assertOwnedRefs(
  userId: string,
  input: {
    categoryId?: string;
    payingAccountId?: string;
    fundingAccountId?: string;
  },
): Promise<void> {
  if (input.categoryId) {
    const category = await db.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { id: true },
    });
    if (!category) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Category not found" });
    }
  }

  if (input.payingAccountId) {
    const account = await db.account.findFirst({
      where: { id: input.payingAccountId, userId },
      select: { id: true },
    });
    if (!account) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Paying account not found" });
    }
  }

  if (input.fundingAccountId) {
    const account = await db.account.findFirst({
      where: { id: input.fundingAccountId, userId },
      select: { id: true },
    });
    if (!account) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Funding account not found" });
    }
  }
}

export const billRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user);
    return db.bill.findMany({
      where: { userId },
      include: {
        category: { select: { id: true, name: true, kind: true } },
        payingAccount: { select: { id: true, name: true } },
        fundingAccount: { select: { id: true, name: true } },
      },
      orderBy: [{ isActive: "desc" }, { dueDay: "asc" }, { name: "asc" }],
    });
  }),

  create: protectedProcedure.input(billInputSchema).mutation(async ({ ctx, input }) => {
    const userId = requireUserId(ctx.user);
    await assertOwnedRefs(userId, {
      categoryId: input.categoryId,
      payingAccountId: input.payingAccountId,
      fundingAccountId: input.fundingAccountId,
    });

    return db.bill.create({
      data: {
        userId,
        name: input.name,
        categoryId: input.categoryId,
        amountType: input.amountType,
        defaultAmount: input.defaultAmount,
        dueDay: input.dueDay,
        payingAccountId: input.payingAccountId ?? null,
        fundingAccountId: input.fundingAccountId ?? null,
        isActive: input.isActive,
        notes: input.notes?.trim() || null,
      },
    });
  }),

  update: protectedProcedure
    .input(z.object({ id: idSchema, data: billInputSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const existing = await db.bill.findFirst({
        where: { id: input.id, userId },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }

      await assertOwnedRefs(userId, {
        categoryId: input.data.categoryId,
        payingAccountId: input.data.payingAccountId,
        fundingAccountId: input.data.fundingAccountId,
      });

      await db.bill.updateMany({
        where: { id: input.id, userId },
        data: {
          name: input.data.name,
          categoryId: input.data.categoryId,
          amountType: input.data.amountType,
          defaultAmount: input.data.defaultAmount,
          dueDay: input.data.dueDay,
          payingAccountId: input.data.payingAccountId,
          fundingAccountId: input.data.fundingAccountId,
          isActive: input.data.isActive,
          notes: input.data.notes?.trim() || null,
        },
      });

      return db.bill.findUniqueOrThrow({ where: { id: input.id } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const deleted = await db.bill.deleteMany({ where: { id: input.id, userId } });
      if (deleted.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }
      return { success: true };
    }),

  generateOccurrences: protectedProcedure
    .input(z.object({ month: monthSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const activeBills = await db.bill.findMany({
        where: { userId, isActive: true },
        select: { id: true, dueDay: true, defaultAmount: true },
      });

      await db.$transaction(async (tx) => {
        for (const bill of activeBills) {
          await tx.billOccurrence.upsert({
            where: {
              billId_periodMonth: {
                billId: bill.id,
                periodMonth: input.month,
              },
            },
            update: {
              dueDate: computeDueDateForMonth(input.month, bill.dueDay),
              expectedAmount: bill.defaultAmount ?? 0,
            },
            create: {
              userId,
              billId: bill.id,
              periodMonth: input.month,
              dueDate: computeDueDateForMonth(input.month, bill.dueDay),
              expectedAmount: bill.defaultAmount ?? 0,
            },
          });
        }
      });

      return db.billOccurrence.findMany({
        where: { userId, periodMonth: input.month },
        include: {
          bill: {
            select: {
              id: true,
              name: true,
              dueDay: true,
              amountType: true,
              category: { select: { id: true, name: true, kind: true } },
            },
          },
          transaction: {
            select: {
              id: true,
              description: true,
              amount: true,
              date: true,
              isPaid: true,
            },
          },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      });
    }),

  listOccurrences: protectedProcedure
    .input(z.object({ month: monthSchema }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      return db.billOccurrence.findMany({
        where: { userId, periodMonth: input.month },
        include: {
          bill: {
            select: {
              id: true,
              name: true,
              dueDay: true,
              amountType: true,
              category: { select: { id: true, name: true, kind: true } },
            },
          },
          transaction: {
            select: {
              id: true,
              description: true,
              amount: true,
              date: true,
              isPaid: true,
            },
          },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      });
    }),

  upsertOccurrenceStatus: protectedProcedure
    .input(
      z.object({
        occurrenceId: idSchema,
        status: z.enum(["pending", "paid", "skipped", "overdue"]),
        paidAt: z.coerce.date().optional(),
        transactionId: idSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const occurrence = await db.billOccurrence.findFirst({
        where: { id: input.occurrenceId, userId },
        select: { id: true, transactionId: true },
      });
      if (!occurrence) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill occurrence not found" });
      }

      if (input.transactionId) {
        const transaction = await db.transaction.findFirst({
          where: { id: input.transactionId, userId },
          select: { id: true },
        });
        if (!transaction) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction not found" });
        }
      }

      await db.$transaction(async (tx) => {
        await tx.billOccurrence.update({
          where: { id: input.occurrenceId },
          data: {
            status: input.status,
            paidAt: input.status === "paid" ? (input.paidAt ?? new Date()) : null,
            transactionId: input.transactionId ?? occurrence.transactionId,
          },
        });

        const linkedTransactionId = input.transactionId ?? occurrence.transactionId;
        if (linkedTransactionId) {
          await tx.transaction.update({
            where: { id: linkedTransactionId },
            data: {
              isPaid: input.status === "paid",
              paidAt: input.status === "paid" ? (input.paidAt ?? new Date()) : null,
            },
          });
        }
      });

      return db.billOccurrence.findUniqueOrThrow({ where: { id: input.occurrenceId } });
    }),
});
