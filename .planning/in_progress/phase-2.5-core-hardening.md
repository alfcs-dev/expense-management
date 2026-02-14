# Phase 2.5 — Core Hardening (Immediate)

> **Source context:** Revised from `.planning/PLAN.md` to prioritize a stable core product before advanced feature expansion.

**Planning Metadata**
- Status: in_progress
- Owner: @alfcs
- Baseline branch: `main`
- Start date: 2026-02-14
- Target end: TBD
- Dependencies: Phase 2 complete on `main`
- Linked branches: `phase-3-advanced-features` (parked/deferred)

---

## 1. Objective

Deliver and deploy a stable core experience where a user can:
1. Sign in.
2. Create accounts/cards.
3. Create/select monthly budgets.
4. Configure recurring payments.
5. Add manual expenses.
6. See planned vs actual on dashboard.

This phase also introduces direct API testing assets and a minimal automated API smoke suite.

---

## 2. Scope

### In scope
- Auth/session reliability for core routes.
- Accounts/cards CRUD UX and validation.
- Explicit budget management UI (`/budgets`) and budget discoverability.
- Recurring expenses CRUD with clear monthly planning behavior.
- Manual expenses CRUD by selected budget month.
- Dashboard planned vs actual monthly visibility.
- Postman-first direct API testing support.
- Basic automated API smoke tests for core lifecycle.
- Core UI consistency pass and deployment gate checklist.

### Out of scope (deferred)
- Installments (MSI).
- Transfers and savings goals.
- Imports (CSV/OFX/CFDI).
- Auto-categorization rules.
- Advanced reporting/export extensions beyond current core need.

---

## 3. Locked Decisions

- Baseline remains `main` (Phase 2 core).
- `phase-3-advanced-features` remains parked (no destructive rollback required).
- API testing approach is Postman-first.
- Execution model is vertical slices: backend + UI + acceptance checks per area.
- UI library decision for this phase: keep `shadcn/ui` direction (no component library migration now).

---

## 4. Delivery Plan (Vertical Slices)

### Slice A — Budget Visibility + Core Flow Completion

- [x] Add/confirm budget API surface:
  - [x] `budget.create({ month, year, name? })`
  - [x] `budget.listByYear({ year })`
  - [x] Keep `budget.getOrCreateForMonth` and `budget.getPlannedByCategory`
- [x] Add `/budgets` route:
  - [x] List monthly budgets for selected year
  - [x] Create/select month budget
  - [x] Link to `/expenses` and `/dashboard` for selected month/year
- [x] Keep implicit budget creation in expenses flow as fallback

**Slice A done when**
- User can explicitly create/select a budget month before adding recurring/manual expenses.

### Slice B — Direct API Testing (Postman)

- [x] Add Postman assets:
  - [x] `tools/postman/ExpenseManager.postman_collection.json`
  - [x] `tools/postman/ExpenseManager.local.postman_environment.json`
- [x] Add docs:
  - [x] `docs/API_TESTING.md`
- [x] Include requests for:
  - [x] `/health`
  - [x] auth signup/signin/signout/session
  - [x] account/category/recurring/budget/expense core procedures
- [x] Add cookie/session script handling to collection where needed

**Slice B done when**
- A developer can run the complete core lifecycle from Postman against localhost.

### Slice C — Basic Automated API Smoke Tests

- [ ] Add API smoke test harness (Fastify inject + Vitest or equivalent)
- [ ] Add `pnpm test:api` entrypoint and CI hook
- [ ] Cover minimum scenarios:
  - [ ] health endpoint
  - [ ] protected route unauthorized behavior
  - [ ] authenticated create/list flow for account, budget, recurring, manual expense

**Slice C done when**
- Smoke tests pass locally and in CI.

### Slice D — Core UI Quality Pass

- [ ] Core routes quality pass:
  - [ ] `/accounts`
  - [ ] `/categories`
  - [ ] `/budgets`
  - [ ] `/recurring-expenses`
  - [ ] `/expenses`
  - [ ] `/dashboard`
- [ ] For each route ensure:
  - [ ] loading/empty/error/success states
  - [ ] consistent spacing/labels/form affordances
  - [ ] locale-consistent money/date formatting
  - [ ] mobile baseline usability
- [ ] Add checklist doc:
  - [ ] `docs/UI_ACCEPTANCE_CHECKLIST.md`

**Slice D done when**
- Core route checklist is complete and QAable by any developer.

### Slice E — Core Deployment Milestone

- [ ] Validate gate:
  - [ ] `pnpm lint`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm build`
  - [ ] `pnpm test:api`
- [ ] Manual smoke:
  - [ ] login
  - [ ] create account
  - [ ] create/select budget month
  - [ ] create recurring payment
  - [ ] create manual expense
  - [ ] dashboard reflects change
- [ ] Tag/release target:
  - [ ] `v0-core-stable`

**Slice E done when**
- Core deploy checklist passes and release can be promoted.

---

## 5. Reintroduction Sequence After Core Stable

After `v0-core-stable`, reintroduce deferred features in this order:
1. Installments (MSI)
2. Imports (CSV/OFX, then CFDI)
3. Auto-categorization
4. Transfers + savings goals
5. Advanced reports/export enhancements

Each reintroduced feature must ship as vertical slice with:
- API + UI + validation/tests + planning/doc updates.

---

## 6. Validation and Acceptance

### Automated
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:api`

### Manual
- Core journey can be completed without dead ends.
- Session expiry redirects are graceful.
- API lifecycle is reproducible from Postman.

---

## 7. Risks and Mitigations

- Risk: scope creep from deferred advanced features.
  - Mitigation: enforce out-of-scope list and reintroduction sequence.
- Risk: inconsistent UI polish across routes.
  - Mitigation: single shared checklist and route-by-route closure.
- Risk: API testing docs diverge from reality.
  - Mitigation: update Postman collection in same PR as endpoint changes.

---

## 8. In Progress Log

**Achievements**
- 2026-02-14: Phase 2.5 plan created; baseline reset to `main` and core-hardening track initiated.
- 2026-02-14: Slice A completed on branch `phase-2.5-core-hardening`.
  - Added budget API procedures: `budget.create` and `budget.listByYear`.
  - Added `/budgets` route with create/list year filter and deep links to expenses/dashboard by month/year.
  - Updated nav + EN/ES i18n for budgets.
  - Added month/year URL query parsing in `/expenses` and `/dashboard` for budget-context navigation.
  - Validation complete: `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass.
- 2026-02-14: Slice B completed on branch `phase-2.5-core-hardening`.
  - Added Postman collection and local environment for core auth + API lifecycle.
  - Added `docs/API_TESTING.md` with exact execution order and troubleshooting notes.
  - Added cookie/session handling scripts to collection requests to simplify authenticated tRPC testing.

**Decisions**
- 2026-02-14: Keep `shadcn/ui` direction for this phase; do not migrate component library.
- 2026-02-14: Postman-first API testing selected over Swagger-first for immediate execution speed.
- 2026-02-14: Vertical-slice delivery selected over backend-first or dual-track mock divergence.

**Roadblocks**
- None yet.
