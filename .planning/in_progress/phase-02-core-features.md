# Phase 2 — Core Features (Weeks 3–5)

> **Source:** [PLAN.md](../PLAN.md) Section 6, Phase 2.  
> **Tracking rule:** use the "In progress" section at the bottom to log achievements, decisions, and roadblocks.

**Planning Metadata**
- Status: in_progress
- Owner: @alfcs
- Target start: Week 3
- Target end: Week 5
- Actual start: 2026-02-14
- Actual end: TBD
- Dependencies: Phase 1 complete
- Linked PRs/issues: TBD

---

## 1. Goals

- Full CRUD for accounts and categories (with MXN/USD).
- Recurring expense templates (budget "plan") with account routing and frequency.
- Monthly budget generation from templates.
- Manual expense logging and dashboard: monthly overview, income vs expenses, category totals, budget vs actual.
- Spanish translation file and complete i18n for Phase 2 scope.

---

## 2. Prerequisites

- Phase 1 complete: monorepo, API, web, auth, i18n, seed, Docker, CI.
- Prisma schema includes Account, Category, Budget, RecurringExpense, Expense (and User).

---

## 3. What's needed (task breakdown)

### 3.1 Account management

- [x] tRPC procedures: `account.list`, `account.create`, `account.update`, `account.delete`. All scoped by `ctx.user.id`.
- [x] Input validation (Zod): name, type (debit/credit/investment/cash), currency (MXN/USD), optional institution, balance.
- [x] Web: account list, create/edit form, delete with confirmation. Display balance and currency with proper formatting (centavos → display units).
- [x] Scope adjustment: add CLABE-driven institution behavior required by product rules:
  - `debit`: valid CLABE required; institution inferred from CLABE; institution selector locked.
  - `credit`: institution selector enabled by default; CLABE optional; if CLABE is valid, infer institution and lock selector.
  - Institution selector remains disabled until account type is chosen.
- [x] Scope adjustment: replace static institution constants with dynamic catalog:
  - Add `InstitutionCatalog` table and Banxico sync command (`pnpm db:sync:institutions`).
  - Add weekly production sync requirement to deployment runbook.
  - Use DB-backed catalog in API/UI for dropdown options and CLABE inference.

### 3.2 Category management

- [x] tRPC procedures: `category.list`, `category.create`, `category.update`, `category.delete`, `category.reorder` (sortOrder).
- [x] Verify seeded default categories from PLAN (Kids, Subscriptions, Telecom, Savings, Auto, Home/Zuhause, Miscellaneous) and add any missing ones via migration/seed if needed.
- [x] Web: category list, create/edit (name, icon, color, sortOrder), reorder UI.

### 3.3 Recurring expense templates

- [x] tRPC procedures: `recurringExpense.list`, `recurringExpense.create`, `recurringExpense.update`, `recurringExpense.delete`.
- [x] Model: categoryId, sourceAccountId, destAccountId (optional), description, amount (centavos), currency, frequency (monthly/biweekly/annual/bimonthly), isAnnual, annualCost, notes, isActive. See [SCHEMA_VISUALIZATION.md](../docs/SCHEMA_VISUALIZATION.md).
- [x] Web: list of templates, create/edit form with category and account dropdowns, frequency selector, amount in display units.

### 3.4 Monthly budget generation

- [x] Logic: given a month/year, generate or return a Budget for the user. Create from templates: for each RecurringExpense, create placeholder or actual Expense rows (or a separate "budget line" concept if you prefer) so that "planned" amounts per category are known.
- [x] Clarify in implementation: either Budget is a container and "budget lines" are derived from RecurringExpense, or Budget has explicit budgeted amounts per category. PLAN suggests "monthly budget generation from templates" — so templates drive the planned view.
- [x] tRPC: e.g. `budget.getOrCreateForMonth({ month, year })`, `budget.getPlannedByCategory({ budgetId })`.

### 3.5 Expense logging (manual)

- [ ] tRPC: `expense.create`, `expense.update`, `expense.delete`, `expense.list` (filter by budgetId, categoryId, date range).
- [ ] Input: budgetId, categoryId, accountId, description, amount, currency, date. source = 'manual'.
- [ ] Web: expense list (per budget/month), add expense form, edit/delete. Link to budget and category.

### 3.6 Dashboard

- [ ] Monthly overview: total income (from recurring or a simple income concept), total expenses, per-category totals.
- [ ] Budget vs actual: planned (from recurring templates) vs actual (sum of expenses) per category; variance or progress bar.
- [ ] Month selector; ensure data is scoped to selected month and user.
- [ ] Use Recharts or Tremor for simple charts (e.g. category breakdown pie/bar).

