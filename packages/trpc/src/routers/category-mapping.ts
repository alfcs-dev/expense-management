import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import { idSchema } from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const mappingInputSchema = z.object({
  categoryId: idSchema,
  pattern: z.string().trim().min(1).max(200),
  matchType: z.enum(["contains", "exact", "regex"]),
});

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  return user.id;
}

async function assertOwnedCategory(userId: string, categoryId: string): Promise<void> {
  const count = await db.category.count({
    where: {
      id: categoryId,
      userId,
    },
  });
  if (count === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Category not found for current user",
    });
  }
}

export const categoryMappingRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user);
    return db.categoryMapping.findMany({
      where: { userId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });
  }),

  create: protectedProcedure
    .input(mappingInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      await assertOwnedCategory(userId, input.categoryId);
      return db.categoryMapping.create({
        data: {
          userId,
          categoryId: input.categoryId,
          pattern: input.pattern.trim(),
          matchType: input.matchType,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: idSchema,
        data: mappingInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      await assertOwnedCategory(userId, input.data.categoryId);
      const updated = await db.categoryMapping.updateMany({
        where: {
          id: input.id,
          userId,
        },
        data: {
          categoryId: input.data.categoryId,
          pattern: input.data.pattern.trim(),
          matchType: input.data.matchType,
        },
      });
      if (updated.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category mapping not found",
        });
      }
      return db.categoryMapping.findUniqueOrThrow({ where: { id: input.id } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const deleted = await db.categoryMapping.deleteMany({
        where: {
          id: input.id,
          userId,
        },
      });
      if (deleted.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category mapping not found",
        });
      }
      return { success: true };
    }),
});
