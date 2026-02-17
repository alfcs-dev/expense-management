import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import { currencySchema, idSchema } from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const expenseInputSchema = z.object({
  budgetId: idSchema.optional(),
  categoryId: idSchema,
  accountId: idSchema,
  description: z.string().trim().min(1).max(200),
  amount: z.number().int().positive(),
  currency: currencySchema,
  amountInBudgetCurrency: z.number().int().positive().optional(),
  date: z.coerce.date(),
});

const MXN_PER_USD = 17.5;

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  return user.id;
}

function estimateAmountInBudgetCurrency(input: {
  amount: number;
  currency: "MXN" | "USD";
  budgetCurrency: "MXN" | "USD";
}): number {
  if (input.currency === input.budgetCurrency) {
    return input.amount;
  }

  if (input.currency === "USD" && input.budgetCurrency === "MXN") {
    return Math.round(input.amount * MXN_PER_USD);
  }

  return Math.round(input.amount / MXN_PER_USD);
}

async function resolveBudgetForExpense(
  userId: string,
  date: Date,
  providedBudgetId?: string,
): Promise<{ id: string; currency: "MXN" | "USD" }> {
  if (providedBudgetId) {
    const direct = await db.budget.findFirst({
      where: {
        id: providedBudgetId,
        userId,
      },
      select: {
        id: true,
        currency: true,
      },
    });

    if (!direct) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Budget not found for current user",
      });
    }

    return direct;
  }

  const inRange = await db.budget.findFirst({
    where: {
      userId,
      startDate: { lte: date },
      endDate: { gte: date },
    },
    orderBy: [{ isDefault: "desc" }, { startDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      currency: true,
    },
  });

  if (inRange) {
    return inRange;
  }

  const fallback = await db.budget.findFirst({
    where: {
      userId,
      isDefault: true,
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      currency: true,
    },
  });

  if (!fallback) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No budget found. Create a budget before adding expenses.",
    });
  }

  return fallback;
}

async function assertOwnedReferences(
  userId: string,
  input: { categoryId: string; accountId: string },
): Promise<void> {
  const [categoryCount, accountCount] = await Promise.all([
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

function buildConversionData(input: {
  amount: number;
  currency: "MXN" | "USD";
  amountInBudgetCurrency?: number;
  budgetCurrency: "MXN" | "USD";
}): { amountInBudgetCurrency: number; conversionStatus: "estimated" | "confirmed" } {
  if (input.currency === input.budgetCurrency) {
    return {
      amountInBudgetCurrency: input.amount,
      conversionStatus: "confirmed",
    };
  }

  if (input.amountInBudgetCurrency) {
    return {
      amountInBudgetCurrency: input.amountInBudgetCurrency,
      conversionStatus: "confirmed",
    };
  }

  return {
    amountInBudgetCurrency: estimateAmountInBudgetCurrency({
      amount: input.amount,
      currency: input.currency,
      budgetCurrency: input.budgetCurrency,
    }),
    conversionStatus: "estimated",
  };
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
              name: true,
              startDate: true,
              endDate: true,
              currency: true,
              budgetLimit: true,
              isDefault: true,
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

  create: protectedProcedure
    .input(expenseInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      await assertOwnedReferences(userId, input);
      const budget = await resolveBudgetForExpense(userId, input.date, input.budgetId);

      const conversionData = buildConversionData({
        amount: input.amount,
        currency: input.currency,
        amountInBudgetCurrency: input.amountInBudgetCurrency,
        budgetCurrency: budget.currency,
      });

      return db.expense.create({
        data: {
          userId,
          budgetId: budget.id,
          categoryId: input.categoryId,
          accountId: input.accountId,
          description: input.description.trim(),
          amount: input.amount,
          currency: input.currency,
          amountInBudgetCurrency: conversionData.amountInBudgetCurrency,
          conversionStatus: conversionData.conversionStatus,
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
      const budget = await resolveBudgetForExpense(
        userId,
        input.data.date,
        input.data.budgetId,
      );

      const conversionData = buildConversionData({
        amount: input.data.amount,
        currency: input.data.currency,
        amountInBudgetCurrency: input.data.amountInBudgetCurrency,
        budgetCurrency: budget.currency,
      });

      const updated = await db.expense.updateMany({
        where: {
          id: input.id,
          userId,
        },
        data: {
          budgetId: budget.id,
          categoryId: input.data.categoryId,
          accountId: input.data.accountId,
          description: input.data.description.trim(),
          amount: input.data.amount,
          currency: input.data.currency,
          amountInBudgetCurrency: conversionData.amountInBudgetCurrency,
          conversionStatus: conversionData.conversionStatus,
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

  delete: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
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
