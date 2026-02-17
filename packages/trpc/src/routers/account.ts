import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import {
  currencySchema,
  idSchema,
  normalizeClabe,
  isValidClabe,
} from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const accountBaseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  currency: currencySchema,
  institution: z.string().trim().max(120).optional(),
  clabe: z.string().optional(),
});

const creditAccountSchema = accountBaseSchema.extend({
  type: z.literal("credit"),
  creditLimit: z.number().int().min(0),
  currentDebt: z.number().int().min(0),
  statementClosingDay: z.number().int().min(1).max(31),
  paymentGraceDays: z.number().int().min(1).max(60),
});

const nonCreditAccountSchema = accountBaseSchema.extend({
  type: z.enum(["debit", "investment", "cash"]),
  balance: z.number().int(),
});

const upsertAccountInputSchema = z
  .union([creditAccountSchema, nonCreditAccountSchema])
  .superRefine((input, ctx) => {
    const normalizedClabe = input.clabe ? normalizeClabe(input.clabe) : "";

    if (input.type === "debit" && !normalizedClabe) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clabe"],
        message: "CLABE is required for debit accounts",
      });
      return;
    }

    if (normalizedClabe && !isValidClabe(normalizedClabe)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clabe"],
        message: "CLABE must contain 18 valid digits",
      });
    }

    if (input.type === "credit" && !normalizedClabe && !input.institution?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["institution"],
        message: "Institution is required for credit accounts when CLABE is missing",
      });
    }
  });

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return user.id;
}

function pickPreferredInstitutionName(
  institutions: Array<{ code: string; name: string }>,
): string | null {
  if (institutions.length === 0) return null;

  const sorted = [...institutions].sort((a, b) => {
    const score = (code: string) => {
      if (code.startsWith("40")) return 0;
      if (code.startsWith("37")) return 1;
      if (code.startsWith("90")) return 2;
      return 3;
    };

    const scoreDiff = score(a.code) - score(b.code);
    if (scoreDiff !== 0) return scoreDiff;

    return a.name.localeCompare(b.name);
  });

  return sorted[0]?.name ?? null;
}

async function inferInstitutionFromClabe(clabe: string): Promise<string | null> {
  const bankCode = clabe.slice(0, 3);
  const institutions = await db.institutionCatalog.findMany({
    where: {
      bankCode,
      isActive: true,
    },
    select: {
      code: true,
      name: true,
    },
  });

  return pickPreferredInstitutionName(institutions);
}

async function buildInstitutionAndClabe(
  input: z.infer<typeof upsertAccountInputSchema>,
): Promise<{ institution: string | null; clabe: string | null }> {
  const normalizedClabe = input.clabe ? normalizeClabe(input.clabe) : "";

  if (!normalizedClabe) {
    return {
      institution: input.institution?.trim() || null,
      clabe: null,
    };
  }

  if (!isValidClabe(normalizedClabe)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "CLABE must contain 18 valid digits",
    });
  }

  const institution = await inferInstitutionFromClabe(normalizedClabe);
  if (!institution) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Institution could not be inferred from CLABE",
    });
  }

  return {
    institution,
    clabe: normalizedClabe,
  };
}

export const accountRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user);
    return db.account.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }),

  institutions: protectedProcedure.query(async () => {
    return db.institutionCatalog.findMany({
      where: { isActive: true },
      select: {
        code: true,
        bankCode: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });
  }),

  create: protectedProcedure
    .input(upsertAccountInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const identity = await buildInstitutionAndClabe(input);

      const accountData =
        input.type === "credit"
          ? {
              userId,
              name: input.name,
              type: input.type,
              currency: input.currency,
              institution: identity.institution,
              clabe: identity.clabe,
              balance: 0,
              creditLimit: input.creditLimit,
              currentDebt: input.currentDebt,
              statementClosingDay: input.statementClosingDay,
              paymentGraceDays: input.paymentGraceDays,
            }
          : {
              userId,
              name: input.name,
              type: input.type,
              currency: input.currency,
              institution: identity.institution,
              clabe: identity.clabe,
              balance: input.balance,
              creditLimit: null,
              currentDebt: null,
              statementClosingDay: null,
              paymentGraceDays: null,
            };

      return db.account.create({
        data: accountData,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: idSchema,
        data: upsertAccountInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const identity = await buildInstitutionAndClabe(input.data);
      const accountData =
        input.data.type === "credit"
          ? {
              name: input.data.name,
              type: input.data.type,
              currency: input.data.currency,
              institution: identity.institution,
              clabe: identity.clabe,
              balance: 0,
              creditLimit: input.data.creditLimit,
              currentDebt: input.data.currentDebt,
              statementClosingDay: input.data.statementClosingDay,
              paymentGraceDays: input.data.paymentGraceDays,
            }
          : {
              name: input.data.name,
              type: input.data.type,
              currency: input.data.currency,
              institution: identity.institution,
              clabe: identity.clabe,
              balance: input.data.balance,
              creditLimit: null,
              currentDebt: null,
              statementClosingDay: null,
              paymentGraceDays: null,
            };

      const updated = await db.account.updateMany({
        where: {
          id: input.id,
          userId,
        },
        data: accountData,
      });

      if (updated.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      return db.account.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const deleted = await db.account.deleteMany({
        where: {
          id: input.id,
          userId,
        },
      });

      if (deleted.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      return { success: true };
    }),
});
