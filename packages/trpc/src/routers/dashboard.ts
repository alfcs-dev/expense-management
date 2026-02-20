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

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

function monthRange(month: string): { fromDate: Date; toDate: Date } {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const fromDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const toDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
  return { fromDate, toDate };
}

export const dashboardRouter = router({
  summary: protectedProcedure
    .input(z.object({ month: monthSchema }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const { fromDate, toDate } = monthRange(input.month);

      const [accounts, budgetPeriod, actualByCategory, billsDue, recentTransactions] =
        await Promise.all([
          db.account.findMany({
            where: { userId },
            select: {
              id: true,
              name: true,
              type: true,
              currency: true,
              currentBalance: true,
              isActive: true,
            },
            orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
          }),
          db.budgetPeriod.findFirst({
            where: { userId, month: input.month },
            select: { id: true, month: true, currency: true, expectedIncomeAmount: true },
          }),
          db.transaction.groupBy({
            by: ["categoryId"],
            where: {
              userId,
              date: { gte: fromDate, lte: toDate },
            },
            _sum: { amount: true },
          }),
          db.billOccurrence.findMany({
            where: {
              userId,
              periodMonth: input.month,
              status: { in: ["pending", "overdue"] },
            },
            include: {
              bill: {
                select: {
                  id: true,
                  name: true,
                  dueDay: true,
                  category: { select: { id: true, name: true, kind: true } },
                },
              },
            },
            orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
            take: 20,
          }),
          db.transaction.findMany({
            where: {
              userId,
              date: { gte: fromDate, lte: toDate },
            },
            include: {
              account: { select: { id: true, name: true, currency: true } },
              category: { select: { id: true, name: true, kind: true } },
            },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            take: 20,
          }),
        ]);

      const plannedByCategory = budgetPeriod
        ? await db.budget.findMany({
            where: { userId, budgetPeriodId: budgetPeriod.id },
            include: {
              category: { select: { id: true, name: true, kind: true } },
            },
            orderBy: [{ plannedAmount: "desc" }, { createdAt: "asc" }],
          })
        : [];

      const actualMap = new Map<string, number>();
      for (const item of actualByCategory) {
        actualMap.set(item.categoryId, item._sum.amount ?? 0);
      }

      const budgetVsActual = plannedByCategory.map((budget) => {
        const actualAmount = actualMap.get(budget.categoryId) ?? 0;
        return {
          categoryId: budget.categoryId,
          categoryName: budget.category.name,
          categoryKind: budget.category.kind,
          plannedAmount: budget.plannedAmount,
          actualAmount,
          varianceAmount: budget.plannedAmount - actualAmount,
        };
      });

      return {
        month: input.month,
        accounts,
        budgetPeriod,
        budgetVsActual,
        billsDue,
        recentTransactions,
      };
    }),
});
