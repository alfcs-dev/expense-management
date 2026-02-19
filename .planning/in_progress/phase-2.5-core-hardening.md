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
- Tailwind + shadcn-style design foundation from the start (not deferred).

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

### Slice 0 — UI Design Foundation

- [x] Tailwind setup in `apps/web` (PostCSS + global styles + config).
- [x] Shared UI primitives added (`Button`, `Input`, `Label`, `Card`, `Select`, `Textarea`, `Alert`).
- [x] Shared page/layout primitives added for route-level consistency.
- [x] Route shell/navigation restyled to establish baseline visual language.

**Slice 0 done when**
- Core routes can reuse a consistent styled system and do not rely on default browser styling.

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

- [x] Add API smoke test harness (Fastify inject + Vitest or equivalent)
- [x] Add `pnpm test:api` entrypoint and CI hook
- [x] Cover minimum scenarios:
  - [x] health endpoint
  - [x] protected route unauthorized behavior
  - [x] authenticated create/list flow for account, budget, recurring, manual expense

**Slice C done when**
- Smoke tests pass locally and in CI.

### Slice D — Core UI Quality Pass

- [x] Core routes quality pass:
  - [x] `/accounts`
  - [x] `/categories`
  - [x] `/budgets`
  - [x] `/recurring-expenses`
  - [x] `/expenses`
  - [x] `/dashboard`
- [x] For each route ensure:
  - [x] loading/empty/error/success states
  - [x] consistent spacing/labels/form affordances
  - [x] locale-consistent money/date formatting
  - [x] mobile baseline usability
- [x] Add checklist doc:
  - [x] `docs/UI_ACCEPTANCE_CHECKLIST.md`

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
- 2026-02-19: Removed stale `packages/db/dist2` artifact and added guardrails.
  - Removed legacy `dist2` build output directory from `packages/db` workspace content.
  - Added `.gitignore` rule `packages/db/dist2/` to prevent future accidental tracking of duplicate build artifacts.
- 2026-02-19: Generated full-schema ERD image artifacts from Prisma schema.
  - Added auto-generated Mermaid source at `docs/diagrams/full-schema-erd.mmd` from `packages/db/prisma/schema.prisma` (25 models).
  - Exported full-schema diagram images to `docs/diagrams/full-schema-erd.svg` and `docs/diagrams/full-schema-erd.png`.
  - Kept existing conceptual ERD docs unchanged and stored full-schema output as separate diagram artifacts.
- 2026-02-19: Resolved component import mismatches and introduced `@components` alias.
  - Removed stale duplicate file `apps/web/src/components/accounts/account-form.tsx` that conflicted with `AccountForm.tsx`.
  - Added TypeScript path alias `@components/* -> ./src/components/*` in `apps/web/tsconfig.json`.
  - Added Vite resolve alias for `@components` (with precedence over `@`) in `apps/web/vite.config.ts`.
  - Replaced web component imports to use `@components/...` instead of relative component paths.
  - Validation complete for web package: `pnpm --filter @expense-management/web typecheck` and `pnpm --filter @expense-management/web lint` pass.
- 2026-02-19: Applied React/web naming convention across `apps/web` component files.
  - Renamed component modules to `PascalCase` in `src/components/ui`, `src/components/layout`, and `src/components/accounts`.
  - Updated route/component import paths to match renamed files (including alias-based `@/components/...` imports).
  - Validation complete for web package: `pnpm --filter @expense-management/web typecheck` and `pnpm --filter @expense-management/web lint` pass.
- 2026-02-19: Standardized React/web naming conventions for agent tooling.
  - Added explicit naming convention rules in `AGENTS.md` for component files, non-component files, folders, and custom hooks.
  - Added Cursor rule `.cursor/rules/react-web-file-naming-conventions.mdc` with `apps/web/src` globs and always-apply behavior.
  - Added app-local Cursor rule mirror at `apps/web/.cursor/rules/react-web-file-naming-conventions.mdc` with `src/**/*` globs.
  - Aligned Codex and Cursor guidance to reduce file naming drift in web changes.
