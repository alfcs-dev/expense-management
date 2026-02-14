import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  return user.id;
}

function monthStartDate(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
}

function monthEndDate(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59));
}

const monthRangeSchema = z.object({
  fromYear: z.number().int().min(2000).max(2100),
  fromMonth: z.number().int().min(1).max(12),
  toYear: z.number().int().min(2000).max(2100),
  toMonth: z.number().int().min(1).max(12),
});

export const reportRouter = router({
  monthlyTrend: protectedProcedure
    .input(monthRangeSchema)
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const fromDate = monthStartDate(input.fromYear, input.fromMonth);
      const toDate = monthEndDate(input.toYear, input.toMonth);

      const expenses = await db.expense.findMany({
        where: {
          userId,
          date: {
            gte: fromDate,
            lte: toDate,
          },
        },
        include: {
          category: {
            select: {
              name: true,
            },
          },
        },
      });

      const monthly = new Map<
        string,
        {
          year: number;
          month: number;
          totalExpense: { MXN: number; USD: number };
          totalIncome: { MXN: number; USD: number };
        }
      >();

      for (const expense of expenses) {
        const date = new Date(expense.date);
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;
        const key = `${year}-${String(month).padStart(2, "0")}`;
        const row = monthly.get(key) ?? {
          year,
          month,
          totalExpense: { MXN: 0, USD: 0 },
          totalIncome: { MXN: 0, USD: 0 },
        };

        const isIncome = /income|salary|payroll|nomina|n[óo]mina|sueldo/i.test(
          expense.category.name,
        );

        if (isIncome) {
          row.totalIncome[expense.currency] += expense.amount;
        } else {
          row.totalExpense[expense.currency] += expense.amount;
        }
        monthly.set(key, row);
      }

      return Array.from(monthly.values()).sort((a, b) =>
        `${a.year}-${String(a.month).padStart(2, "0")}`.localeCompare(
          `${b.year}-${String(b.month).padStart(2, "0")}`,
        ),
      );
    }),

  annualSummary: protectedProcedure
    .input(z.object({ year: z.number().int().min(2000).max(2100) }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const fromDate = monthStartDate(input.year, 1);
      const toDate = monthEndDate(input.year, 12);

      const expenses = await db.expense.findMany({
        where: {
          userId,
          date: {
            gte: fromDate,
            lte: toDate,
          },
        },
        include: {
          category: {
            select: { name: true },
          },
        },
      });

      const totals = {
        income: { MXN: 0, USD: 0 },
        expense: { MXN: 0, USD: 0 },
      };

      for (const expense of expenses) {
        const isIncome = /income|salary|payroll|nomina|n[óo]mina|sueldo/i.test(
          expense.category.name,
        );
        if (isIncome) {
          totals.income[expense.currency] += expense.amount;
        } else {
          totals.expense[expense.currency] += expense.amount;
        }
      }

      return {
        year: input.year,
        totals,
      };
    }),

  categoryBreakdown: protectedProcedure
    .input(monthRangeSchema)
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const fromDate = monthStartDate(input.fromYear, input.fromMonth);
      const toDate = monthEndDate(input.toYear, input.toMonth);

      const expenses = await db.expense.findMany({
        where: {
          userId,
          date: {
            gte: fromDate,
            lte: toDate,
          },
        },
        include: {
          category: {
            select: { id: true, name: true },
          },
        },
      });

      const byCategory = new Map<
        string,
        {
          categoryId: string;
          categoryName: string;
          total: { MXN: number; USD: number };
        }
      >();

      for (const expense of expenses) {
        const row = byCategory.get(expense.categoryId) ?? {
          categoryId: expense.categoryId,
          categoryName: expense.category.name,
          total: { MXN: 0, USD: 0 },
        };
        row.total[expense.currency] += expense.amount;
        byCategory.set(expense.categoryId, row);
      }

      return Array.from(byCategory.values()).sort(
        (a, b) => b.total.MXN + b.total.USD - (a.total.MXN + a.total.USD),
      );
    }),
});
