import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import { idSchema } from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const createBudgetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  currency: z.enum(["MXN", "USD"]),
  budgetLimit: z.number().int().nonnegative(),
  isDefault: z.boolean().optional(),
});

const setDefaultBudgetSchema = z.object({
  id: idSchema,
});

const resolveForDateSchema = z.object({
  date: z.coerce.date(),
});

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  return user.id;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function assertDateRange(startDate: Date, endDate: Date): void {
  if (startDate > endDate) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Budget startDate must be before or equal to endDate",
    });
  }
}

async function assertNoRangeOverlap(
  userId: string,
  startDate: Date,
  endDate: Date,
  excludeBudgetId?: string,
): Promise<void> {
  const overlapping = await db.budget.findFirst({
    where: {
      userId,
      id: excludeBudgetId ? { not: excludeBudgetId } : undefined,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true, name: true },
  });

  if (overlapping) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Budget range overlaps with existing budget: ${overlapping.name}`,
    });
  }
}

function monthsInclusive(startDate: Date, endDate: Date): number {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);

  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1;

  return Math.max(months, 1);
}

function plannedMonthlyAmountForTemplate(template: {
  amount: number;
  frequency: "monthly" | "biweekly" | "annual" | "bimonthly";
  isAnnual: boolean;
  annualCost: number | null;
}): number {
  if (template.isAnnual || template.frequency === "annual") {
    const annualCost = template.annualCost ?? template.amount;
    return Math.round(annualCost / 12);
  }

  if (template.frequency === "biweekly") {
    return Math.round((template.amount * 26) / 12);
  }

  if (template.frequency === "bimonthly") {
    return Math.round(template.amount / 2);
  }

  return template.amount;
}

export const budgetRouter = router({
  create: protectedProcedure
    .input(createBudgetSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const startDate = startOfDay(input.startDate);
      const endDate = endOfDay(input.endDate);

      assertDateRange(startDate, endDate);
      await assertNoRangeOverlap(userId, startDate, endDate);

      const existingCount = await db.budget.count({ where: { userId } });
      const shouldBeDefault = input.isDefault ?? existingCount === 0;

      return db.$transaction(async (tx) => {
        if (shouldBeDefault) {
          await tx.budget.updateMany({
            where: {
              userId,
              isDefault: true,
            },
            data: {
              isDefault: false,
            },
          });
        }

        return tx.budget.create({
          data: {
            userId,
            name: input.name.trim(),
            startDate,
            endDate,
            currency: input.currency,
            budgetLimit: input.budgetLimit,
            isDefault: shouldBeDefault,
          },
        });
      });
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user);

    return db.budget.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { startDate: "asc" }, { createdAt: "asc" }],
    });
  }),

  getDefault: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user);

    return db.budget.findFirst({
      where: {
        userId,
        isDefault: true,
      },
      orderBy: [{ createdAt: "asc" }],
    });
  }),

  setDefault: protectedProcedure
    .input(setDefaultBudgetSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      const budget = await db.budget.findFirst({
        where: {
          id: input.id,
          userId,
        },
        select: { id: true },
      });

      if (!budget) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Budget not found" });
      }

      return db.$transaction(async (tx) => {
        await tx.budget.updateMany({
          where: {
            userId,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });

        return tx.budget.update({
          where: { id: input.id },
          data: { isDefault: true },
        });
      });
    }),

  resolveForDate: protectedProcedure
    .input(resolveForDateSchema)
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const date = startOfDay(input.date);

      const inRange = await db.budget.findFirst({
        where: {
          userId,
          startDate: { lte: date },
          endDate: { gte: date },
        },
        orderBy: [{ isDefault: "desc" }, { startDate: "asc" }, { createdAt: "asc" }],
      });

      if (inRange) {
        return inRange;
      }

      return db.budget.findFirst({
        where: {
          userId,
          isDefault: true,
        },
      });
    }),

  getPlannedByCategory: protectedProcedure
    .input(z.object({ budgetId: idSchema }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      const budget = await db.budget.findFirst({
        where: {
          id: input.budgetId,
          userId,
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          currency: true,
          budgetLimit: true,
          isDefault: true,
        },
      });

      if (!budget) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Budget not found" });
      }

      const templates = await db.recurringExpense.findMany({
        where: {
          userId,
          budgetId: budget.id,
          isActive: true,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const periodMonthCount = monthsInclusive(budget.startDate, budget.endDate);

      const plannedByCategory = new Map<
        string,
        {
          categoryId: string;
          categoryName: string;
          templateCount: number;
          planned: { MXN: number; USD: number };
        }
      >();

      for (const template of templates) {
        const monthlyPlanned = plannedMonthlyAmountForTemplate(template);
        const periodPlanned = monthlyPlanned * periodMonthCount;

        const current = plannedByCategory.get(template.categoryId) ?? {
          categoryId: template.categoryId,
          categoryName: template.category.name,
          templateCount: 0,
          planned: { MXN: 0, USD: 0 },
        };

        current.templateCount += 1;
        current.planned[template.currency] += periodPlanned;
        plannedByCategory.set(template.categoryId, current);
      }

      const categories = Array.from(plannedByCategory.values()).sort((a, b) =>
        a.categoryName.localeCompare(b.categoryName),
      );

      const totals = categories.reduce(
        (acc, category) => {
          acc.MXN += category.planned.MXN;
          acc.USD += category.planned.USD;
          return acc;
        },
        { MXN: 0, USD: 0 },
      );

      return {
        budget,
        periodMonthCount,
        categories,
        totals,
      };
    }),
});
