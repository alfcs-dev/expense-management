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

function toMonthDate(startDate: Date, offset: number): Date {
  const next = new Date(startDate);
  next.setMonth(next.getMonth() + offset);
  return next;
}

export const installmentRouter = router({
  listByPlan: protectedProcedure
    .input(z.object({ installmentPlanId: idSchema }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const plan = await db.installmentPlan.findFirst({
        where: { id: input.installmentPlanId, userId },
        select: { id: true },
      });
      if (!plan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Installment plan not found for current user",
        });
      }

      return db.installment.findMany({
        where: {
          userId,
          installmentPlanId: input.installmentPlanId,
        },
        include: {
          expenses: {
            select: {
              id: true,
              amount: true,
              date: true,
              statement: { select: { id: true, status: true } },
            },
          },
        },
        orderBy: { installmentNumber: "asc" },
      });
    }),

  generateSchedule: protectedProcedure
    .input(
      z.object({
        installmentPlanId: idSchema,
        replaceExisting: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const plan = await db.installmentPlan.findFirst({
        where: { id: input.installmentPlanId, userId },
        select: {
          id: true,
          userId: true,
          months: true,
          totalAmount: true,
          startDate: true,
        },
      });
      if (!plan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Installment plan not found for current user",
        });
      }

      const existingCount = await db.installment.count({
        where: { installmentPlanId: plan.id, userId },
      });
      if (existingCount > 0 && !input.replaceExisting) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Installment schedule already exists. Pass replaceExisting=true to regenerate.",
        });
      }

      const amountPerInstallment = Math.floor(plan.totalAmount / plan.months);
      const remainder = plan.totalAmount - amountPerInstallment * plan.months;

      await db.$transaction(async (tx) => {
        if (existingCount > 0 && input.replaceExisting) {
          await tx.installment.deleteMany({
            where: { installmentPlanId: plan.id, userId },
          });
        }

        for (let index = 0; index < plan.months; index += 1) {
          const amount =
            index === plan.months - 1
              ? amountPerInstallment + remainder
              : amountPerInstallment;
          await tx.installment.create({
            data: {
              userId: plan.userId,
              installmentPlanId: plan.id,
              installmentNumber: index + 1,
              dueDate: toMonthDate(plan.startDate, index),
              amount,
            },
          });
        }
      });

      return db.installment.findMany({
        where: { installmentPlanId: plan.id, userId },
        orderBy: { installmentNumber: "asc" },
      });
    }),

  progress: protectedProcedure
    .input(z.object({ installmentPlanId: idSchema }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const installments = await db.installment.findMany({
        where: { installmentPlanId: input.installmentPlanId, userId },
        include: {
          expenses: {
            select: {
              id: true,
              statement: { select: { status: true } },
            },
          },
        },
      });
      if (!installments.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Installment schedule not found",
        });
      }

      const paidCount = installments.filter((item) =>
        item.expenses.some((expense) => expense.statement?.status === "paid"),
      ).length;
      const totalCount = installments.length;
      const remainingCount = totalCount - paidCount;
      const remainingAmount = installments
        .filter(
          (item) =>
            !item.expenses.some((expense) => expense.statement?.status === "paid"),
        )
        .reduce((sum, item) => sum + item.amount, 0);

      return {
        totalCount,
        paidCount,
        remainingCount,
        remainingAmount,
      };
    }),
});