### 3.7 Spanish i18n

- [ ] Add `es.json` with all keys from `en.json` translated.
- [ ] Ensure language switcher (if present) and locale detection work; currency/date formatting use `es-MX` when Spanish is selected.

---

## Definition of Ready (DoR)

- [ ] Required schema/docs for this phase are finalized.
- [ ] External vendor/provider decisions are finalized (if applicable).
- [x] Required environment variables and secrets are confirmed.
- [x] Validation plan is agreed (`pnpm lint`, `pnpm typecheck`, smoke checks, and any relevant performance checks).

---

## 4. How to achieve it

### 4.1 Key references

- [PLAN.md](../PLAN.md) — Section 5 (schema), Section 3.10 (charts: Recharts/Tremor).
- [docs/SCHEMA_VISUALIZATION.md](../docs/SCHEMA_VISUALIZATION.md) — Account, Category, Budget, RecurringExpense, Expense field definitions.
- Income: PLAN mentions biweekly salary; model as recurring income (e.g. RecurringExpense with type "income" or a separate Income entity). If not in schema yet, use a category or flag for "income" and sum those as income for the dashboard.

### 4.2 Suggested order

1. Account CRUD (API + UI).
2. Category CRUD + default categories (API + UI).
3. RecurringExpense CRUD (API + UI).
4. Budget getOrCreate + "planned" derivation from templates (API).
5. Expense CRUD and list (API + UI).
6. Dashboard: aggregates, budget vs actual, charts (API procedures + web dashboard page).
7. Spanish translations and locale wiring.

### 4.3 Technical notes

- **Amounts:** Always store and pass centavos/cents as integers; convert to display (e.g. MXN / 100) only in UI. Use shared formatters (e.g. from `packages/shared` or i18n).
- **Budget vs actual:** "Planned" = sum of recurring template amounts (adjusted for frequency: e.g. annual/12 for monthly equivalent). "Actual" = sum of expenses in that budget/month per category.
- **Income:** If RecurringExpense doesn't distinguish income, add an `isIncome` or use a dedicated "Income" category and treat positive amounts as income in dashboard math.

---

## 5. Decisions to make

- Whether "budget" is a single record per user per month with derived planned amounts, or has explicit budget-line records.
- How to represent income in the schema (recurring income entries vs a separate table).
- Default categories: seed in Phase 1 vs Phase 2 migration; exact names and icons.

---

## 6. Possible roadblocks

- Frequency math: biweekly vs monthly (e.g. 2 payments per month); annual proration (annualCost/12). Edge cases for partial months.
- Dashboard performance: if aggregations are slow, add DB indexes (userId, budgetId, date) and consider simple caching later.

---

## 7. Definition of done

- [ ] Accounts and categories full CRUD in UI; currency and balance displayed correctly.
- [ ] Recurring expense templates with account routing and frequency; list and edit in UI.
- [ ] Selecting a month shows a budget (created or existing) with planned amounts from templates.
- [ ] Manual expenses can be added/edited/deleted and appear in the dashboard.
- [ ] Dashboard shows monthly income vs expenses, category breakdown, and budget vs actual.
- [ ] Spanish language available and all Phase 2 strings translated.

---

## 8. In progress (use after moving to in_progress)

*When you start Phase 2, move this file to `../in_progress/` and fill below.*

