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
    .input(z.object({ planId: idSchema }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const plan = await db.installmentPlan.findFirst({
        where: { id: input.planId, userId },
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
          planId: input.planId,
        },
        include: {
          transactions: {
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
        planId: idSchema,
        replaceExisting: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const plan = await db.installmentPlan.findFirst({
        where: { id: input.planId, userId },
        select: {
          id: true,
          userId: true,
          installmentCountTotal: true,
          principalAmount: true,
          purchaseDate: true,
        },
      });
      if (!plan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Installment plan not found for current user",
        });
      }

      const existingCount = await db.installment.count({
        where: { planId: plan.id, userId },
      });
      if (existingCount > 0 && !input.replaceExisting) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Installment schedule already exists. Pass replaceExisting=true to regenerate.",
        });
      }

      const amountPerInstallment = Math.floor(
        plan.principalAmount / plan.installmentCountTotal,
      );
      const remainder =
        plan.principalAmount - amountPerInstallment * plan.installmentCountTotal;

      await db.$transaction(async (tx) => {
        if (existingCount > 0 && input.replaceExisting) {
          await tx.installment.deleteMany({
            where: { planId: plan.id, userId },
          });
        }

        for (let index = 0; index < plan.installmentCountTotal; index += 1) {
          const amount =
            index === plan.installmentCountTotal - 1
              ? amountPerInstallment + remainder
              : amountPerInstallment;

          await tx.installment.create({
            data: {
              userId: plan.userId,
              planId: plan.id,
              installmentNumber: index + 1,
              dueDate: toMonthDate(plan.purchaseDate, index),
              amount,
            },
          });
        }
      });

      return db.installment.findMany({
        where: { planId: plan.id, userId },
        orderBy: { installmentNumber: "asc" },
      });
    }),

  progress: protectedProcedure
    .input(z.object({ planId: idSchema }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const installments = await db.installment.findMany({
        where: { planId: input.planId, userId },
        include: {
          transactions: {
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
        item.transactions.some((transaction) => transaction.statement?.status === "paid"),
      ).length;
      const totalCount = installments.length;
      const remainingCount = totalCount - paidCount;
      const remainingAmount = installments
        .filter(
          (item) =>
            !item.transactions.some(
              (transaction) => transaction.statement?.status === "paid",
            ),
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
