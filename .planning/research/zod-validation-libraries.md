# Zod integration: card-validator and clabe-validator

Evaluation of integrating [card-validator](https://www.npmjs.com/package/card-validator) and [center-key/clabe-validator](https://github.com/center-key/clabe-validator) with Zod in `@expense-management/shared`.

---

## 1. card-validator (Braintree)

**Purpose:** Validate credit/debit card number, expiry, CVV, cardholder name, postal code.  
**API:** Each validator returns `{ isValid, isPotentiallyValid, ... }`. Use `isValid` for submit-time validation; `isPotentiallyValid` for live UX (e.g. when to show “invalid” while typing).

### Zod integration pattern

- Use **`.refine()`** or **`.superRefine()`** and call the library inside the predicate.
- Optionally **`.transform()`** first to normalize (e.g. strip spaces from card number).
- For **card number**, you can keep the schema as `z.string()` and refine with `valid.number(value).isValid`; use `superRefine` if you want to surface “expected check digit” or card type in the error.
- **Expiry** can be parsed by the library (many formats); you get back `month`/`year` only when valid, so a refine that checks `isValid` and optionally transforms to `{ month, year }` works well.
- **CVV** length depends on card type (3 vs 4 for Amex); you can pass `maxLength` from context or use 4 and accept both.

### Example: card number schema

```ts
import valid from "card-validator";
import { z } from "zod";

export const cardNumberSchema = z
  .string()
  .transform((s) => s.replace(/\s/g, ""))
  .pipe(
    z.string().refine(
      (s) => valid.number(s).isValid,
      (s) => {
        const r = valid.number(s);
        if (!r.isPotentiallyValid) return { message: "Invalid card number" };
        return { message: "Card number failed validation (check digit or length)" };
      }
    )
  );
```

### Example: expiry date schema (string like "MM/YY" or "MM/YYYY")

```ts
const expirationSchema = z.string().refine(
  (s) => valid.expirationDate(s).isValid,
  "Invalid or expired date"
);
// Optional: transform to { month, year } using valid.expirationDate(s).month/year
```

### Example: CVV (fixed 3 digits; use 4 for Amex if needed)

```ts
const cvvSchema = z.string().refine(
  (s) => valid.cvv(s, 4).isValid, // 4 allows Amex
  "Invalid security code"
);
```

### Recommendation

- Add **card-validator** as a dependency of `@expense-management/shared`.
- Add Zod schemas in a new module (e.g. `packages/shared/src/card.ts`) that wrap `valid.number`, `valid.expirationDate`, `valid.cvv`, and optionally `valid.cardholderName` / `valid.postalCode`, using the patterns above.
- Use **refine** for submit validation; keep **isPotentiallyValid** in mind for future UI (e.g. a custom input component that calls the library on change).

---

## 2. clabe-validator (center-key)

**Purpose:** Validate and analyze Mexican CLABE (18-digit account code). Returns bank/city metadata and a clear `formatOk` (length + checksum) vs `ok` (format + known bank/city codes).  
**Docs:** [GitHub](https://github.com/center-key/clabe-validator), [clabe-validator.js.org](https://clabe-validator.js.org)

**API:**

- `clabe.validate(clabeNum: string)` → `ClabeCheck` with `ok`, `formatOk`, `error`, `message`, `clabe`, `bank`, `city`, `code`, `checksum`, etc.
- `clabe.calculate(bankCode, cityCode, accountNumber)` → 18-digit CLABE string.

### Current codebase

- `packages/shared/src/clabe.ts` implements **normalize** + **MOD 10 checksum** and a Zod schema that only normalizes and enforces 18 digits (no checksum in schema).
- `package.json` lists `clabe-validator` but it is **not used** in `clabe.ts` (in-house implementation instead).
- TRPC account router uses `z.string().trim().max(32).optional()` for `clabe`, not `clabeSchema`.

### Zod integration pattern (center-key)

- **Normalize first** (digits only), then validate with the library.
- Use **`formatOk`** for “valid length + checksum” (matches current in-house `isValidClabe`).
- Use **`ok`** if you also want to restrict to known bank/city codes (stricter).
- In Zod: `.transform(normalize)` then `.refine((s) => clabe.validate(s).formatOk, (s) => ({ message: clabe.validate(s).message }))`.

### Option A: Keep in-house, add checksum to schema

- No new dependency; already aligned with Banco de México MOD 10.
- Add a `.refine(isValidClabe, "Invalid CLABE checksum")` to `clabeSchema` so the schema is fully strict.
- Optionally tighten TRPC input with `clabeSchema.optional()`.

### Option B: Use center-key/clabe-validator in Zod

- Normalize (digits only), then refine using `clabe.validate(normalized).formatOk` or `.ok`.
- Benefit: same checksum logic as the reference library; optional access to bank/city names for UI or error messages.
- Dependency: ensure npm package matches [center-key/clabe-validator](https://github.com/center-key/clabe-validator) (e.g. `clabe-validator` on npm); upgrade to a version that exposes `validate` and TypeScript types if needed.

### Example: Zod schema using center-key (format only)

```ts
import { clabe } from "clabe-validator";
import { z } from "zod";

const normalizeClabe = (s: string) => s.replace(/\D/g, "");

export const clabeSchemaWithLibrary = z
  .string()
  .transform(normalizeClabe)
  .pipe(
    z.string().length(18, "CLABE must be 18 digits").refine(
      (s) => clabe.validate(s).formatOk,
      (s) => ({ message: clabe.validate(s).message ?? "Invalid CLABE" })
    )
  );
```

### Recommendation

- **Short term:** Keep in-house implementation; add **`.refine(isValidClabe, "Invalid CLABE checksum")`** to `clabeSchema` so one schema does format + checksum. Use `clabeSchema.optional()` in the account router instead of plain `z.string().trim().max(32).optional()`.
- **Optional:** If you want bank/city metadata or to rely on the reference library, add a second export that uses `clabe-validator` (and possibly a schema that uses `.ok` for strict bank/city validation), and document when to use which.

---

## Summary

| Library           | Zod pattern              | Suggested use in shared                          |
|------------------|--------------------------|---------------------------------------------------|
| **card-validator** | `transform` + `refine`   | New `card.ts`: card number, expiry, CVV schemas  |
| **clabe-validator**| `transform` + `refine`   | Either extend `clabeSchema` with `isValidClabe` or wrap `clabe.validate().formatOk` in a schema |

Both integrate cleanly with Zod via **normalize (transform) + refine/superRefine**; no need for a separate “validation layer” outside Zod.
