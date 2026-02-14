import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import { currencySchema, idSchema } from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const savingsGoalInputSchema = z
  .object({
    accountId: idSchema,
    name: z.string().trim().min(1).max(120),
    targetPercentage: z.number().min(0).max(100).optional(),
    targetAmount: z.number().int().positive().optional(),
    currency: currencySchema,
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.targetPercentage == null && input.targetAmount == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetAmount"],
        message: "Provide target percentage or target amount",
      });
    }
  });

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  return user.id;
}

async function assertOwnedAccount(userId: string, accountId: string): Promise<void> {
  const count = await db.account.count({
    where: {
      id: accountId,
      userId,
    },
  });
  if (count === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Account not found for current user",
    });
  }
}

export const savingsGoalRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user);
    const goals = await db.savingsGoal.findMany({
      where: { userId },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            balance: true,
            currency: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return goals.map((goal) => {
      const currentAmount = goal.account.balance;
      const targetAmount =
        goal.targetAmount ??
        (goal.targetPercentage != null
          ? Math.round((currentAmount * goal.targetPercentage) / 100)
          : null);
      const progressRatio =
        targetAmount && targetAmount > 0 ? Math.min(currentAmount / targetAmount, 1) : null;

      return {
        ...goal,
        progress: {
          currentAmount,
          targetAmount,
          ratio: progressRatio,
        },
      };
    });
  }),

  create: protectedProcedure
    .input(savingsGoalInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      await assertOwnedAccount(userId, input.accountId);

      return db.savingsGoal.create({
        data: {
          userId,
          accountId: input.accountId,
          name: input.name.trim(),
          targetPercentage: input.targetPercentage ?? null,
          targetAmount: input.targetAmount ?? null,
          currency: input.currency,
          notes: input.notes?.trim() || null,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: idSchema,
        data: savingsGoalInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      await assertOwnedAccount(userId, input.data.accountId);

      const updated = await db.savingsGoal.updateMany({
        where: {
          id: input.id,
          userId,
        },
        data: {
          accountId: input.data.accountId,
          name: input.data.name.trim(),
          targetPercentage: input.data.targetPercentage ?? null,
          targetAmount: input.data.targetAmount ?? null,
          currency: input.data.currency,
          notes: input.data.notes?.trim() || null,
        },
      });

      if (updated.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Savings goal not found" });
      }

      return db.savingsGoal.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const deleted = await db.savingsGoal.deleteMany({
        where: {
          id: input.id,
          userId,
        },
      });

      if (deleted.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Savings goal not found" });
      }

      return { success: true };
    }),
});
