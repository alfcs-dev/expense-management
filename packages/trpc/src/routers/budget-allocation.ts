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

function applyBounds(
  value: number,
  bounds: { minAmount: number | null; capAmount: number | null },
): number {
  let next = value;
  if (bounds.minAmount != null) {
    next = Math.max(next, bounds.minAmount);
  }
  if (bounds.capAmount != null) {
    next = Math.min(next, bounds.capAmount);
  }
  return Math.max(0, next);
}

export const budgetAllocationRouter = router({
  list: protectedProcedure
    .input(z.object({ budgetPeriodId: idSchema }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      return db.budgetAllocation.findMany({
        where: {
          userId,
          budgetPeriodId: input.budgetPeriodId,
        },
        include: {
          category: { select: { id: true, name: true } },
          generatedFromRule: { select: { id: true, name: true, ruleType: true } },
        },
        orderBy: [{ plannedAmount: "desc" }, { createdAt: "asc" }],
      });
    }),

  setOverride: protectedProcedure
    .input(
      z.object({
        budgetPeriodId: idSchema,
        categoryId: idSchema,
        plannedAmount: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const period = await db.budgetPeriod.findFirst({
        where: { id: input.budgetPeriodId, userId },
        select: { id: true },
      });
      if (!period) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Budget period not found for current user",
        });
      }

      const category = await db.category.findFirst({
        where: { id: input.categoryId, userId },
        select: { id: true },
      });
      if (!category) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Category not found for current user",
        });
      }

      return db.budgetAllocation.upsert({
        where: {
          budgetPeriodId_categoryId: {
            budgetPeriodId: input.budgetPeriodId,
            categoryId: input.categoryId,
          },
        },
        update: {
          plannedAmount: input.plannedAmount,
          isOverride: true,
          generatedFromRuleId: null,
        },
        create: {
          userId,
          budgetPeriodId: input.budgetPeriodId,
          categoryId: input.categoryId,
          plannedAmount: input.plannedAmount,
          isOverride: true,
          generatedFromRuleId: null,
        },
      });
    }),

  generateForPeriod: protectedProcedure
    .input(z.object({ budgetPeriodId: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const period = await db.budgetPeriod.findFirst({
        where: { id: input.budgetPeriodId, userId },
        include: { incomePlanItems: true },
      });
      if (!period) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Budget period not found for current user",
        });
      }

      const rules = await db.budgetRule.findMany({
        where: {
          userId,
          OR: [{ activeFrom: null }, { activeFrom: { lte: period.month } }],
          AND: [{ OR: [{ activeTo: null }, { activeTo: { gte: period.month } }] }],
        },
        orderBy: [{ applyOrder: "asc" }, { createdAt: "asc" }],
      });

      const incomeFromItems = period.incomePlanItems.reduce(
        (sum, item) => sum + item.amount,
        0,
      );
      const totalIncome =
        period.expectedIncomeAmount > 0 ? period.expectedIncomeAmount : incomeFromItems;
      let remaining = totalIncome;

      const computed = new Map<
        string,
        { plannedAmount: number; generatedFromRuleId: string }
      >();

      for (const rule of rules) {
        let plannedAmount = 0;
        if (rule.ruleType === "fixed") {
          plannedAmount = applyBounds(rule.value, rule);
          remaining -= plannedAmount;
        } else {
          // Percent rules use basis points: 10000 = 100%.
          const percentBase = Math.max(remaining, 0);
          plannedAmount = applyBounds(
            Math.round((percentBase * rule.value) / 10000),
            rule,
          );
          remaining -= plannedAmount;
        }

        computed.set(rule.categoryId, {
          plannedAmount,
          generatedFromRuleId: rule.id,
        });
      }

      const bufferCategory = await db.category.findFirst({
        where: { userId, name: "Buffer" },
        select: { id: true },
      });
      if (bufferCategory && remaining > 0 && !computed.has(bufferCategory.id)) {
        computed.set(bufferCategory.id, {
          plannedAmount: remaining,
          generatedFromRuleId: "",
        });
      }

      await db.$transaction(async (tx) => {
        for (const [categoryId, values] of computed.entries()) {
          const existing = await tx.budgetAllocation.findUnique({
            where: {
              budgetPeriodId_categoryId: {
                budgetPeriodId: period.id,
                categoryId,
              },
            },
            select: { id: true, isOverride: true },
          });

          if (existing?.isOverride) continue;

          await tx.budgetAllocation.upsert({
            where: {
              budgetPeriodId_categoryId: {
                budgetPeriodId: period.id,
                categoryId,
              },
            },
            update: {
              plannedAmount: values.plannedAmount,
              generatedFromRuleId: values.generatedFromRuleId || null,
              isOverride: false,
            },
            create: {
              userId,
              budgetPeriodId: period.id,
              categoryId,
              plannedAmount: values.plannedAmount,
              generatedFromRuleId: values.generatedFromRuleId || null,
              isOverride: false,
            },
          });
        }
      });

      return db.budgetAllocation.findMany({
        where: { userId, budgetPeriodId: period.id },
        include: {
          category: { select: { id: true, name: true } },
          generatedFromRule: { select: { id: true, name: true, ruleType: true } },
        },
        orderBy: [{ plannedAmount: "desc" }, { createdAt: "asc" }],
      });
    }),
});
