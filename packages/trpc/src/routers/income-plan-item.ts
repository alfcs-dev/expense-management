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

const incomePlanInputSchema = z.object({
  budgetPeriodId: idSchema,
  date: z.coerce.date().optional(),
  source: z.string().trim().min(1).max(120),
  amount: z.number().int().positive(),
  accountId: idSchema.optional(),
  isRecurring: z.boolean().default(false),
});

export const incomePlanItemRouter = router({
  list: protectedProcedure
    .input(z.object({ budgetPeriodId: idSchema }))
    .query(async ({ ctx, input }) => {
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

      return db.incomePlanItem.findMany({
        where: { userId, budgetPeriodId: input.budgetPeriodId },
        include: {
          account: { select: { id: true, name: true, currency: true } },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      });
    }),

  create: protectedProcedure
    .input(incomePlanInputSchema)
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

      if (input.accountId) {
        const account = await db.account.findFirst({
          where: { id: input.accountId, userId },
          select: { id: true },
        });
        if (!account) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Account not found for current user",
          });
        }
      }

      return db.incomePlanItem.create({
        data: {
          userId,
          budgetPeriodId: input.budgetPeriodId,
          date: input.date,
          source: input.source,
          amount: input.amount,
          accountId: input.accountId,
          isRecurring: input.isRecurring,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const deleted = await db.incomePlanItem.deleteMany({
        where: { id: input.id, userId },
      });

      if (deleted.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Income plan item not found",
        });
      }

      return { success: true };
    }),
});
