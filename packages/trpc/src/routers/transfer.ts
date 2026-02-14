import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import { currencySchema, idSchema } from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const transferInputSchema = z
  .object({
    sourceAccountId: idSchema,
    destAccountId: idSchema,
    amount: z.number().int().positive(),
    currency: currencySchema,
    date: z.coerce.date(),
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.sourceAccountId === input.destAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destAccountId"],
        message: "Destination account must be different from source account",
      });
    }
  });

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  return user.id;
}

async function assertOwnedAccounts(
  userId: string,
  sourceAccountId: string,
  destAccountId: string,
): Promise<void> {
  const count = await db.account.count({
    where: {
      userId,
      id: {
        in: [sourceAccountId, destAccountId],
      },
    },
  });

  if (count !== 2) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Source or destination account not found for current user",
    });
  }
}

export const transferRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user);
    return db.transfer.findMany({
      where: { userId },
      include: {
        sourceAccount: { select: { id: true, name: true } },
        destAccount: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
  }),

  create: protectedProcedure
    .input(transferInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      await assertOwnedAccounts(userId, input.sourceAccountId, input.destAccountId);

      return db.transfer.create({
        data: {
          userId,
          sourceAccountId: input.sourceAccountId,
          destAccountId: input.destAccountId,
          amount: input.amount,
          currency: input.currency,
          date: input.date,
          notes: input.notes?.trim() || null,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: idSchema,
        data: transferInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      await assertOwnedAccounts(
        userId,
        input.data.sourceAccountId,
        input.data.destAccountId,
      );

      const updated = await db.transfer.updateMany({
        where: {
          id: input.id,
          userId,
        },
        data: {
          sourceAccountId: input.data.sourceAccountId,
          destAccountId: input.data.destAccountId,
          amount: input.data.amount,
          currency: input.data.currency,
          date: input.data.date,
          notes: input.data.notes?.trim() || null,
        },
      });

      if (updated.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transfer not found" });
      }

      return db.transfer.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const deleted = await db.transfer.deleteMany({
        where: {
          id: input.id,
          userId,
        },
      });

      if (deleted.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transfer not found" });
      }

      return { success: true };
    }),
});
