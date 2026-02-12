# Phase 2 — Core Features (Weeks 3–5)

> **Source:** [PLAN.md](../PLAN.md) Section 6, Phase 2.  
> **When starting this phase:** move this file to `../in_progress/` and use the "In progress" section at the bottom to log achievements, decisions, and roadblocks.

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

- [ ] tRPC procedures: `account.list`, `account.create`, `account.update`, `account.delete`. All scoped by `ctx.user.id`.
- [ ] Input validation (Zod): name, type (debit/credit/investment/cash), currency (MXN/USD), optional institution, balance.
- [ ] Web: account list, create/edit form, delete with confirmation. Display balance and currency with proper formatting (centavos → display units).

### 3.2 Category management

- [ ] tRPC procedures: `category.list`, `category.create`, `category.update`, `category.delete`, `category.reorder` (sortOrder).
- [ ] Seed or migrate default categories from PLAN (Kids, Subscriptions, Telecom, Savings, Auto, Home/Zuhause, Miscellaneous) if not already in seed.
- [ ] Web: category list, create/edit (name, icon, color, sortOrder), reorder UI.

### 3.3 Recurring expense templates

- [ ] tRPC procedures: `recurringExpense.list`, `recurringExpense.create`, `recurringExpense.update`, `recurringExpense.delete`.
- [ ] Model: categoryId, sourceAccountId, destAccountId (optional), description, amount (centavos), currency, frequency (monthly/biweekly/annual/bimonthly), isAnnual, annualCost, notes, isActive. See [SCHEMA_VISUALIZATION.md](../docs/SCHEMA_VISUALIZATION.md).
- [ ] Web: list of templates, create/edit form with category and account dropdowns, frequency selector, amount in display units.

### 3.4 Monthly budget generation

- [ ] Logic: given a month/year, generate or return a Budget for the user. Create from templates: for each RecurringExpense, create placeholder or actual Expense rows (or a separate "budget line" concept if you prefer) so that "planned" amounts per category are known.
- [ ] Clarify in implementation: either Budget is a container and "budget lines" are derived from RecurringExpense, or Budget has explicit budgeted amounts per category. PLAN suggests "monthly budget generation from templates" — so templates drive the planned view.
- [ ] tRPC: e.g. `budget.getOrCreateForMonth({ month, year })`, `budget.getPlannedByCategory({ budgetId })`.

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
- 

**Decisions:**
- 

**Roadblocks:**
- 
