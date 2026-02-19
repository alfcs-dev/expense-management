import { clabe } from "clabe-validator";
import { z } from "zod";

const CLABE_LENGTH = 18;

export function normalizeClabe(value: string): string {
  return value.replace(/\D/g, "");
}

type ClabeCheckResult = ReturnType<typeof clabe.validate>;

function validateWithLibrary(clabeNumber: string): ClabeCheckResult | null {
  try {
    const validations = clabe.validate(clabeNumber);
    console.log({ validations });
    return validations;
  } catch {
    return null;
  }
}

export function isValidClabe(clabeNumber: string): boolean {
  if (!/^\d{18}$/.test(clabeNumber)) return false;

  const libraryCheck = validateWithLibrary(clabeNumber);
  if (libraryCheck) return libraryCheck.formatOk;

  const multipliers = [3, 7, 1] as const;
  let sum = 0;

  for (let index = 0; index < CLABE_LENGTH - 1; index += 1) {
    const digit = Number(clabeNumber[index]);
    const factor = multipliers[index % multipliers.length];
    sum += (digit * factor) % 10;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(clabeNumber[CLABE_LENGTH - 1]);
}

export function parseClabe(value: string): {
  normalized: string;
  isValid: boolean;
  bankCode: string | null;
  bankName: string | null;
} {
  const normalized = normalizeClabe(value);
  if (!normalized) {
    return { normalized, isValid: false, bankCode: null, bankName: null };
  }

  const libraryCheck = validateWithLibrary(normalized);
  if (libraryCheck) {
    return {
      normalized,
      isValid: libraryCheck.formatOk,
      bankCode: libraryCheck.code.bank || null,
      bankName: libraryCheck.bank || null,
    };
  }

  return {
    normalized,
    isValid: isValidClabe(normalized),
    bankCode: normalized.length >= 3 ? normalized.slice(0, 3) : null,
    bankName: null,
  };
}

export const clabeSchema = z
  .string()
  .transform((value) => normalizeClabe(value))
  .pipe(z.string().regex(/^\d{18}$/, "CLABE must contain 18 digits"))
  .refine((value) => isValidClabe(value), "Invalid CLABE checksum");
