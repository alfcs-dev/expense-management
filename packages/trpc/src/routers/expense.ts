import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import { currencySchema, idSchema } from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const expenseInputSchema = z.object({
  budgetId: idSchema,
  categoryId: idSchema,
  accountId: idSchema,
  description: z.string().trim().min(1).max(200),
  amount: z.number().int().positive(),
  currency: currencySchema,
  date: z.coerce.date(),
});

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  return user.id;
}

async function assertOwnedReferences(
  userId: string,
  input: z.infer<typeof expenseInputSchema>,
): Promise<void> {
  const [budgetCount, categoryCount, accountCount] = await Promise.all([
    db.budget.count({
      where: {
        id: input.budgetId,
        userId,
      },
    }),
    db.category.count({
      where: {
        id: input.categoryId,
        userId,
      },
    }),
    db.account.count({
      where: {
        id: input.accountId,
        userId,
      },
    }),
  ]);

  if (budgetCount === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Budget not found for current user",
    });
  }

  if (categoryCount === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Category not found for current user",
    });
  }

  if (accountCount === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Account not found for current user",
    });
  }
}

export const expenseRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          budgetId: idSchema.optional(),
          categoryId: idSchema.optional(),
          fromDate: z.coerce.date().optional(),
          toDate: z.coerce.date().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      return db.expense.findMany({
        where: {
          userId,
          budgetId: input?.budgetId,
          categoryId: input?.categoryId,
          date:
            input?.fromDate || input?.toDate
              ? {
                  gte: input?.fromDate,
                  lte: input?.toDate,
                }
              : undefined,
        },
        include: {
          budget: {
            select: {
              id: true,
              month: true,
              year: true,
              name: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          account: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      });
    }),

  create: protectedProcedure.input(expenseInputSchema).mutation(async ({ ctx, input }) => {
    const userId = requireUserId(ctx.user);

    await assertOwnedReferences(userId, input);

    return db.expense.create({
      data: {
        userId,
        budgetId: input.budgetId,
        categoryId: input.categoryId,
        accountId: input.accountId,
        description: input.description.trim(),
        amount: input.amount,
        currency: input.currency,
        date: input.date,
        source: "manual",
      },
    });
  }),

  update: protectedProcedure
    .input(
      z.object({
        id: idSchema,
        data: expenseInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      await assertOwnedReferences(userId, input.data);

      const updated = await db.expense.updateMany({
        where: {
          id: input.id,
          userId,
        },
        data: {
          budgetId: input.data.budgetId,
          categoryId: input.data.categoryId,
          accountId: input.data.accountId,
          description: input.data.description.trim(),
          amount: input.data.amount,
          currency: input.data.currency,
          date: input.data.date,
          source: "manual",
        },
      });

      if (updated.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
      }

      return db.expense.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  delete: protectedProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    const userId = requireUserId(ctx.user);

    const deleted = await db.expense.deleteMany({
      where: {
        id: input.id,
        userId,
      },
    });

    if (deleted.count === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
    }

    return { success: true };
  }),
});
