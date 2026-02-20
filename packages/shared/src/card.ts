/**
 * Credit/debit card validation with Zod, using card-validator (Braintree).
 * Use these schemas for submit-time validation; the library also exposes
 * isPotentiallyValid for live UX (e.g. when to show invalid state while typing).
 */

import valid from "card-validator";
import { z } from "zod";

/**
 * Normalizes a card number by removing all non-digit characters.
 * card-validator accepts digits only; spaces are typically stripped for validation.
 */
function normalizeCardNumber(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Zod schema for a full, submittable card number.
 * Normalizes input (digits only), then validates length + Luhn and known card type.
 */
export const cardNumberSchema = z
  .string()
  .transform(normalizeCardNumber)
  .pipe(
    z
      .string()
      .min(1, "Card number is required")
      .refine(
        (s) => valid.number(s).isValid,
        "Invalid card number (check digit or length)",
      ),
  );

/**
 * Zod schema for expiration date string (e.g. "MM/YY", "MM/YYYY", "MMYY").
 * Uses card-validator's expirationDate(); optionally pass maxElapsedYears (default 19).
 */
export function expirationDateSchema(maxElapsedYears = 19) {
  return z
    .string()
    .refine(
      (s) => valid.expirationDate(s, maxElapsedYears).isValid,
      "Invalid or expired date",
    );
}

/**
 * Default expiration date schema (cards valid up to 19 years in the future).
 */
export const defaultExpirationDateSchema = expirationDateSchema();

/**
 * Zod schema for CVV/CVC/CID (3 or 4 digits).
 * Pass 4 as maxLength when accepting Amex (4-digit CID).
 */
export function cvvSchema(maxLength: 3 | 4 = 4) {
  return z
    .string()
    .refine(
      (s) => valid.cvv(s, maxLength).isValid,
      `Security code must be ${maxLength === 4 ? "3 or 4" : "3"} digits`,
    );
}

export const defaultCvvSchema = cvvSchema(4);

/**
 * Zod schema for cardholder name.
 * Rejects empty, all-numeric/card-like strings, and length > 255.
 */
export const cardholderNameSchema = z
  .string()
  .refine((s) => valid.cardholderName(s).isValid, "Invalid cardholder name");
