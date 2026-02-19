/**
 * Shared Zod schemas for account create/update input (nested shape).
 * Used by tRPC account router and by the account form (react-hook-form + zodResolver).
 * Validation messages use error codes so the UI can map them to localized strings.
 */

import { isValidClabe, normalizeClabe } from "./clabe.js";
import { z } from "zod";
import { accountTypeSchema } from "./account.js";
import { currencySchema } from "./currency.js";

/** Error codes for account validation. Map to accounts.errors.<code> in locale. */
export const ACCOUNT_ERROR_CODES = {
  ACCOUNT_NAME_REQUIRED: "ACCOUNT_NAME_REQUIRED",
  INVALID_CLABE: "INVALID_CLABE",
  LAST4_INVALID: "LAST4_INVALID",
  CREDIT_CARD_SETTINGS_REQUIRED: "CREDIT_CARD_SETTINGS_REQUIRED",
  STATEMENT_DAY_INVALID: "STATEMENT_DAY_INVALID",
  GRACE_DAYS_INVALID: "GRACE_DAYS_INVALID",
  INSTITUTION_NOT_FOUND: "INSTITUTION_NOT_FOUND",
  ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
} as const;

export type AccountErrorCode =
  (typeof ACCOUNT_ERROR_CODES)[keyof typeof ACCOUNT_ERROR_CODES];

/** Returns true if the string looks like an error code (e.g. ACCOUNT_NAME_REQUIRED). */
export function isAccountErrorCode(message: string): message is AccountErrorCode {
  return /^[A-Z][A-Z0-9_]*$/.test(message) && message.length > 2;
}

/** Computes due day-of-month for UI hints from statement day + grace days. */
export function computeDueDayFromGrace(statementDay: number, graceDays: number): number {
  const sum = statementDay + graceDays;
  return sum <= 31 ? sum : sum - 31;
}

/** Coerces empty/NaN to default so form can submit and output type is number. */
const statementDaySchema = z.preprocess(
  (v) => (v === "" || (typeof v === "number" && Number.isNaN(v)) ? undefined : v),
  z.number().int().min(1).max(31).default(15),
);
const optionalPosInt0_90 = z.preprocess(
  (v) => (v === "" || (typeof v === "number" && Number.isNaN(v)) ? undefined : v),
  z.number().int().min(0).max(90).optional(),
);
const graceDaysWithDefault = optionalPosInt0_90.default(20);
const optionalInt = z.preprocess(
  (v) => (v === "" || (typeof v === "number" && Number.isNaN(v)) ? undefined : v),
  z.number().int().optional(),
);
const optionalNonNegativeInt = z.preprocess(
  (v) => (v === "" || (typeof v === "number" && Number.isNaN(v)) ? undefined : v),
  z.number().int().min(0).optional(),
);

export const transferProfileInputSchema = z
  .object({
    clabe: z
      .string()
      .trim()
      .max(32)
      .optional()
      .refine(
        (val) => !val || isValidClabe(normalizeClabe(val)),
        ACCOUNT_ERROR_CODES.INVALID_CLABE,
      ),
    depositReference: z.string().trim().max(80).optional(),
    beneficiaryName: z.string().trim().max(120).optional(),
    isProgrammable: z.boolean().optional(),
  })
  .optional();

/** last4 accepts "" (empty) and transforms to undefined so form can submit without card. */
const last4Schema = z
  .union([
    z.literal(""),
    z
      .string()
      .trim()
      .regex(/^\d{4}$/, ACCOUNT_ERROR_CODES.LAST4_INVALID),
  ])
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const cardProfileInputSchema = z
  .object({
    brand: z
      .string()
      .trim()
      .max(40)
      .optional()
      .transform((v) => v || undefined),
    last4: last4Schema,
  })
  .nullable()
  .optional();

export const institutionIdSchema = z
  .union([z.literal(""), z.string().uuid()])
  .optional()
  .transform((val) => (val === "" ? undefined : val));

export const institutionCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "institutionCode must be 5 digits")
  .nullable()
  .optional();

/** Due day is computed from statementDay + graceDays (see computeDueDayFromGrace). */
export const creditCardSettingsInputSchema = z.object({
  statementDay: statementDaySchema,
  graceDays: graceDaysWithDefault,
  creditLimit: optionalNonNegativeInt,
});

/** Base account input (no refinements). Use accountInputSchema for create/form; use .partial() for update. */
export const accountInputBaseSchema = z.object({
  name: z.string().trim().min(1, ACCOUNT_ERROR_CODES.ACCOUNT_NAME_REQUIRED).max(100),
  type: accountTypeSchema,
  currency: currencySchema,
  currentBalance: optionalInt.default(0),
  isActive: z.boolean().default(true),
  institutionId: institutionIdSchema,
  institutionCode: institutionCodeSchema,
  transferProfile: transferProfileInputSchema,
  cardProfile: cardProfileInputSchema,
  creditCardSettings: creditCardSettingsInputSchema.optional(),
});

export const accountInputSchema = accountInputBaseSchema.refine(
  (data) => {
    if (data.type !== "credit_card") return true;
    const s = data.creditCardSettings;
    return (
      s != null &&
      typeof s.statementDay === "number" &&
      Number.isInteger(s.statementDay) &&
      typeof s.graceDays === "number"
    );
  },
  {
    message: ACCOUNT_ERROR_CODES.CREDIT_CARD_SETTINGS_REQUIRED,
    path: ["creditCardSettings"],
  },
);

export type AccountInput = z.infer<typeof accountInputSchema>;
/** Form state type (before transform); use for useForm<AccountFormValues> */
export type AccountFormValues = z.input<typeof accountInputSchema>;
export type TransferProfileInput = z.infer<typeof transferProfileInputSchema>;
export type CardProfileInput = z.infer<typeof cardProfileInputSchema>;
export type CreditCardSettingsInput = z.infer<typeof creditCardSettingsInputSchema>;
