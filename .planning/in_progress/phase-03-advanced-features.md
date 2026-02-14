# Phase 3 — Advanced Features (Weeks 6–8)

> **Source:** [PLAN.md](../PLAN.md) Section 6, Phase 3.  
> **When starting this phase:** move this file to `../in_progress/` and use the "In progress" section at the bottom to log achievements, decisions, and roadblocks.

**Planning Metadata**
- Status: in_progress
- Owner: @alfcs
- Target start: Week 6
- Target end: Week 8
- Actual start: 2026-02-14
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

- [x] tRPC: `installmentPlan.create`, `installmentPlan.list`, `installmentPlan.update`, `installmentPlan.cancel`.
- [x] Model: accountId (credit card), categoryId, description, totalAmount, currency, months, interestRate, startDate, status. See schema.
- [x] On create (or on "confirm"): generate N expense records (one per month), linked via `installmentPlanId` and `installmentNumber`; amount = totalAmount / months (or with interest if needed). Dates based on startDate.
- [x] Web: create MSI form (description, total, months, start date, account, category); list of plans; view/edit/cancel. Show generated installments in expense list.

### 3.2 Transfers

- [x] tRPC: `transfer.create`, `transfer.list`, `transfer.update`, `transfer.delete`.
- [x] Model: sourceAccountId, destAccountId, amount, currency, date, notes.
- [x] Web: list transfers, add transfer form (source, dest, amount, date). Optionally show in dashboard or account view (movements).

### 3.3 Savings goals

- [x] tRPC: `savingsGoal.list`, `savingsGoal.create`, `savingsGoal.update`, `savingsGoal.delete`.
- [x] Model: accountId, name, targetPercentage (e.g. 11%), targetAmount (optional), currency, notes.
- [x] Progress: compute current balance or sum of contributions toward goal (if you track contributions explicitly) vs target. Display progress bar; percentage-based allocation from income if desired.
- [x] Web: list goals, create/edit, progress display.

### 3.4 Annual expense proration

- [x] In dashboard or reports: for recurring expenses with isAnnual/annualCost, show monthly equivalent (annualCost/12) in summaries and in "planned" views.
- [x] Ensure RecurringExpense list and budget view show prorated monthly amount for annual items.

### 3.5 Reports and charts

- [x] tRPC: procedures for monthly trends (e.g. by month, by category), annual summary, category breakdown over time.
- [x] Web: reports page(s): monthly comparison, annual view, category breakdown (bar/pie/line). Use Recharts or Tremor; support date range and granularity (month/week if needed).

### 3.6 Data import — CSV/OFX

- [x] Upload endpoint or tRPC procedure: accept file (CSV or OFX), parse transactions (date, amount, description, account hint).
- [x] Map to StagedTransaction or directly to Expense with source = 'csv'/'ofx'. If using staging, keep Phase 6 design in mind; for Phase 3, simple direct import may be enough (document that Phase 6 will add deduplication).
- [x] Web: upload UI, preview parsed rows, map columns to account/category, confirm import.

### 3.7 Data import — CFDI XML

- [x] Use `@nodecfdi/cfdi-to-json` (or similar) to parse CFDI XML; extract issuer, amount, tax, UUID, date.
- [x] Create Expense with source = 'cfdi', cfdiUuid, and store parsed data in cfdiData (or minimal fields). Optionally stage first and match (Phase 6); for Phase 3, direct create is acceptable.
- [x] Web: upload XML, show parsed summary, select account/category, import.

### 3.8 Basic auto-categorization

- [x] Rule-based: CategoryMapping or in-memory rules: match merchant name (substring/regex) or RFC to a categoryId.
- [x] Apply on import (CSV/OFX/CFDI): suggest or assign category from rules. Allow user to override.
- [x] Simple UI to add/edit rules (merchant name or RFC → category).

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

**Achievements:**
- Phase 3 started on 2026-02-14 on branch `phase-3-advanced-features` after Phase 2 merge to `main`.
- 3.1 installment plans implemented end-to-end on 2026-02-14:
  - tRPC `installmentPlan` router added with `list/create/update/cancel`, scoped by authenticated user.
  - Installment creation and updates auto-generate monthly `Expense` rows (`source=installment`) with `installmentPlanId` and `installmentNumber`.
  - Added `/installments` web route with create/edit/cancel workflow and generated-expenses visibility.
  - Navigation and i18n resources updated in EN/ES to expose the new Phase 3 surface.
  - Validation complete: `pnpm lint` and `pnpm typecheck` pass.
- 3.2 transfers implemented end-to-end on 2026-02-14:
  - tRPC `transfer` router added with `list/create/update/delete`, fully user-scoped with ownership checks on source/destination accounts.
  - Added `/transfers` web route with create/edit/delete workflow and transfer list.
  - Navigation and i18n resources updated in EN/ES.
  - Validation complete: `pnpm lint` and `pnpm typecheck` pass.
