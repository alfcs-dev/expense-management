import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import {
  currencySchema,
  idSchema,
  recurringFrequencySchema,
} from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const recurringExpenseInputSchema = z
  .object({
    budgetId: idSchema,
    categoryId: idSchema,
    sourceAccountId: idSchema,
    destAccountId: idSchema.optional(),
    description: z.string().trim().min(1).max(200),
    amount: z.number().int().positive(),
    currency: currencySchema,
    frequency: recurringFrequencySchema,
    isAnnual: z.boolean().optional(),
    annualCost: z.number().int().positive().optional(),
    notes: z.string().trim().max(2000).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.destAccountId && input.destAccountId === input.sourceAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destAccountId"],
        message: "Destination account must be different from source account",
      });
    }

    if (input.isAnnual && !input.annualCost) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["annualCost"],
        message: "Annual cost is required when recurring expense is annual",
      });
    }
  });

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  return user.id;
}

async function assertOwnedBudgetCategoryAndAccounts(
  userId: string,
  input: z.infer<typeof recurringExpenseInputSchema>,
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
        userId,
        id: {
          in: input.destAccountId
            ? [input.sourceAccountId, input.destAccountId]
            : [input.sourceAccountId],
        },
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

  const expectedAccounts = input.destAccountId ? 2 : 1;
  if (accountCount !== expectedAccounts) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Source or destination account not found for current user",
    });
  }
}

function toPersistedData(input: z.infer<typeof recurringExpenseInputSchema>) {
  const isAnnual = input.isAnnual ?? false;

  return {
    budgetId: input.budgetId,
    categoryId: input.categoryId,
    sourceAccountId: input.sourceAccountId,
    destAccountId: input.destAccountId ?? null,
    description: input.description.trim(),
    amount: input.amount,
    currency: input.currency,
    frequency: input.frequency,
    isAnnual,
    annualCost: isAnnual ? (input.annualCost ?? null) : null,
    notes: input.notes?.trim() || null,
    isActive: input.isActive ?? true,
  };
}

export const recurringExpenseRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user);

    return db.recurringExpense.findMany({
      where: { userId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        budget: {
          select: {
            id: true,
            name: true,
            currency: true,
            isDefault: true,
          },
        },
        sourceAccount: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
        destAccount: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });
  }),

  create: protectedProcedure
    .input(recurringExpenseInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      await assertOwnedBudgetCategoryAndAccounts(userId, input);

      return db.recurringExpense.create({
        data: {
          userId,
          ...toPersistedData(input),
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: idSchema,
        data: recurringExpenseInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      await assertOwnedBudgetCategoryAndAccounts(userId, input.data);

      const updated = await db.recurringExpense.updateMany({
        where: {
          id: input.id,
          userId,
        },
        data: toPersistedData(input.data),
      });

      if (updated.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recurring expense not found",
        });
      }

      return db.recurringExpense.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      const deleted = await db.recurringExpense.deleteMany({
        where: {
          id: input.id,
          userId,
        },
      });

      if (deleted.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recurring expense not found",
        });
      }

      return { success: true };
    }),
});
