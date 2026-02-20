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

const budgetInputSchema = z.object({
  budgetPeriodId: idSchema,
  categoryId: idSchema,
  plannedAmount: z.number().int().min(0),
  generatedFromRuleId: idSchema.optional(),
  isOverride: z.boolean().optional(),
});

export const budgetRouter = router({
  list: protectedProcedure
    .input(z.object({ budgetPeriodId: idSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      return db.budget.findMany({
        where: {
          userId,
          budgetPeriodId: input?.budgetPeriodId,
        },
        include: {
          budgetPeriod: {
            select: { id: true, month: true, currency: true, expectedIncomeAmount: true },
          },
          category: { select: { id: true, name: true, kind: true } },
          generatedFromRule: { select: { id: true, name: true, ruleType: true } },
        },
        orderBy: [
          { budgetPeriod: { month: "desc" } },
          { plannedAmount: "desc" },
          { createdAt: "asc" },
        ],
      });
    }),

  create: protectedProcedure.input(budgetInputSchema).mutation(async ({ ctx, input }) => {
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

    if (input.generatedFromRuleId) {
      const rule = await db.budgetRule.findFirst({
        where: { id: input.generatedFromRuleId, userId },
        select: { id: true },
      });
      if (!rule) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Budget rule not found for current user",
        });
      }
    }

    return db.budget.create({
      data: {
        userId,
        budgetPeriodId: input.budgetPeriodId,
        categoryId: input.categoryId,
        plannedAmount: input.plannedAmount,
        generatedFromRuleId: input.generatedFromRuleId,
        isOverride: input.isOverride ?? false,
      },
    });
  }),

  update: protectedProcedure
    .input(
      z.object({
        id: idSchema,
        data: budgetInputSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      if (input.data.budgetPeriodId) {
        const period = await db.budgetPeriod.findFirst({
          where: { id: input.data.budgetPeriodId, userId },
          select: { id: true },
        });
        if (!period) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Budget period not found for current user",
          });
        }
      }

      if (input.data.categoryId) {
        const category = await db.category.findFirst({
          where: { id: input.data.categoryId, userId },
          select: { id: true },
        });
        if (!category) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Category not found for current user",
          });
        }
      }

      if (input.data.generatedFromRuleId) {
        const rule = await db.budgetRule.findFirst({
          where: { id: input.data.generatedFromRuleId, userId },
          select: { id: true },
        });
        if (!rule) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Budget rule not found for current user",
          });
        }
      }

      const updated = await db.budget.updateMany({
        where: { id: input.id, userId },
        data: {
          budgetPeriodId: input.data.budgetPeriodId,
          categoryId: input.data.categoryId,
          plannedAmount: input.data.plannedAmount,
          generatedFromRuleId: input.data.generatedFromRuleId,
          isOverride: input.data.isOverride,
        },
      });
      if (updated.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Budget not found" });
      }

      return db.budget.findUniqueOrThrow({ where: { id: input.id } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const deleted = await db.budget.deleteMany({
        where: { id: input.id, userId },
      });
      if (deleted.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Budget not found" });
      }
      return { success: true };
    }),

  getPlannedByCategory: protectedProcedure
    .input(z.object({ budgetPeriodId: idSchema }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      const period = await db.budgetPeriod.findFirst({
        where: { id: input.budgetPeriodId, userId },
        select: {
          id: true,
          month: true,
          currency: true,
          expectedIncomeAmount: true,
        },
      });
      if (!period) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Budget period not found",
        });
      }

      const budgets = await db.budget.findMany({
        where: { userId, budgetPeriodId: period.id },
        include: {
          category: { select: { id: true, name: true } },
        },
        orderBy: { plannedAmount: "desc" },
      });

      const categories = budgets.map((item) => ({
        categoryId: item.categoryId,
        categoryName: item.category.name,
        planned: { [period.currency]: item.plannedAmount },
      }));

      const totals = budgets.reduce((acc, item) => acc + item.plannedAmount, 0);

      return {
        budgetPeriod: period,
        categories,
        totals: { [period.currency]: totals },
      };
    }),
});
