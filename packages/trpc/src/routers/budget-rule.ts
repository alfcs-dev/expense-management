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

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const budgetRuleInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  categoryId: idSchema,
  ruleType: z.enum(["fixed", "percent_of_income"]),
  value: z.number().int().min(0),
  applyOrder: z.number().int().min(0).default(0),
  minAmount: z.number().int().min(0).optional(),
  capAmount: z.number().int().min(0).optional(),
  activeFrom: monthSchema.optional(),
  activeTo: monthSchema.optional(),
});

export const budgetRuleRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user);
    return db.budgetRule.findMany({
      where: { userId },
      include: {
        category: { select: { id: true, name: true, kind: true } },
      },
      orderBy: [{ applyOrder: "asc" }, { createdAt: "asc" }],
    });
  }),

  create: protectedProcedure
    .input(budgetRuleInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
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

      return db.budgetRule.create({
        data: {
          userId,
          name: input.name,
          categoryId: input.categoryId,
          ruleType: input.ruleType,
          value: input.value,
          applyOrder: input.applyOrder,
          minAmount: input.minAmount,
          capAmount: input.capAmount,
          activeFrom: input.activeFrom,
          activeTo: input.activeTo,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: idSchema, data: budgetRuleInputSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
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

      const updated = await db.budgetRule.updateMany({
        where: { id: input.id, userId },
        data: {
          name: input.data.name,
          categoryId: input.data.categoryId,
          ruleType: input.data.ruleType,
          value: input.data.value,
          applyOrder: input.data.applyOrder,
          minAmount: input.data.minAmount,
          capAmount: input.data.capAmount,
          activeFrom: input.data.activeFrom,
          activeTo: input.data.activeTo,
        },
      });
      if (updated.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Budget rule not found" });
      }

      return db.budgetRule.findUniqueOrThrow({ where: { id: input.id } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const deleted = await db.budgetRule.deleteMany({
        where: { id: input.id, userId },
      });
      if (deleted.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Budget rule not found" });
      }
      return { success: true };
    }),
});
