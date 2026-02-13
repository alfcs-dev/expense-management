import { z } from "zod";

/** Recurring frequency aligned with Prisma schema. */
export const RECURRING_FREQUENCIES = [
  "monthly",
  "biweekly",
  "annual",
  "bimonthly",
] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const recurringFrequencySchema = z.enum(RECURRING_FREQUENCIES);
