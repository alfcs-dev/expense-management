import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import { idSchema } from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const monthYearSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  return user.id;
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
    .input(
      monthYearSchema.extend({
        name: z.string().trim().min(1).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      const existing = await db.budget.findUnique({
        where: {
          userId_month_year: {
            userId,
            month: input.month,
            year: input.year,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Budget already exists for this month",
        });
      }

      return db.budget.create({
        data: {
          userId,
          month: input.month,
          year: input.year,
          name: input.name?.trim() || `${input.year}-${String(input.month).padStart(2, "0")}`,
        },
      });
    }),

  listByYear: protectedProcedure
    .input(z.object({ year: z.number().int().min(2000).max(2100) }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      return db.budget.findMany({
        where: {
          userId,
          year: input.year,
        },
        orderBy: [{ month: "asc" }],
      });
    }),

  getOrCreateForMonth: protectedProcedure
    .input(monthYearSchema)
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      return db.budget.upsert({
        where: {
          userId_month_year: {
            userId,
            month: input.month,
            year: input.year,
          },
        },
        update: {},
        create: {
          userId,
          month: input.month,
          year: input.year,
          name: `${input.year}-${String(input.month).padStart(2, "0")}`,
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
          month: true,
          year: true,
        },
      });

      if (!budget) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Budget not found" });
      }

      const templates = await db.recurringExpense.findMany({
        where: {
          userId,
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
        const current = plannedByCategory.get(template.categoryId) ?? {
          categoryId: template.categoryId,
          categoryName: template.category.name,
          templateCount: 0,
          planned: { MXN: 0, USD: 0 },
        };

        current.templateCount += 1;
        current.planned[template.currency] += monthlyPlanned;
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
        categories,
        totals,
      };
    }),
});
