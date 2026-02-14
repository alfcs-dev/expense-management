import { z } from "zod";

const CLABE_LENGTH = 18;

export function normalizeClabe(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidClabe(clabe: string): boolean {
  if (!/^\d{18}$/.test(clabe)) return false;

  const multipliers = [3, 7, 1] as const;
  let sum = 0;

  for (let index = 0; index < CLABE_LENGTH - 1; index += 1) {
    const digit = Number(clabe[index]);
    const factor = multipliers[index % multipliers.length];
    sum += (digit * factor) % 10;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(clabe[CLABE_LENGTH - 1]);
}

export const clabeSchema = z
  .string()
  .transform((value) => normalizeClabe(value))
  .pipe(z.string().regex(/^\d{18}$/, "CLABE must contain 18 digits"));
