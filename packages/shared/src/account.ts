import { z } from "zod";

/** Account types aligned with Prisma schema. */
export const ACCOUNT_TYPES = ["debit", "credit", "investment", "cash"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const accountTypeSchema = z.enum(ACCOUNT_TYPES);