- 2026-02-19: Expanded institution catalog seed coverage and populated local catalog dataset.
  - Updated `packages/db/seed.ts` with a 94-entry institution list from manual catalog input.
  - Standardized `bankCode` derivation as the last 3 digits of `code` (`code.slice(-3).padStart(3, "0")`) to avoid drift.
  - Applied non-destructive upserts to `institution_catalog` locally and verified counts (`94` total, `94` active).
- 2026-02-19: Extracted `/accounts` form into a dedicated component module.
  - Moved account create/edit form JSX into `apps/web/src/components/accounts/AccountForm.tsx`.
  - Kept route-level submission and mutation logic in `apps/web/src/routes/accounts.tsx` and passed state/actions via props.
  - Preserved existing field validation and conditional card/credit-cycle form behavior.
- 2026-02-19: Restored drawer-based account create/edit form surface.
  - Replaced `/accounts` create/edit `Popover` form container with right-side `Sheet` drawer.
  - Kept account form validation, institution inference, and card/credit settings logic unchanged.
  - Improved mobile usability for account form by moving long form fields into a scrollable drawer layout.
- 2026-02-18: Switched institution relationships to UUID-based catalog IDs.
  - Updated `institution_catalog` to use UUID primary key (`id`) while keeping `code` and `bankCode` as catalog attributes.
  - Updated `accounts` relation from `institution_code -> institution_catalog.code` to `institution_id -> institution_catalog.id`.
  - Added migration `20260218050153_institution_catalog_uuid_fk` with in-place UUID backfill and account FK remap.
  - Updated account tRPC inputs to support `institutionId` (with compatibility handling for legacy `institutionCode` payloads).
  - Updated accounts UI to select/store institution by UUID and keep CLABE bank-code inference behavior.
  - Updated seed + Postman + docs for the new relation model.
- 2026-02-18: Added account metadata validation and institution catalog integration path.
  - Integrated `clabe-validator` in shared CLABE utilities with checksum fallback for resilience.
  - Added `card-validator` driven account form UX for brand + last4 capture (no full PAN persistence).
  - Added Prisma entities and account relations for `institution_catalog` and `account_card_profiles`.
  - Added `institutionCatalog` tRPC router and expanded `account.create/update/list` include/input shape.
  - Updated Postman/API docs and added dependency fallback doc for library maintenance scenarios.
- 2026-02-17: Expanded account type model to support broader account semantics.
  - Updated `AccountType` enum to `debit | savings | investment | credit_card | credit | cash`.
  - Added migration `20260217233928_account_type_enum_expansion` with explicit `checking -> debit` data mapping.
  - Updated shared account schema/types, seed data, and web account form options to new enum set.
- 2026-02-17: Temporarily reduced web route surface to three core screens for branch stabilization.
  - Kept only auth entry screens (`/sign-in`, `/register`) plus protected `/dashboard`.
  - Added root redirect route (`/`) to forward to `/sign-in` or `/dashboard` based on session.
  - Removed legacy route screens (`accounts`, `budgets`, `categories`, `expenses`, `recurring-expenses`) from current branch UI.
- 2026-02-17: Consolidated Finance V2 cutover documentation for agent handoff and implementation tracking.
  - Added `docs/FINANCE_V2_CHANGELOG.md` with schema, migration, seed, tRPC, and breaking-change summary.
  - Linked architecture doc to changelog for faster cross-reference during implementation.
  - Refreshed API testing guidance to align with transaction-first tRPC surface.
- 2026-02-17: Rewired tRPC layer for transactions-first schema.
  - Updated `account` and `category` routers to new account/category enums and relation fields.
  - Reworked planning routers to `budget_periods` + `budget_rules` + `budgets` table semantics.
  - Reworked credit statement and installment routers to `transactions` and new naming (`fromAccountId`, `planId`, etc.).
  - Replaced legacy expense behavior with `transaction` router surface and kept `expense` as temporary alias.
  - Marked recurring-expense router as deprecated in API behavior after schema cutover.
