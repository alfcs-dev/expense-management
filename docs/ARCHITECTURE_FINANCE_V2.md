# Finance V2 Architecture

This document defines the transactions-first Finance V2 model after the pre-launch schema reset.

For an implementation-level list of what was changed in this cutover, see `docs/FINANCE_V2_CHANGELOG.md`.

## Objectives

- Keep Better Auth models stable.
- Use `transactions` as the canonical ledger table.
- Keep all money fields in integer cents (`Int`).
- Introduce planning entities (`budget_periods`, `budget_rules`, `budgets`).
- Introduce explicit credit-card statement lifecycle.
- Add V2 seams for cashflow orchestration (`planned_transfers`, `income_events`, `bills`, `account_balance_snapshots`).

## Layered Model

## 1. Ledger Layer (actuals)

- `transactions`: source of truth for recorded money movement by account/category/date.
- `transfers`: account-to-account movement with optional outflow/inflow transaction linkage.
- `accounts`, `categories`, `projects`: core references.

`transactions` can optionally link to:
- `statement_id` (`credit_card_statements`)
- `installment_id` (`installments`)

## 2. Credit Lifecycle Layer

- `credit_card_settings`: card cutoff/due configuration.
- `credit_card_statements`: period + due state + paid state.
- `statement_payments`: links payment transfers to statements.

Lifecycle:
1. card charges are recorded in `transactions`
2. statement closes and transactions are assigned by period
3. payment transfer is recorded and linked via `statement_payments`
4. statement moves `closed -> partial -> paid`

## 3. Installment Layer

- `installment_plans`: purchase contract metadata.
- `installments`: schedule rows (`1..N`) with due date and amount.

Progress is computed from schedule rows + settlement state of linked transactions/statements.

## 4. Planning Layer

- `budget_periods`: monthly resource container (`YYYY-MM`).
- `income_plan_items`: expected income inputs for planning.
- `budget_rules`: fixed/percent rule strategy.
- `budgets`: generated or overridden planned amount by period+category.

Generation default policy:
- apply fixed rules first
- then apply percent rules against remaining income
- respect `min_amount` / `cap_amount`
- preserve manual overrides (`is_override = true`)
- assign leftover to `Buffer` when present

## 5. V2 Seams

- `planned_transfers`: planned allocation movements from income events to target accounts.
- `income_events`: actual paycheck/deposit timeline.
- `bills`: scheduled obligations with due day and intended paying/funding accounts.
- `account_balance_snapshots`: reconciliation checkpoints over time.
- `account_transfer_profiles`: CLABE/reference metadata for real transfer routing.
- `account_card_profiles`: optional card metadata (`brand`, `last4`) for account UX.
- `institution_catalog`: normalized institution directory used for CLABE bank-code inference.

## API Surface (Current)

Active tRPC routers:
- `account.*`
- `category.*`
- `budgetPeriod.*`
- `budgetRule.*`
- `budgetAllocation.*` (works over `budgets` table)
- `budget.*` (works over `budgets` table)
- `incomePlanItem.*`
- `creditCardStatement.*`
- `installment.*`
- `transaction.*`
- `expense.*` (temporary alias to `transaction.*`)
- `recurringExpense.*` returns clear deprecation error (removed in cutover)

## Constraints and Invariants

- One statement per card-period (`account_id + period_start + period_end` unique).
- One budget row per period/category (`budget_period_id + category_id` unique).
- One installment number per plan (`plan_id + installment_number` unique).
- Domain entities are user-scoped (`user_id`) for multi-user safety.

## Future Extensions

Schema-ready but not implemented yet:
- carryover interest/fees for overdue card statements
- auto-close statement jobs
- split payment allocation heuristics
- bill-to-planned-transfer automation
