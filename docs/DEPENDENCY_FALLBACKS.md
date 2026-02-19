# Dependency Fallbacks

This project currently uses external validation libraries in the account onboarding flow:

- `clabe-validator` for CLABE validation/parsing.
- `card-validator` for card brand/number heuristics in the web form.

## CLABE fallback policy

Primary:
- `@expense-management/shared` calls `clabe.validate(...)`.
- If the library throws/unavailable behavior is detected, shared code falls back to internal checksum logic (`isValidClabe`).

Operational fallback:
1. Keep `normalizeClabe` + checksum path as the source of truth.
2. If a future library update breaks behavior, pin to last known-good version.
3. If maintenance ends, remove library usage and keep internal checksum + local institution catalog mapping.

## Card metadata fallback policy

Primary:
- `apps/web` uses `card-validator` only for UX hints (brand inference + potential validity).
- We only persist `brand` and `last4`.
- Full PAN is never persisted.

Operational fallback:
1. If library degrades, treat brand as manual user input.
2. Keep `last4` capture by local digits parsing.
3. Continue server-side persistence contract unchanged (`cardProfile.brand`, `cardProfile.last4` optional).

## Institution catalog fallback policy

Primary:
- `packages/db/scripts/sync-institutions.ts` syncs Banxico CEP institution list.
- `account.create/update` can infer institution by CLABE bank code against `institution_catalog`.

Operational fallback:
1. Seed baseline institutions needed for local/dev flows.
2. If Banxico endpoint changes, keep manual curated list until parser is updated.
3. Account creation remains functional without institution inference (field stays optional).