- 2026-02-17: Executed hard schema cutover to `transactions`-first finance domain (pre-launch reset path).
  - Preserved auth/user models and removed legacy finance model chain from Prisma migrations.
  - Replaced `Expense`-centric schema with `transactions`-centric schema and V2 seam entities (`planned_transfers`, `income_events`, `bills`, `account_balance_snapshots`, `account_transfer_profiles`).
  - Standardized monetary storage on integer cents (`Int`) across new finance entities.
  - Rebuilt migration history to a single clean baseline (`20260217160000_initial_auth_and_transactions`) and validated reset + seed.
  - Rewrote DB seed to create minimal but complete scenarios for planning, statement cycle, installments, transfers, bills, and snapshots.
- 2026-02-17: Introduced Finance V2 schema/API foundation (auth-preserving).
  - Added Prisma entities for credit statement lifecycle (`CreditCardStatement`, `StatementPayment`) and linked `Expense.statementId`.
  - Added installment schedule entity (`Installment`) and linked `Expense.installmentId`.
  - Added planning entities (`BudgetPeriod`, `IncomePlanItem`, `BudgetRule`, `BudgetAllocation`) for salary-driven category allocations.
  - Added tRPC routers for new planning/cycle/installment surfaces: `budgetPeriod`, `budgetRule`, `budgetAllocation`, `incomePlanItem`, `creditCardStatement`, `installment`.
  - Added architecture/diagram docs for agent-readable Finance V2 implementation context.
- 2026-02-17: Hardened manual expense form UX and required-field validation.
  - Updated `/expenses` budget selector and create flow layout for better readability.
  - Added explicit client-side validation for required expense inputs (budget/category/account/description/amount/date) and positive amount constraints.
  - Added EN/ES validation copy for expense form feedback.
- 2026-02-17: Scoped recurring templates to explicit budgets.
  - Added required `budgetId` on `RecurringExpense` and linked each template to a single budget.
  - Updated recurring API create/update validation to enforce budget ownership for the authenticated user.
  - Updated recurring list payloads to include budget metadata and updated UI to require/select budget in recurring template forms.
  - Updated budget planned aggregation so dashboard planned totals only include recurring templates assigned to the selected budget.
  - Updated seed flow and API testing assets to include budget assignment for recurring template creation.
- 2026-02-17: Added credit-account billing cycle support and seed alignment for the budget model.
  - Added credit billing fields to `Account`: `statementClosingDay` and `paymentGraceDays`.
  - Updated account API create/update validation and persistence for the new fields.
  - Updated `/accounts` UI for credit cards with `fecha de corte` and `días de gracia` inputs plus estimated next due-date display.
  - Updated EN/ES i18n account labels/errors for billing-cycle UX.
  - Updated seed flow to create one default ranged budget (`name/startDate/endDate/currency/budgetLimit/isDefault`) so post-seed expense flows have an active budget.
  - Added seed defaults for credit card billing cycle values (`SEED_CREDIT_STATEMENT_CLOSING_DAY`, `SEED_CREDIT_PAYMENT_GRACE_DAYS`).
