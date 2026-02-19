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

const transactionInputSchema = z.object({
  accountId: idSchema,
  categoryId: idSchema,
  description: z.string().trim().min(1).max(200),
  amount: z.number().int(),
  date: z.coerce.date(),
  projectId: idSchema.optional(),
  statementId: idSchema.optional(),
  installmentId: idSchema.optional(),
  reimbursable: z.boolean().optional(),
  reimbursed: z.boolean().optional(),
  notes: z.string().trim().max(400).optional(),
});

async function assertOwnedRefs(
  userId: string,
  input: {
    accountId: string;
    categoryId: string;
    projectId?: string;
    statementId?: string;
    installmentId?: string;
  },
): Promise<void> {
  const [account, category] = await Promise.all([
    db.account.findFirst({
      where: { id: input.accountId, userId },
      select: { id: true },
    }),
    db.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { id: true },
    }),
  ]);

  if (!account) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Account not found" });
  }
  if (!category) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Category not found" });
  }

  if (input.projectId) {
    const project = await db.project.findFirst({
      where: { id: input.projectId, userId },
      select: { id: true },
    });
    if (!project)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Project not found" });
  }

  if (input.statementId) {
    const statement = await db.creditCardStatement.findFirst({
      where: { id: input.statementId, userId },
      select: { id: true },
    });
    if (!statement) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Statement not found" });
    }
  }

  if (input.installmentId) {
    const installment = await db.installment.findFirst({
      where: { id: input.installmentId, userId },
      select: { id: true },
    });
    if (!installment) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Installment not found" });
    }
  }
}

export const transactionRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          accountId: idSchema.optional(),
          categoryId: idSchema.optional(),
          statementId: idSchema.optional(),
          fromDate: z.coerce.date().optional(),
          toDate: z.coerce.date().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      return db.transaction.findMany({
        where: {
          userId,
          accountId: input?.accountId,
          categoryId: input?.categoryId,
          statementId: input?.statementId,
          date:
            input?.fromDate || input?.toDate
              ? {
                  gte: input?.fromDate,
                  lte: input?.toDate,
                }
              : undefined,
        },
        include: {
          account: { select: { id: true, name: true, currency: true } },
          category: { select: { id: true, name: true, kind: true } },
          project: { select: { id: true, name: true } },
          statement: {
            select: { id: true, closingDate: true, dueDate: true, status: true },
          },
          installment: {
            select: { id: true, installmentNumber: true, dueDate: true },
          },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      });
    }),

  create: protectedProcedure
    .input(transactionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      await assertOwnedRefs(userId, input);

      return db.transaction.create({
        data: {
          userId,
          accountId: input.accountId,
          categoryId: input.categoryId,
          description: input.description,
          amount: input.amount,
          date: input.date,
          projectId: input.projectId,
          statementId: input.statementId,
          installmentId: input.installmentId,
          reimbursable: input.reimbursable ?? false,
          reimbursed: input.reimbursed ?? false,
          notes: input.notes ?? null,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: idSchema,
        data: transactionInputSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      const existing = await db.transaction.findFirst({
        where: { id: input.id, userId },
        select: {
          id: true,
          accountId: true,
          categoryId: true,
          projectId: true,
          statementId: true,
          installmentId: true,
        },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      await assertOwnedRefs(userId, {
        accountId: input.data.accountId ?? existing.accountId,
        categoryId: input.data.categoryId ?? existing.categoryId,
        projectId: input.data.projectId ?? existing.projectId ?? undefined,
        statementId: input.data.statementId ?? existing.statementId ?? undefined,
        installmentId: input.data.installmentId ?? existing.installmentId ?? undefined,
      });

      await db.transaction.updateMany({
        where: { id: input.id, userId },
        data: {
          accountId: input.data.accountId,
          categoryId: input.data.categoryId,
          description: input.data.description,
          amount: input.data.amount,
          date: input.data.date,
          projectId: input.data.projectId,
          statementId: input.data.statementId,
          installmentId: input.data.installmentId,
          reimbursable: input.data.reimbursable,
          reimbursed: input.data.reimbursed,
          notes: input.data.notes,
        },
      });

      return db.transaction.findUniqueOrThrow({ where: { id: input.id } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const deleted = await db.transaction.deleteMany({
        where: { id: input.id, userId },
      });
      if (deleted.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }
      return { success: true };
    }),
});

// Temporary alias to avoid breaking existing consumers immediately.
export const expenseRouter = transactionRouter;
