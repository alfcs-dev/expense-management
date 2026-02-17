# Finance V2 Architecture

This document defines the Finance V2 model introduced after the core hardening baseline.

## Objectives

- Keep Better Auth models stable.
- Introduce explicit planning entities (periods/rules/generated allocations).
- Introduce explicit credit-card statement lifecycle.
- Keep `Expense` as the canonical transaction ledger for actuals.
- Provide a clean foundation for future interest-bearing debt flows.

## Layered Model

## 1. Ledger Layer (actuals)

- `Expense`: the source of truth for recorded spending.
- `Transfer`: money movement between accounts.
- `Account`, `Category`: core references.

`Expense` can now optionally link to:
- `statementId` (`CreditCardStatement`)
- `installmentId` (`Installment`)

## 2. Credit Lifecycle Layer

- `CreditCardStatement`: statement period, due date, status, statement balance, applied payments.
- `StatementPayment`: links a payment transfer to a statement.

Lifecycle:
1. charges accumulate on credit account (`Expense.accountId`)
2. statement closes and captures period charges (`Expense.statementId`)
3. transfer payment is recorded and linked (`StatementPayment`)
4. statement moves `closed -> partial -> paid`

## 3. Installment Layer

- `InstallmentPlan`: contract-level metadata (existing model).
- `Installment`: schedule rows (`1..N`) with due date and amount.

Progress is computed from schedule rows and statement settlement status of linked expenses.

## 4. Planning Layer

- `BudgetPeriod`: monthly resource container (`YYYY-MM`).
- `IncomePlanItem`: planned income events for the period.
- `BudgetRule`: fixed or percent-of-income rules.
- `BudgetAllocation`: generated per-category planned amount for a period.

Generation default policy:
- apply fixed rules first
- then apply percent rules against remaining income
- respect `minAmount` / `capAmount`
- keep manual overrides (`isOverride = true`) untouched
- optional leftover can go to a `Buffer` category when present

## Interfaces Introduced

New tRPC routers:
- `budgetPeriod.*`
- `budgetRule.*`
- `budgetAllocation.*`
- `incomePlanItem.*`
- `creditCardStatement.*`
- `installment.*`

These are additive and keep existing core routers available.

## Constraints and Invariants

- One statement per card-period (`accountId + periodStart + periodEnd` unique).
- One allocation per period/category (`budgetPeriodId + categoryId` unique).
- One installment number per plan (`installmentPlanId + installmentNumber` unique).
- Planning entities are user-scoped either directly or via parent entity ownership.

## Future Extension Hooks

Not implemented yet, but schema-ready:
- carryover interest/fees per statement cycle
- allocation of one payment across multiple statements
- debt instruments beyond card installments (vehicle/personal loans)
