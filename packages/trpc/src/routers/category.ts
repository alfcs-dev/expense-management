import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import {
  categoryColorSchema,
  categoryIconNameSchema,
  idSchema,
} from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const categoryKindSchema = z.enum(["expense", "income", "transfer", "savings", "debt"]);

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return user.id;
}

const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: categoryKindSchema,
  color: categoryColorSchema.optional(),
  icon: categoryIconNameSchema.optional(),
  parentId: idSchema.optional(),
});

async function ensureDefaultCategories(userId: string): Promise<void> {
  for (const defaultName of ["Salary", "Deposit", "Other"]) {
    const existing = await db.category.findFirst({
      where: {
        userId,
        name: defaultName,
        kind: "income",
      },
      select: { id: true, parentId: true },
    });
    if (!existing) {
      await db.category.create({
        data: {
          userId,
          name: defaultName,
          kind: "income",
          color:
            defaultName === "Salary"
              ? "#10B981"
              : defaultName === "Deposit"
                ? "#3B82F6"
                : "#F59E0B",
          icon:
            defaultName === "Salary"
              ? "Briefcase"
              : defaultName === "Deposit"
                ? "Banknote"
                : "Sparkles",
          parentId: null,
        },
      });
      continue;
    }

    if (existing.parentId) {
      await db.category.update({
        where: { id: existing.id },
        data: { parentId: null },
      });
    }
  }
}

export const categoryRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user);
    await ensureDefaultCategories(userId);
    return db.category.findMany({
      where: { userId },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
  }),

  create: protectedProcedure
    .input(categoryInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      if (input.parentId) {
        const parent = await db.category.findFirst({
          where: { id: input.parentId, userId },
          select: { id: true },
        });
        if (!parent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Parent category not found for current user",
          });
        }
      }

      return db.category.create({
        data: {
          userId,
          name: input.name,
          kind: input.kind,
          color: input.color ?? null,
          icon: input.icon ?? null,
          parentId: input.parentId ?? null,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: idSchema, data: categoryInputSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);

      if (input.data.parentId) {
        const parent = await db.category.findFirst({
          where: { id: input.data.parentId, userId },
          select: { id: true },
        });
        if (!parent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Parent category not found for current user",
          });
        }
      }

      const updated = await db.category.updateMany({
        where: { id: input.id, userId },
        data: {
          name: input.data.name,
          kind: input.data.kind,
          color: input.data.color,
          icon: input.data.icon,
          parentId: input.data.parentId,
        },
      });
      if (updated.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }

      return db.category.findUniqueOrThrow({ where: { id: input.id } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const deleted = await db.category.deleteMany({
        where: { id: input.id, userId },
      });
      if (deleted.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }
      return { success: true };
    }),
});
