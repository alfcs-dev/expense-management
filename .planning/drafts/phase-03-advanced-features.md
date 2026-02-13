# Phase 3 — Advanced Features (Weeks 6–8)

> **Source:** [PLAN.md](../PLAN.md) Section 6, Phase 3.  
> **When starting this phase:** move this file to `../in_progress/` and use the "In progress" section at the bottom to log achievements, decisions, and roadblocks.

**Planning Metadata**
- Status: draft
- Owner: @alfcs
- Target start: Week 6
- Target end: Week 8
- Actual start: TBD
- Actual end: TBD
- Dependencies: Phase 2 complete
- Linked PRs/issues: TBD

---

## 1. Goals

- Installment plans (MSI): create plans and auto-generate future monthly expenses.
- Transfer tracking between accounts.
- Savings goals with progress (percentage-based allocation).
- Annual expense proration (show monthly equivalent for annual charges).
- Reports and charts (monthly/annual trends, category breakdowns).
- Data import: CSV/OFX bank statements; CFDI XML upload with parsing.
- Basic auto-categorization (rule-based on merchant name/RFC).
- Data export (CSV).

---

## 2. Prerequisites

- Phase 2 complete: accounts, categories, recurring expenses, budgets, manual expenses, dashboard, i18n.

---

## 3. What's needed (task breakdown)

### 3.1 Installment plans (MSI)

- [ ] tRPC: `installmentPlan.create`, `installmentPlan.list`, `installmentPlan.update`, `installmentPlan.cancel`.
- [ ] Model: accountId (credit card), categoryId, description, totalAmount, currency, months, interestRate, startDate, status. See schema.
- [ ] On create (or on "confirm"): generate N expense records (one per month), linked via `installmentPlanId` and `installmentNumber`; amount = totalAmount / months (or with interest if needed). Dates based on startDate.
- [ ] Web: create MSI form (description, total, months, start date, account, category); list of plans; view/edit/cancel. Show generated installments in expense list.

### 3.2 Transfers

- [ ] tRPC: `transfer.create`, `transfer.list`, `transfer.update`, `transfer.delete`.
- [ ] Model: sourceAccountId, destAccountId, amount, currency, date, notes.
- [ ] Web: list transfers, add transfer form (source, dest, amount, date). Optionally show in dashboard or account view (movements).

### 3.3 Savings goals

- [ ] tRPC: `savingsGoal.list`, `savingsGoal.create`, `savingsGoal.update`, `savingsGoal.delete`.
- [ ] Model: accountId, name, targetPercentage (e.g. 11%), targetAmount (optional), currency, notes.
- [ ] Progress: compute current balance or sum of contributions toward goal (if you track contributions explicitly) vs target. Display progress bar; percentage-based allocation from income if desired.
- [ ] Web: list goals, create/edit, progress display.

### 3.4 Annual expense proration

- [ ] In dashboard or reports: for recurring expenses with isAnnual/annualCost, show monthly equivalent (annualCost/12) in summaries and in "planned" views.
- [ ] Ensure RecurringExpense list and budget view show prorated monthly amount for annual items.

### 3.5 Reports and charts

- [ ] tRPC: procedures for monthly trends (e.g. by month, by category), annual summary, category breakdown over time.
- [ ] Web: reports page(s): monthly comparison, annual view, category breakdown (bar/pie/line). Use Recharts or Tremor; support date range and granularity (month/week if needed).

### 3.6 Data import — CSV/OFX

- [ ] Upload endpoint or tRPC procedure: accept file (CSV or OFX), parse transactions (date, amount, description, account hint).
- [ ] Map to StagedTransaction or directly to Expense with source = 'csv'/'ofx'. If using staging, keep Phase 6 design in mind; for Phase 3, simple direct import may be enough (document that Phase 6 will add deduplication).
- [ ] Web: upload UI, preview parsed rows, map columns to account/category, confirm import.

### 3.7 Data import — CFDI XML

