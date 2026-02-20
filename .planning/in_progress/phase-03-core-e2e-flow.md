# Phase 3 — Core End-to-End Finance Flow

> **Source context:** Rebased priority phase to complete operational core flow before advanced extensions.

**Planning Metadata**
- Status: in_progress
- Owner: @alfcs
- Baseline branch: `phase-2.6-finance-v2`
- Start date: 2026-02-20
- Target end: TBD
- Dependencies: Phase 2.6 stabilization baseline
- Linked predecessor: `.planning/in_progress/phase-2.6-finance-v2.md`

---

## 1. Objective

Ship a complete user flow where a user can authenticate, set up core finance entities (accounts/categories/budgets/bills), track transactions including paid status, and see the consolidated state in dashboard.

---

## 2. Locked Scope

- Auth register/login remains Better Auth based.
- Required account setup supports debit + `credit_card` with opening balance snapshot integrity.
- Category hierarchy supported with bootstrap minimum income tree:
  - `Income` parent
  - `Salary`, `Deposit`, `Other` children
- Transaction CRUD supports status updates (`paid` / `pending`).
- Bills support recurring templates and per-month occurrences with status.
- Budget flow supports period, rules, and generated allocations.
- Dashboard must show:
  - account balances
  - budget vs actual by category
  - upcoming/unpaid bills
  - recent transactions

---

## 3. Delivery Checklist

- [x] Add transaction paid fields and API mutation.
- [x] Add bill occurrences model and bill management API.
- [x] Add dashboard summary API for the four required blocks.
- [x] Add web routes for categories, budgets, and bills.
- [x] Upgrade dashboard page to show aggregated operational data.
- [x] Upgrade transactions page to support paid toggle and quick edit.
- [x] Reindex planning drafts by +1 phase due to new Phase 3 insertion.
- [ ] Run full workspace validation (`lint`, `typecheck`, `build`, `api test`).

---

## 4. Validation Status

- Pending run in this phase implementation cycle:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm build`
  - `pnpm --filter @expense-management/api test`

---

## 5. In Progress Log

**Achievements**
- 2026-02-20: Implemented schema and API foundations for paid transactions + bill occurrences.
- 2026-02-20: Added `bill` and `dashboard` routers and wired into tRPC root.
- 2026-02-20: Added `/categories`, `/budgets`, `/bills` routes and replaced placeholder dashboard with summary view.
- 2026-02-20: Reindexed draft phases to shift advanced work one step later.

**Decisions**
- Transaction paid status modeled directly on `transactions`.
- Bills modeled as templates + monthly occurrences with explicit status transitions.
- Dashboard uses a consolidated summary endpoint instead of piecemeal client-side joins.

**Roadblocks**
- None currently blocking implementation.