**Achievements:**
- Phase 2 started on 2026-02-14 after Phase 1 closure and successful CI validation path (lint, typecheck, build on push/PR).
- 3.1 account management implemented end-to-end:
  - tRPC `account` router added with `list/create/update/delete` and strict user scoping.
  - Zod input validation added for account payloads (name/type/currency/institution/balance).
  - Web route `/accounts` added with list, create/edit form, delete confirmation, and formatted balances/currency.
  - Navigation updated to include Accounts.
  - Validation complete: `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass.
- 3.1 iteration: institution/CLABE flow now enforced for Mexican accounts:
  - Dynamic institution catalog added with Banxico sync job (`db:sync:institutions`) and DB-backed dropdown source.
  - Institution inference from CLABE now resolves against the synced catalog in backend and frontend.
  - Debit accounts now require valid CLABE and infer institution automatically.
  - Credit accounts allow either manual institution selection or CLABE-based auto-inference (with institution lock when inferred).
  - Accounts UI now uses institution dropdown catalog and type-driven enable/disable rules.
  - `InstitutionCatalog` Prisma model and migration added to store institution code/name/source/active state and support catalog evolution over time.
  - New backend endpoint `account.institutions` added so the web account form reads live institution options from DB instead of hardcoded constants.
  - Banxico sync script implemented at `packages/db/scripts/sync-institutions.ts` and exposed as `pnpm db:sync:institutions`.
  - Documentation updated for operations: initial sync in local setup and weekly sync schedule in DigitalOcean deployment runbook.
- 3.2 category management implemented end-to-end:
  - tRPC `category` router added with `list/create/update/delete/reorder`, fully scoped by authenticated user.
  - Web route `/categories` added with category list, create/edit/delete flow, and move up/down reorder controls.
  - Navigation updated to include Categories and i18n strings added to `en.json`.
  - Seed process updated to guarantee PLAN default categories are present (`Kids`, `Subscriptions`, `Telecom`, `Savings`, `Auto`, `Home/Zuhause`, `Miscellaneous`) while preserving CSV-derived categories.
- 3.3 recurring expense templates implemented end-to-end on 2026-02-14:
  - tRPC `recurringExpense` router added with `list/create/update/delete`, strict user scoping, and ownership validation for related category/accounts.
  - Web route `/recurring-expenses` added with template list, create/edit form, delete confirmation, frequency selector, and account/category dropdowns.
  - Navigation and i18n updated with recurring-template strings and route access from the top nav.
  - Validation complete: `pnpm lint` and `pnpm typecheck` pass after implementation.
- 3.4 monthly budget generation API implemented on 2026-02-14:
  - tRPC `budget` router added with `getOrCreateForMonth` (user-scoped upsert by `{ userId, month, year }`).
  - Added `budget.getPlannedByCategory({ budgetId })` to derive planned values from active recurring templates.
  - Planned totals are returned grouped by category with currency-safe sums (`MXN` and `USD` separated) and overall totals.
  - Validation complete: `pnpm lint` and `pnpm typecheck` pass after implementation.

**Decisions:**
- Replaced static, code-embedded institution lists with a synced catalog from Banxico as source of truth.
- Adopted an operational sync model (weekly cron in infrastructure) rather than shipping institution changes in code releases.
- Kept CLABE validation local/algorithmic, but institution naming and availability externalized to the DB catalog.
- 2026-02-14: kept recurring templates user-owned (no shared/global template table yet) and enforced ownership checks in API for `categoryId`, `sourceAccountId`, and `destAccountId`.
- 2026-02-14: required `annualCost` only when `isAnnual=true` to keep monthly templates simple while preserving annual-proration data for later dashboard/budget math.
- 2026-02-14: introduced a dedicated `/recurring-expenses` page now (instead of embedding inside dashboard) to reduce coupling and keep future budget-generation work focused on API logic.
- 2026-02-14: implemented budget as a month container plus derived planned lines from `RecurringExpense` instead of persisting separate budget-line rows; this avoids duplicate source-of-truth data during Phase 2.
- 2026-02-14: applied frequency normalization in API (`biweekly=26/12`, `bimonthly=1/2`, annual templates prorated by `annualCost/12` fallback to `amount/12`) so planned values are month-comparable.
- 2026-02-14: returned planned aggregates split by currency to prevent mixing MXN and USD into a single misleading total.

**Roadblocks:**
- `pnpm db:migrate` uses `prisma migrate dev` (interactive), which can block automation; non-interactive flows should use migrate deploy semantics for server jobs.

**Why these changes were made:**
- Static institution catalogs are high-maintenance and become stale when institutions are renamed, added, or retired.
- A dynamic sync reduces product drift, avoids frequent app redeploys for catalog updates, and keeps CLABE inference aligned with current Banxico institution data.
- DB-backed cataloging also provides auditability (`lastSeenAt`, `isActive`, `source`) and safer behavior when provider data changes unexpectedly.
- Recurring templates are a core input for upcoming budget generation and needed isolated CRUD first to unblock Phase 2 steps 3.4, 3.5, and 3.6.
- Enforcing ownership on related foreign keys prevents cross-user reference bugs and keeps data boundaries consistent with existing account/category routers.
- Derived budget planning keeps recurring templates authoritative, reducing mutation complexity and making recalculation deterministic as templates are edited.
- Currency-separated aggregates preserve financial correctness before any FX conversion rules are introduced.

**Operational follow-up (required for this scope):**
- Run `pnpm db:sync:institutions` after migrations in each environment.
- Configure weekly sync in production (documented in `docs/DEPLOYMENT_DO.md`) and monitor sync logs.
