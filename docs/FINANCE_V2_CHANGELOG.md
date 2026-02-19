# Finance V2 Change Log

This document captures the pre-launch cutover from the legacy expense-centric model to the transactions-first Finance V2 model.

## Snapshot

- Branch: `phase-2.6-finance-v2`
- Date: 2026-02-17
- Scope: schema reset + seed rewrite + tRPC contract realignment + docs refresh
- Auth strategy: preserved (`User`, Better Auth session/account/verification tables kept)

## What Changed

## 1. Database Model

- Replaced legacy finance entities with transactions-first schema in `packages/db/prisma/schema.prisma`.
- Kept all money amounts as integer cents (`Int`) across finance entities.
- Added ledger and planning model:
  - `transactions`, `transfers`, `planned_transfers`
  - `budget_periods`, `income_plan_items`, `income_events`, `budget_rules`, `budgets`
  - `credit_card_settings`, `credit_card_statements`, `statement_payments`
  - `installment_plans`, `installments`
  - `bills`, `account_balance_snapshots`, `account_transfer_profiles`
- Removed old finance entities not aligned to the new model.

## 2. Migration Strategy

- Rebuilt migration history to a single clean baseline migration:
  - `packages/db/prisma/migrations/20260217160000_initial_auth_and_transactions/migration.sql`
- Intended path is development reset (pre-launch):
  - `pnpm db:migrate`
  - `pnpm db:seed`

## 3. Seed Data

- Rewrote `packages/db/seed.ts` for the new domain model.
- Seed now includes:
  - default accounts/categories/projects
  - at least one budget period + budgets
  - income plan item + income event
  - transfers and planned transfer relation
  - statement lifecycle sample
  - installment plan and schedule
  - bills and balance snapshot examples

## 4. tRPC Contracts

Updated routers under `packages/trpc/src/routers`:

- `account.ts`: account types now `checking | savings | cash | credit_card`; transfer profile + credit settings relations.
- `category.ts`: aligned to `kind` + parent structure in new schema.
- `budget-period.ts`: CRUD + period-level ownership checks.
- `budget-rule.ts`: rule CRUD aligned to planning model.
- `budget-allocation.ts`: operates on `budgets` rows.
- `budget.ts`: now period/category planned rows (no legacy default/range budget procedures).
- `income-plan-item.ts`: creates items with explicit `userId`.
- `credit-card-statement.ts`: statement and payment behavior aligned to `transaction` + new transfer shape.
- `installment.ts`: aligned to `installment_plans` and `installments` naming/relations.
- `expense.ts`: migrated to transactions behavior and exports:
  - `transactionRouter` (canonical)
  - `expenseRouter` alias (temporary compatibility)
- `recurring-expense.ts`: intentionally deprecated (list returns empty, writes throw migration guidance error).

Router assembly update in `packages/trpc/src/root.ts`:
- Added `transaction.*`.
- Kept `expense.*` alias for incremental frontend migration.

Shared type update:
- `packages/shared/src/account.ts` account type values aligned to new schema.

## 5. Documentation

Updated:
- `docs/ARCHITECTURE_FINANCE_V2.md`
- `docs/ERD_FINANCE_V2.md`
- `docs/API_TESTING.md`
- `.planning/in_progress/phase-2.5-core-hardening.md`

## 6. Account Type Enum Expansion (2026-02-17)

- Expanded `AccountType` enum from:
  - `checking | savings | cash | credit_card`
- To:
  - `debit | savings | investment | credit_card | credit | cash`
- Added migration:
  - `packages/db/prisma/migrations/20260217233928_account_type_enum_expansion/migration.sql`
- Migration includes safe data mapping for existing rows:
  - `checking -> debit`
- Updated all affected layers:
  - Prisma schema
  - shared Zod/type contract (`packages/shared/src/account.ts`)
  - seed fixtures (`packages/db/seed.ts`)
  - web accounts route type/options (`apps/web/src/routes/accounts.tsx`)

## 7. Account Metadata and Validation Libraries (2026-02-18)

- Added account metadata entities:
  - `institution_catalog`
  - `account_card_profiles`
  - `accounts.institution_id` foreign key (UUID -> `institution_catalog.id`)
- Added migration:
  - `packages/db/prisma/migrations/20260218024615_account_profile_metadata/migration.sql`
- Added account metadata API support:
  - `institutionCatalog.list`
  - expanded `account.create/update/list` to include institution + card profile shape
- Added shared validation updates:
  - `packages/shared/src/clabe.ts` now uses `clabe-validator` with internal checksum fallback path
  - `packages/shared/src/card.ts` includes card-oriented Zod schemas around `card-validator`
- Updated accounts UI to collect:
  - CLABE + transfer metadata
  - institution selection/inference
  - card brand + last4 and cycle settings
- Updated seed/Postman/docs to include the new metadata path and operational fallback guidance.

## Breaking Changes

- Legacy budget model (`name/start/end/default` APIs) is removed from tRPC contracts.
- Legacy recurring-expense API behavior is removed (deprecated router kept for explicit failures).
- Any consumers expecting old account fields (`institution`, `creditLimit`, `currentDebt`, etc.) must migrate to the new account + profile/settings shape.
- Any consumers expecting expense-level currency-conversion fields from old budget flow must migrate to transaction + period reporting flow.

## Validation Status

Passed:
- `pnpm --filter @expense-management/db lint`
- `pnpm --filter @expense-management/db typecheck`
- `pnpm --filter @expense-management/trpc lint`
- `pnpm --filter @expense-management/trpc typecheck`
- `pnpm --filter @expense-management/shared typecheck`

Known gap:
- `pnpm -s typecheck` fails in `apps/web` because pages still consume legacy tRPC response shapes. This is expected until frontend migration catches up.

## Recommended Next Work

1. Migrate `apps/web` routes to `transaction.*` and new planning routers (`budgetPeriod`, `budgetRule`, `budget`, `budgetAllocation`).
2. Replace deprecated recurring-expense UI with planned transfer / bill templates tied to Finance V2 seams.
3. Add Finance V2 API integration tests in `apps/api` for the new router contracts.
4. Remove temporary `expense.*` alias once web/app clients stop using legacy names.
