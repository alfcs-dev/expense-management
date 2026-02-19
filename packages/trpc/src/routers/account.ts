import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import {
  accountTypeSchema,
  currencySchema,
  idSchema,
  normalizeClabe,
  parseClabe,
} from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return user.id;
}

const transferProfileInputSchema = z
  .object({
    clabe: z.string().trim().max(32).optional(),
    depositReference: z.string().trim().max(80).optional(),
    beneficiaryName: z.string().trim().max(120).optional(),
    bankName: z.string().trim().max(120).optional(),
    isProgrammable: z.boolean().optional(),
  })
  .optional();

const cardProfileInputSchema = z
  .object({
    brand: z.string().trim().max(40).optional(),
    last4: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "last4 must contain exactly 4 digits")
      .optional(),
  })
  .nullable()
  .optional();

const institutionIdSchema = z.string().uuid().nullable().optional();
const institutionCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "institutionCode must be 5 digits")
  .nullable()
  .optional();

const creditCardSettingsInputSchema = z
  .object({
    statementDay: z.number().int().min(1).max(31),
    dueDay: z.number().int().min(1).max(31),
    graceDays: z.number().int().min(0).max(90).optional(),
  })
  .optional();

const accountInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: accountTypeSchema,
  currency: currencySchema,
  isActive: z.boolean().default(true),
  institutionId: institutionIdSchema,
  institutionCode: institutionCodeSchema,
  transferProfile: transferProfileInputSchema,
  cardProfile: cardProfileInputSchema,
  creditCardSettings: creditCardSettingsInputSchema,
});

