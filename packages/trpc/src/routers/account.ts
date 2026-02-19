import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import {
  ACCOUNT_ERROR_CODES,
  accountInputBaseSchema,
  accountInputSchema,
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
      if (normalizedClabe) {
        const parsed = parseClabe(normalizedClabe);
        if (!parsed.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: ACCOUNT_ERROR_CODES.INVALID_CLABE,
          });
        }
        clabeBankCode = parsed.bankCode;
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
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: ACCOUNT_ERROR_CODES.INSTITUTION_NOT_FOUND,
          });
        }
      }

      if (isCreditCard && !input.creditCardSettings) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: ACCOUNT_ERROR_CODES.CREDIT_CARD_SETTINGS_REQUIRED,
        });
      }

      return db.account.create({
        data: {
          userId,
          name: input.name,
          type: input.type,
          currency: input.currency,
          currentBalance: input.currentBalance ?? 0,
          institutionId: resolvedInstitutionId,
          isActive: input.isActive,
          transferProfile: input.transferProfile
            ? {
                create: {
                  clabe: normalizedClabe,
                  depositReference: input.transferProfile.depositReference ?? null,
                  beneficiaryName: input.transferProfile.beneficiaryName ?? null,
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
                    statementDay: input.creditCardSettings.statementDay ?? 15,
                    graceDays: input.creditCardSettings.graceDays ?? null,
                    creditLimit: input.creditCardSettings.creditLimit ?? null,
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
        data: accountInputBaseSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const existing = await db.account.findFirst({
        where: { id: input.id, userId },
        select: { id: true, type: true, institutionId: true },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ACCOUNT_ERROR_CODES.ACCOUNT_NOT_FOUND,
        });
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
      if (input.data.transferProfile?.clabe !== undefined) {
        normalizedClabe = normalizeClabe(input.data.transferProfile.clabe);
        if (normalizedClabe) {
          const parsed = parseClabe(normalizedClabe);
          if (!parsed.isValid) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: ACCOUNT_ERROR_CODES.INVALID_CLABE,
            });
          }
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
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: ACCOUNT_ERROR_CODES.INSTITUTION_NOT_FOUND,
          });
        }
      }

      await db.account.updateMany({
        where: { id: input.id, userId },
        data: {
          name: input.data.name,
          type: input.data.type,
          currency: input.data.currency,
          currentBalance: input.data.currentBalance,
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
            isProgrammable: input.data.transferProfile.isProgrammable ?? false,
          },
          create: {
            accountId: input.id,
            clabe: normalizedClabe ?? null,
            depositReference: input.data.transferProfile.depositReference ?? null,
            beneficiaryName: input.data.transferProfile.beneficiaryName ?? null,
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
            message: ACCOUNT_ERROR_CODES.CREDIT_CARD_SETTINGS_REQUIRED,
          });
        }

        const cs = input.data.creditCardSettings;
        const statementDay = cs.statementDay ?? 15;
        await db.creditCardSettings.upsert({
          where: { accountId: input.id },
          update: {
            statementDay,
            graceDays: cs.graceDays ?? null,
            creditLimit: cs.creditLimit ?? null,
          },
          create: {
            accountId: input.id,
            statementDay,
            graceDays: cs.graceDays ?? null,
            creditLimit: cs.creditLimit ?? null,
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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ACCOUNT_ERROR_CODES.ACCOUNT_NOT_FOUND,
        });
      }
      return { success: true };
    }),
});
