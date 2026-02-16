import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import { idSchema } from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().max(32).optional(),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{6})$/, "Color must be a hex value like #1A2B3C")
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
});

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return user.id;
}

export const categoryRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user);
    return db.category.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }),

  create: protectedProcedure.input(categoryInputSchema).mutation(async ({ ctx, input }) => {
    const userId = requireUserId(ctx.user);

    const maxSortOrder = await db.category.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });

    const sortOrder = input.sortOrder ?? (maxSortOrder._max.sortOrder ?? -1) + 1;

    return db.category.create({
      data: {
        userId,
        name: input.name,
        icon: input.icon?.trim() || null,
        color: input.color?.trim() || null,
        sortOrder,
      },
    });
  }),

  update: protectedProcedure
    .input(
      z.object({
        id: idSchema,
        data: categoryInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      const updated = await db.category.updateMany({
        where: {
          id: input.id,
          userId,
        },
        data: {
          name: input.data.name,
          icon: input.data.icon?.trim() || null,
          color: input.data.color?.trim() || null,
          sortOrder: input.data.sortOrder,
        },
      });

      if (updated.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }

      return db.category.findUniqueOrThrow({ where: { id: input.id } });
    }),

  delete: protectedProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    const userId = requireUserId(ctx.user);
    const deleted = await db.category.deleteMany({
      where: {
        id: input.id,
        userId,
      },
    });

    if (deleted.count === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
    }

    return { success: true };
  }),

  reorder: protectedProcedure
    .input(
      z.object({
        items: z
          .array(
            z.object({
              id: idSchema,
              sortOrder: z.number().int().min(0),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const ids = input.items.map((item) => item.id);

      const ownedCount = await db.category.count({
        where: {
          userId,
          id: { in: ids },
        },
      });

      if (ownedCount !== ids.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot reorder categories that are not owned by current user",
        });
      }

      await db.$transaction(
        input.items.map((item) =>
          db.category.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
          }),
        ),
      );

      return db.category.findMany({
        where: { userId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
    }),
});