- 3.3 savings goals implemented end-to-end on 2026-02-14:
  - tRPC `savingsGoal` router added with `list/create/update/delete`, fully user-scoped with owned-account validation.
  - Goal list returns derived progress (`currentAmount`, `targetAmount`, ratio) based on linked account balance.
  - Added `/savings-goals` web route with create/edit/delete flow and progress display.
  - Navigation and i18n resources updated in EN/ES.
  - Validation complete: `pnpm lint` and `pnpm typecheck` pass.
- 3.4 annual expense proration implemented on 2026-02-14:
  - Confirmed planned-budget aggregation already applies annual monthly-equivalent math (`annualCost/12` fallback to `amount/12`) in `budget.getPlannedByCategory`.
  - Recurring templates UI now displays annual cost and monthly-equivalent values for annual items.
  - Added EN/ES labels for annual-cost and monthly-equivalent presentation.
  - Validation complete: `pnpm lint` and `pnpm typecheck` pass.
- 3.5 reports and charts implemented on 2026-02-14:
  - tRPC `report` router added with `monthlyTrend`, `annualSummary`, and `categoryBreakdown`.
  - Added `/reports` route with range selectors and Recharts visuals (monthly bar chart, category pie chart) plus annual summary blocks.
  - Navigation and i18n resources updated in EN/ES.
  - Validation complete: `pnpm lint` and `pnpm typecheck` pass.
- 3.6 CSV/OFX import implemented on 2026-02-14:
  - tRPC `import` router added with `previewTransactions` and `applyTransactions` for CSV/OFX payloads.
  - Added parsers for CSV headers and basic OFX `<STMTTRN>` blocks (`DTPOSTED`, `TRNAMT`, `NAME`/`MEMO`).
  - Added `/imports` route with file/text input, parsed preview, account/category mapping, and import apply action.
  - Imports create budget-linked expenses for each transaction date.
  - Validation complete: `pnpm lint` and `pnpm typecheck` pass.
- 3.7 CFDI XML import implemented on 2026-02-14:
  - Extended import flow to support `cfdi` format parsing (UUID, date, total, RFC hints from XML attributes).
  - CFDI apply path now creates expenses with `source=cfdi`, stores `cfdiUuid`, and persists parsed metadata in `cfdiData`.
  - Imports page now accepts XML files and previews parsed CFDI summary before apply.
  - Validation complete: `pnpm lint` and `pnpm typecheck` pass.
- 3.8 basic auto-categorization implemented on 2026-02-14:
  - Added persistent `CategoryMapping` schema + migration and tRPC `categoryMapping` CRUD router.
  - Added `/category-rules` page (create/edit/delete rules with `contains`/`exact`/`regex` match types).
  - Import preview now returns `suggestedCategoryId` per row and imports page renders the suggestion.
  - Import apply now supports optional category override: when empty, rules determine category per row; when selected, chosen category overrides all imported rows.
  - Validation complete: `pnpm lint` and `pnpm typecheck` pass.

**Decisions:**
- Start with 3.1 Installment plans (MSI) to unlock auto-generated future expenses early.
- 2026-02-14: enforce credit-account-only validation for installment plans in API to align MSI behavior with product semantics.
- 2026-02-14: regenerate installment-generated expenses on plan updates to keep schedule/amounts consistent with plan source-of-truth.
- 2026-02-14: canceling a plan removes generated installment expenses and sets plan status to `cancelled` to prevent stale future obligations.
- 2026-02-14: transfer operations enforce distinct source/destination accounts in API validation to prevent no-op or misleading transfer records.
- 2026-02-14: savings-goal progress uses linked account balance as the first implementation source (no separate contribution ledger yet) to avoid introducing additional schema complexity in this phase.
- 2026-02-14: annual-proration display is surfaced in recurring-template UI while keeping canonical proration logic in budget aggregation APIs to avoid duplicated business logic.
- 2026-02-14: kept reports aggregation in API (grouping/normalization server-side) while rendering charts client-side for faster iteration and clearer separation of concerns.
- 2026-02-14: kept schema unchanged for OFX source in Phase 3 (using `Expense.source=csv` for OFX imports and `[OFX]` description prefix) to avoid a migration mid-phase; alternative is adding `ExpenseSource.ofx` in a later schema revision.
- 2026-02-14: implemented lightweight in-house XML extraction for CFDI fields instead of adding a parser dependency in this step; alternative is replacing with `@nodecfdi/cfdi-to-json` when deeper CFDI coverage is required.
- 2026-02-14: stored `cfdiData` as serialized JSON text in the JSON column to satisfy strict Prisma input typing without introducing additional runtime JSON-shape guards in this step.
- 2026-02-14: chose persistent `CategoryMapping` table over in-memory rules for 3.8 to provide editable/import-stable behavior across sessions; alternative was static in-code matching with lower schema complexity but no user-level CRUD.

**Roadblocks:**
- None yet.