- 2026-02-17: Reworked core budget model from month/year containers to named ranged budgets with explicit limit currency.
  - Prisma `Budget` now stores required `name`, `startDate`, `endDate`, `currency`, `budgetLimit`, and `isDefault`.
  - Added overlap protection in budget API creation so a user cannot create overlapping budget periods.
  - Added `budget.list`, `budget.getDefault`, `budget.setDefault`, and `budget.resolveForDate` procedures; removed reliance on month/year APIs in web routes.
  - Added expense conversion persistence fields (`amountInBudgetCurrency`, `conversionStatus`) and automatic estimated conversion fallback when expense currency differs from budget currency.
  - Updated `/budgets`, `/expenses`, and `/dashboard` UX to select active budget by `budgetId`, default to user default budget, and surface estimated conversion warnings.
  - Updated API smoke test payloads and Postman assets for new budget inputs.
  - Updated schema visualization and API testing docs to reflect the new budget model.
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
- 2026-02-14: Slice C completed on branch `phase-2.5-core-hardening`.
  - Added API app builder (`apps/api/src/app.ts`) and refactored entrypoint to enable test bootstrapping.
  - Added Vitest smoke suite (`apps/api/src/app.test.ts`) with health, unauthorized, and authenticated core lifecycle checks.
  - Added `pnpm test:api` root script and API package test script.
  - Updated CI workflow with `api_smoke` job backed by Postgres service and migration deploy step.
  - Validation complete: `pnpm test:api`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass.
- 2026-02-14: Slice 0 completed on branch `phase-2.5-core-hardening`.
  - Added Tailwind tooling and global style foundation in `apps/web`.
  - Added reusable UI primitives and layout wrappers for consistent page composition.
  - Restyled root shell/navigation/session controls to match new baseline.
- 2026-02-14: Slice D completed on branch `phase-2.5-core-hardening`.
  - Applied shared styling baseline across `/accounts`, `/categories`, `/budgets`, `/recurring-expenses`, `/expenses`, `/dashboard`, and `/` (auth entry).
  - Standardized state presentation (loading/error/empty) and action button hierarchy.
  - Added route QA checklist in `docs/UI_ACCEPTANCE_CHECKLIST.md`.
- 2026-02-15: Auth navigation hardening for protected routes.
  - Added a pathless protected parent route with TanStack Router `beforeLoad` session checks (`/api/auth/get-session`) so app pages are guarded at the routing layer.
  - Moved `/dashboard`, `/accounts`, `/budgets`, `/categories`, `/expenses`, and `/recurring-expenses` under the protected route tree.
  - Updated root sign-out flow to redirect to `/sign-in` immediately after logout.
  - Improved route-guard performance by moving session access into TanStack Router context with an auth-session cache (authenticated sessions cached briefly, in-flight requests deduplicated).
- 2026-02-15: Formatting baseline hardened with Prettier via ESLint.
  - Added `prettier`, `eslint-plugin-prettier`, and `eslint-config-prettier` at workspace root.
  - Enabled `eslint-plugin-prettier/recommended` in flat ESLint config so Prettier runs as ESLint rules.
  - Updated workspace VS Code settings to use ESLint as default formatter with format-on-save + `source.fixAll.eslint`.
  - Replaced placeholder `lint` scripts in `packages/db`, `packages/shared`, and `packages/trpc` with real `eslint .` commands so formatting/linting now applies across all TypeScript workspace packages.
- 2026-02-15: Auth route UX restructured around protected home.
  - Documented target route/auth model in `docs/ROUTING_AUTH.md`.
  - Moved auth screens to dedicated public routes: `"/sign-in"` (login) and `"/register"` (account creation).
  - Promoted dashboard to protected home route `"/"` and added `"/dashboard"` legacy redirect alias to preserve old links.
  - Updated unauthorized redirects and sign-out behavior to land on `"/sign-in"`.
  - Extracted sign-in screen into its own route module (`apps/web/src/routes/sign-in.tsx`) and removed old `index` route module for clearer auth route ownership.
- 2026-02-15: Unblocked web typecheck by replacing invalid button variant usage.
  - Updated `variant="danger"` to `variant="destructive"` in accounts, categories, expenses, and recurring-expenses routes.
- 2026-02-15: Locale parity check completed for web translations.
  - Compared `apps/web/src/locales/en.json` and `apps/web/src/locales/es.json` key-by-key.
  - Added missing Spanish `home.*` auth labels (`loginDescription`, `login`, `register`, `forgotPassword`, `dontHaveAccount`) so EN/ES key sets are aligned.
