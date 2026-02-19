import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import { currencySchema, idSchema } from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return user.id;
}

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const budgetPeriodInputSchema = z.object({
  month: monthSchema,
  currency: currencySchema,
  expectedIncomeAmount: z.number().int().min(0).default(0),
  notes: z.string().trim().max(400).optional(),
});

export const budgetPeriodRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user);
    return db.budgetPeriod.findMany({
      where: { userId },
      orderBy: { month: "desc" },
      include: {
        _count: {
          select: { budgets: true, incomePlanItems: true },
        },
      },
    });
  }),

  getByMonth: protectedProcedure
    .input(z.object({ month: monthSchema }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      return db.budgetPeriod.findFirst({
        where: { userId, month: input.month },
        include: {
          incomePlanItems: true,
          budgets: {
            include: { category: { select: { id: true, name: true, kind: true } } },
            orderBy: { plannedAmount: "desc" },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(budgetPeriodInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      return db.budgetPeriod.create({
        data: {
          userId,
          month: input.month,
          currency: input.currency,
          expectedIncomeAmount: input.expectedIncomeAmount,
          notes: input.notes?.trim() || null,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: idSchema, data: budgetPeriodInputSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const updated = await db.budgetPeriod.updateMany({
        where: { id: input.id, userId },
        data: {
          month: input.data.month,
          currency: input.data.currency,
          expectedIncomeAmount: input.data.expectedIncomeAmount,
          notes: input.data.notes?.trim() || null,
        },
      });
      if (updated.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Budget period not found" });
      }
      return db.budgetPeriod.findUniqueOrThrow({ where: { id: input.id } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const deleted = await db.budgetPeriod.deleteMany({
        where: { id: input.id, userId },
      });
      if (deleted.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Budget period not found" });
      }
      return { success: true };
    }),
});