export const accountRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user);
    return db.account.findMany({
      where: { userId },
      include: {
        institution: true,
        transferProfile: true,
        cardProfile: true,
        creditCardSettings: true,
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });
  }),

  create: protectedProcedure
    .input(accountInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const isCreditCard = input.type === "credit_card";
      const normalizedClabe = input.transferProfile?.clabe
        ? normalizeClabe(input.transferProfile.clabe)
        : null;

      let clabeBankCode: string | null = null;
      let clabeBankName: string | null = null;
      if (normalizedClabe) {
        const parsed = parseClabe(normalizedClabe);
        if (!parsed.isValid) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid CLABE" });
        }
        clabeBankCode = parsed.bankCode;
        clabeBankName = parsed.bankName;
      }

      let resolvedInstitutionId: string | null =
        input.institutionId === undefined ? null : input.institutionId;
      if (resolvedInstitutionId === null && input.institutionCode) {
        const byCode = await db.institutionCatalog.findFirst({
          where: { code: input.institutionCode, isActive: true },
          select: { id: true },
        });
        resolvedInstitutionId = byCode?.id ?? null;
      }
      if (resolvedInstitutionId === null && clabeBankCode) {
        const inferredInstitution = await db.institutionCatalog.findFirst({
          where: { bankCode: clabeBankCode, isActive: true },
          orderBy: { name: "asc" },
          select: { id: true },
        });
        resolvedInstitutionId = inferredInstitution?.id ?? null;
      }

      if (resolvedInstitutionId) {
        const institution = await db.institutionCatalog.findUnique({
          where: { id: resolvedInstitutionId },
          select: { id: true },
        });
        if (!institution) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Institution not found" });
        }
      }

      if (isCreditCard && !input.creditCardSettings) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "creditCardSettings are required for credit_card accounts",
        });
      }

      return db.account.create({
        data: {
          userId,
          name: input.name,
          type: input.type,
          currency: input.currency,
          institutionId: resolvedInstitutionId,
          isActive: input.isActive,
          transferProfile: input.transferProfile
            ? {
                create: {
                  clabe: normalizedClabe,
                  depositReference: input.transferProfile.depositReference ?? null,
                  beneficiaryName: input.transferProfile.beneficiaryName ?? null,
                  bankName: input.transferProfile.bankName ?? clabeBankName,
                  isProgrammable: input.transferProfile.isProgrammable ?? false,
                },
              }
            : undefined,
          cardProfile:
            input.cardProfile && (input.cardProfile.brand || input.cardProfile.last4)
              ? {
                  create: {
                    brand: input.cardProfile.brand ?? null,
                    last4: input.cardProfile.last4 ?? null,
                  },
                }
              : undefined,
          creditCardSettings:
            isCreditCard && input.creditCardSettings
              ? {
                  create: {
                    statementDay: input.creditCardSettings.statementDay,
                    dueDay: input.creditCardSettings.dueDay,
                    graceDays: input.creditCardSettings.graceDays ?? null,
                  },
                }
              : undefined,
        },
        include: {
          institution: true,
          transferProfile: true,
          cardProfile: true,
          creditCardSettings: true,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: idSchema,
        data: accountInputSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const existing = await db.account.findFirst({
        where: { id: input.id, userId },
        select: { id: true, type: true, institutionId: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      const nextType = input.data.type ?? existing.type;
      if (nextType === "credit_card" && input.data.creditCardSettings === undefined) {
        const hasSettings = await db.creditCardSettings.findUnique({
          where: { accountId: input.id },
          select: { accountId: true },
        });
        if (!hasSettings) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "creditCardSettings are required for credit_card accounts",
          });
        }
      }

      let resolvedInstitutionId: string | null | undefined = input.data.institutionId;
      if (
        resolvedInstitutionId === undefined &&
        input.data.institutionCode !== undefined
      ) {
        if (input.data.institutionCode === null) {
          resolvedInstitutionId = null;
        } else {
          const byCode = await db.institutionCatalog.findFirst({
            where: { code: input.data.institutionCode, isActive: true },
            select: { id: true },
          });
          resolvedInstitutionId = byCode?.id ?? null;
        }
      }
      let normalizedClabe: string | null | undefined;
      let clabeBankName: string | null = null;
      if (input.data.transferProfile?.clabe !== undefined) {
        normalizedClabe = normalizeClabe(input.data.transferProfile.clabe);
        if (normalizedClabe) {
          const parsed = parseClabe(normalizedClabe);
          if (!parsed.isValid) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid CLABE" });
          }
          clabeBankName = parsed.bankName;
          if (resolvedInstitutionId === undefined && parsed.bankCode) {
            const inferredInstitution = await db.institutionCatalog.findFirst({
              where: { bankCode: parsed.bankCode, isActive: true },
              orderBy: { name: "asc" },
              select: { id: true },
            });
            resolvedInstitutionId = inferredInstitution?.id ?? existing.institutionId;
          }
        } else if (resolvedInstitutionId === undefined) {
          resolvedInstitutionId = existing.institutionId;
        }
      }

      if (resolvedInstitutionId) {
        const institution = await db.institutionCatalog.findUnique({
          where: { id: resolvedInstitutionId },
          select: { id: true },
        });
        if (!institution) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Institution not found" });
        }
      }

      await db.account.updateMany({
        where: { id: input.id, userId },
        data: {
          name: input.data.name,
          type: input.data.type,
          currency: input.data.currency,
          institutionId: resolvedInstitutionId,
          isActive: input.data.isActive,
        },
      });

      if (input.data.transferProfile !== undefined) {
        await db.accountTransferProfile.upsert({
          where: { accountId: input.id },
          update: {
            clabe: normalizedClabe ?? null,
            depositReference: input.data.transferProfile.depositReference ?? null,
            beneficiaryName: input.data.transferProfile.beneficiaryName ?? null,
            bankName: input.data.transferProfile.bankName ?? clabeBankName,
            isProgrammable: input.data.transferProfile.isProgrammable ?? false,
          },
          create: {
            accountId: input.id,
            clabe: normalizedClabe ?? null,
            depositReference: input.data.transferProfile.depositReference ?? null,
            beneficiaryName: input.data.transferProfile.beneficiaryName ?? null,
            bankName: input.data.transferProfile.bankName ?? clabeBankName,
            isProgrammable: input.data.transferProfile.isProgrammable ?? false,
          },
        });
      }

      if (input.data.cardProfile !== undefined) {
        if (
          input.data.cardProfile === null ||
          (!input.data.cardProfile.brand && !input.data.cardProfile.last4)
        ) {
          await db.accountCardProfile.deleteMany({ where: { accountId: input.id } });
        } else {
          await db.accountCardProfile.upsert({
            where: { accountId: input.id },
            update: {
              brand: input.data.cardProfile.brand ?? null,
              last4: input.data.cardProfile.last4 ?? null,
            },
            create: {
              accountId: input.id,
              brand: input.data.cardProfile.brand ?? null,
              last4: input.data.cardProfile.last4 ?? null,
            },
          });
        }
      }

      if (input.data.creditCardSettings !== undefined) {
        if ((input.data.type ?? existing.type) !== "credit_card") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "creditCardSettings can only be set for credit_card accounts",
          });
        }

        await db.creditCardSettings.upsert({
          where: { accountId: input.id },
          update: {
            statementDay: input.data.creditCardSettings.statementDay,
            dueDay: input.data.creditCardSettings.dueDay,
            graceDays: input.data.creditCardSettings.graceDays ?? null,
          },
          create: {
            accountId: input.id,
            statementDay: input.data.creditCardSettings.statementDay,
            dueDay: input.data.creditCardSettings.dueDay,
            graceDays: input.data.creditCardSettings.graceDays ?? null,
          },
        });
      }

      return db.account.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          institution: true,
          transferProfile: true,
          cardProfile: true,
          creditCardSettings: true,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const deleted = await db.account.deleteMany({
        where: { id: input.id, userId },
      });
      if (deleted.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }
      return { success: true };
    }),
});