- 2026-02-15: Auth redirect handoff hardened after route-guard redirect query rollout.
  - Protected-route guard now forwards attempted path into `?redirect=` using router `location.href`.
  - Sign-in and register routes now parse/preserve `redirect` and resolve callback URLs from it (same-origin only, fallback `/`).
  - This fixes post-auth navigation always landing on dashboard when a protected deep link initiated the sign-in flow.
- 2026-02-15: Guard cleanup for protected routes and auth-search ergonomics.
  - Made auth route search parsing return truly optional `redirect` params for `"/sign-in"` and `"/register"` (instead of always materializing `redirect: undefined`).
  - Removed duplicated per-page unauthorized `useEffect` navigation redirects from protected routes (`accounts`, `budgets`, `categories`, `dashboard`, `expenses`, `recurring-expenses`) and retained route-level protection in `protected.beforeLoad`.
- 2026-02-15: Added centralized runtime unauthorized handling for mid-session expiry.
  - Introduced global React Query unauthorized interception in `apps/web/src/main.tsx` (`QueryCache` + `MutationCache` `onError`).
  - On `UNAUTHORIZED`, app now invalidates auth cache and redirects once to `"/sign-in"` with `redirect=<current-url>`, avoiding loops on auth routes.
- 2026-02-15: Fixed Zod schema-version mismatch causing runtime tRPC input parser errors.
  - Root cause: `@expense-management/shared` exported Zod v3 schemas while tRPC routers used Zod v4.
  - Updated `packages/shared/package.json` to `zod@^4.3.6` and refreshed lockfile via `pnpm install`.
  - Verified runtime schema composition (`z.object({ budgetId: idSchema })`) succeeds with shared `idSchema`.
- 2026-02-16: Implemented mixed form-surface UX model for CRUD entities.
  - Added reusable UI surface primitives in `apps/web/src/components/ui`: `dialog.tsx` (modal), `sheet.tsx` (drawer), and `popover.tsx`.
  - Migrated `categories` form to controlled popover flow for create/edit while preserving reorder and delete actions.
  - Migrated `budgets` form to modal create flow with preserved year filtering/list behavior.
  - Migrated `expenses` form to modal create/edit flow while preserving selected month/year budget context and list interactions.
  - Migrated `accounts` and `recurring-expenses` forms to drawer-based create/edit flows with existing validation/conditional logic preserved.
  - Added shared locale key `common.cancel` in EN/ES and documented form-surface decisions in `docs/FORMS_UX.md`.
  - Validation complete for web package: `pnpm --filter @expense-management/web lint` and `pnpm --filter @expense-management/web typecheck` pass.

**Decisions**
- 2026-02-17: Chosen recurring-template budget ownership model is one-template-to-one-budget (not shared templates) to keep planned totals deterministic per budget and simplify UX.
- 2026-02-17: Modeled credit-card payment timing with `statementClosingDay` + `paymentGraceDays` (instead of fixed due-date day) to support month-length variability and issuer-specific grace periods.
- 2026-02-17: Adopted a single-currency budget limit model (`budget.currency` + `budget.budgetLimit`) instead of dual-currency budget limits.
- 2026-02-17: Kept original expense currency immutable while storing a budget-currency amount for progress tracking with explicit `estimated` vs `confirmed` conversion state.
- 2026-02-17: Chose an allow-and-warn policy for cross-currency expenses so users can log transactions immediately and reconcile exact converted amounts later.
- 2026-02-14: Keep `shadcn/ui` direction for this phase; do not migrate component library.
- 2026-02-14: Postman-first API testing selected over Swagger-first for immediate execution speed.
- 2026-02-14: Vertical-slice delivery selected over backend-first or dual-track mock divergence.
- 2026-02-14: UI styling quality is an equal priority with backend functionality in Phase 2.5.
- 2026-02-16: Adopted form-surface policy by entity complexity.
  - Drawer-first default for medium/complex forms.
  - Exceptions: expenses + budgets use modal; categories use popover.
  - Tags deferred to a dedicated future schema/API/UI phase.

**Roadblocks**
- None yet.
