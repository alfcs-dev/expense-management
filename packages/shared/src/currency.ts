import { z } from "zod";

/** Currency codes aligned with Prisma schema. */
export const CURRENCIES = ["MXN", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const currencySchema = z.enum(CURRENCIES);