- [ ] Use `@nodecfdi/cfdi-to-json` (or similar) to parse CFDI XML; extract issuer, amount, tax, UUID, date.
- [ ] Create Expense with source = 'cfdi', cfdiUuid, and store parsed data in cfdiData (or minimal fields). Optionally stage first and match (Phase 6); for Phase 3, direct create is acceptable.
- [ ] Web: upload XML, show parsed summary, select account/category, import.

### 3.8 Basic auto-categorization

- [ ] Rule-based: CategoryMapping or in-memory rules: match merchant name (substring/regex) or RFC to a categoryId.
- [ ] Apply on import (CSV/OFX/CFDI): suggest or assign category from rules. Allow user to override.
- [ ] Simple UI to add/edit rules (merchant name or RFC → category).

### 3.9 Data export (CSV)

- [ ] tRPC procedure or endpoint: export expenses (and optionally transfers) for a date range in CSV format. Include category, account, amount, date, description.
- [ ] Web: "Export" button on reports or dashboard; download CSV.

---

## Definition of Ready (DoR)

- [ ] Required schema/docs for this phase are finalized.
- [ ] External vendor/provider decisions are finalized (if applicable).
- [ ] Required environment variables and secrets are confirmed.
- [ ] Validation plan is agreed (`pnpm lint`, `pnpm typecheck`, smoke checks, and any relevant performance checks).

---

## 4. How to achieve it

### 4.1 Key references

- [PLAN.md](../PLAN.md) — Section 5 (schema: InstallmentPlan, Transfer, SavingsGoal); Section 6 Phase 3 and Phase 6 (import/staging).
- [docs/SCHEMA_VISUALIZATION.md](../docs/SCHEMA_VISUALIZATION.md) — InstallmentPlan, Transfer, SavingsGoal, Expense (source, cfdiUuid, cfdiData), CategoryMapping.
- [docs/DEDUPLICATION_RECONCILIATION.md](../docs/DEDUPLICATION_RECONCILIATION.md) — StagedTransaction and matching; Phase 3 can do simple direct import and add staging in Phase 6.

### 4.2 Suggested order

1. InstallmentPlan CRUD + expense generation (API then UI).
2. Transfer CRUD (API + UI).
3. SavingsGoal CRUD + progress calculation (API + UI).
4. Annual proration in dashboard/planned views.
5. Reports API (aggregations, trends) + reports UI with charts.
6. CSV/OFX import (parser, mapping, import) + upload UI.
7. CFDI XML import (parser, create expense) + upload UI.
8. Auto-categorization rules (store + apply on import) + rules UI.
9. CSV export.

### 4.3 Technical notes

- **MSI expense generation:** Create expenses with `installmentPlanId` and `installmentNumber` (1..N). Consider timezone for startDate when generating due dates.
- **StagedTransaction:** If you introduce it in Phase 3, you can match later in Phase 6; otherwise import directly and add staging in Phase 6.
- **CFDI:** Store at least UUID, total, date, RFC for future reconciliation.

---

## 5. Decisions to make

- Whether to implement staging (StagedTransaction) in Phase 3 or only in Phase 6.
- OFX parsing: use a library (e.g. ofx4js or manual parse) and support level (full OFX vs simple CSV-like export from bank).
- Savings goal "current" value: from account balance vs from a separate contribution log.

---

## 6. Possible roadblocks

- OFX format variants (different banks); may need to support only one format or CSV first.
- CFDI encoding and namespaces; ensure @nodecfdi handles your sample files.
- Report performance with large date ranges; add limits or pagination and indexes.

---

## 7. Definition of done

- [ ] MSI plans create future expenses; user can see and manage installments.
- [ ] Transfers CRUD and visible in app.
- [ ] Savings goals with target and progress display.
- [ ] Annual expenses show monthly equivalent in relevant views.
- [ ] Reports page with trends and category breakdowns; charts render correctly.
- [ ] CSV/OFX and CFDI import working; user can map and import.
- [ ] Auto-categorization rules applicable on import; rules editable.
- [ ] CSV export for expenses (date range) works.

---

## 8. In progress (use after moving to in_progress)

*When you start Phase 3, move this file to `../in_progress/` and fill below.*

**Achievements:**
- 

**Decisions:**
- 

**Roadblocks:**
- 
