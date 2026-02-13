# Phase 1 — Foundation (Weeks 1–2)

> **Source:** [PLAN.md](../PLAN.md) Section 6, Phase 1.  
> **When starting this phase:** move this file to `../in_progress/` and use the "In progress" section at the bottom to log achievements, decisions, and roadblocks.

**Planning Metadata**
- Status: in_progress
- Owner: @alfcs
- Target start: Week 1
- Target end: Week 2
- Actual start: 2026-02-12
- Actual end: TBD
- Dependencies: None (foundation phase)
- Linked PRs/issues: TBD

---

## 1. Goals

- Working monorepo with API, web app, and shared packages.
- Auth-gated SPA talking to Fastify + tRPC; data in PostgreSQL via Prisma.
- i18n in place (English); all user-facing strings wrapped in `t()`.
- Local development via Docker (API + Postgres + Nginx); CI (lint, type-check, build).
- Seed data from existing CSV to validate schema and workflows.
- **Local env:** One command starts all dev services (API + web via Turborepo; DB via Docker or script). Everything can be tested and started locally with a clear, repeatable path.
- **Documentation:** How to run and test the local environment is written down so that you or another person can do it without guessing (onboarding / "I forgot how").

---

## 2. Prerequisites

- Node.js 20+ and pnpm installed.
- Docker and Docker Compose for local stack.
- Access to [Estimated expenses Mexico - Actual.csv](../docs/Estimated%20expenses%20Mexico%20-%20Actual.csv) (or equivalent) for seed data.

---

## 3. What's needed (task breakdown)

### 3.1 Monorepo and workspace

- [x] Initialize repo with Turborepo + pnpm workspaces.
- [x] Create `apps/api`, `apps/web`, `packages/db`, `packages/shared`, `packages/trpc` (and optionally `packages/ui` if desired in Phase 1).
- [x] Configure `turbo.json` for build/dev/lint pipelines and caching.
- [x] Root `package.json` scripts: `dev`, `build`, `lint`, `typecheck` (or similar).
- [x] Optimize Turbo task graph for fast feedback: `lint` and `typecheck` should run independently of `^build` (or with minimal dependencies), then `build` as a separate validation step.
- [x] Repository hygiene baseline: update `.gitignore` and cleanup tracked generated artifacts (`dist/`, `.turbo/` logs, `*.tsbuildinfo`) so repo state reflects source, not build output.

### 3.2 API (Fastify + tRPC)

- [x] `apps/api`: Fastify server, tRPC adapter (e.g. `@trpc/server` Fastify adapter), health route.
- [x] Mount tRPC router from `packages/trpc` at a path (e.g. `/api/trpc` or `/trpc`).
- [x] CORS and request logging configured for local + future production.
- [x] CORS policy must be environment-aware: permissive in local dev, explicit allowlist in non-local environments (via env var such as `CORS_ORIGINS`).
- [x] Add typed runtime env validation module (e.g. Zod) for API config (`PORT`, `CORS_ORIGINS`, auth secrets, provider keys) and fail fast on invalid/missing values.

### 3.3 One dev command (start everything for local testing)

Set this up right after API and web exist so you can test as you add code.

- [x] **Single command for all dev services:** Root `pnpm dev` runs both `apps/api` and `apps/web` in parallel via Turborepo (e.g. `turbo run dev` with `dev` scripts in each app). One terminal: API and web start together with hot reload.
- [x] **Database:** Postgres must be running before `pnpm dev`. Root script `pnpm dev:all` starts Postgres then runs `turbo run dev` for one-command start.
- [x] **Migrations:** Documented only: run once after clone with `pnpm db:migrate` from root (see LOCAL_DEVELOPMENT.md). No auto-migrate on API start.
- [x] Result: after `pnpm install` and first-time DB setup (migrate + optional seed), running `pnpm dev` or `pnpm dev:all` starts everything needed; no need to open multiple terminals for API and web.

### 3.4 Web app (React + Vite + TanStack)

- [x] `apps/web`: Vite + React + TypeScript, TanStack Router (code-based routes), TanStack Query.
- [x] tRPC client configured to point at API (env for API URL).
- [x] At least one protected route and one public route: public `/` (Home), protected `/dashboard` (redirects to `/` when not signed in). Route structure in place for auth flow.
- [x] Eliminate architecture drift in web entrypoint: keep Router as the single app entry path and remove unused legacy app entry components/files.
- [x] Add typed env handling for web runtime/build-time configuration (`VITE_API_URL` at minimum), with safe defaults for local dev.

### 3.5 Shared packages

- [x] **packages/db:** Prisma schema, migrations, generated client. Schema must include `User` and all Phase 1 entities with `userId` FK and `currency` enum (see [SCHEMA_VISUALIZATION.md](../docs/SCHEMA_VISUALIZATION.md)). No need for Phase 6/7 tables (e.g. `StagedTransaction`, `SharedObjective`) yet unless you want full schema in one go.
- [x] **packages/trpc:** Root router, `createContext` (accept request, resolve user from session/JWT), protected procedure helper. Initial procedures can be minimal (e.g. `user.me`).
- [x] **packages/shared:** Zod schemas, shared constants (e.g. currency enum), types used by both API and clients.
- [x] **packages/db:** Export a shared Prisma client singleton (`db`/`prisma`) and use it from API procedures/services to avoid duplicated client creation.
- [x] **packages/trpc / packages/shared / packages/db packaging:** Ensure package entrypoints target built outputs (`dist`) using explicit `exports`, `main`, and `types` fields for stable cross-package consumption.

### 3.6 Authentication (Better Auth)

- [x] Better Auth server config in `apps/api` (or shared config): session + JWT, user table (or use Better Auth's default schema).
- [x] Prisma schema includes `User` (and any Better Auth tables: session, account, etc.) and matches Better Auth expectations.
- [x] Auth routes mounted on Fastify (e.g. `/api/auth/*`).
- [x] tRPC `createContext`: read session/JWT from request, attach `user` (or null) to context; protected procedure throws UNAUTHORIZED if no user.
- [x] Web: login/signup UI (simple form or redirect to Better Auth pages), store session (cookie or token), send credentials with tRPC requests.

### 3.7 i18n

- [x] Install and configure `react-i18next` + `i18next` in `apps/web`.
- [x] Create `en.json` (or namespaced files) with keys for all Phase 1 UI strings.
- [x] Wrap every user-facing string in `t('key')`; no raw English in JSX for translatable content.
- [x] (Optional) Language detector and switcher placeholder for Phase 2 Spanish.

### 3.8 Seed and CSV import

- [ ] `packages/db/seed.ts`: read CSV (path from env or default), parse rows.
- [ ] Map CSV columns to Prisma: accounts, categories, recurring expenses (and any budgets/expenses if CSV has them). Handle currency (MXN/USD) and amounts as integers (centavos).
- [ ] Idempotent seed where possible (e.g. clear seed data or skip if already present).
- [ ] Document how to run seed (`pnpm --filter db seed` or similar).

### 3.9 Docker and local dev

- [x] `docker/` or repo root: `docker-compose.yml` with services: `postgres` (PostgreSQL 16), and optionally `api` + `nginx` for a production-like full stack. For day-to-day dev, postgres-only compose (or the same file with only postgres) is enough if you use `pnpm dev` for API + web (see 3.3).
- [ ] Nginx: serve static files from a volume or built `apps/web` output; proxy `/api` (or your API prefix) to `api`. (Only needed when testing full Docker stack.)
- [x] `.env.example` with `DATABASE_URL`, `API_URL` (or equivalent), Better Auth secrets.

### 3.10 Local env: test everything locally and document it

**1. Make sure we can test/start everything locally**

- [x] Default "full local" mode: Postgres in Docker + **one command** `pnpm dev` (or `pnpm dev:all`) for API and web on the host (see 3.3). Full Docker stack (API + Nginx) remains optional for production-like testing.
- [x] One command gets the dev stack up: either `pnpm dev` (with postgres started separately once) or `pnpm dev:all` (script starts postgres then `turbo run dev`). No hidden manual steps (migrations either in the script or clearly in the doc).
- [x] Verification checklist: after starting, a new contributor (or you in 6 months) can confirm: DB is up, API health returns OK, web app loads, login works, seed data is present (or they know how to run seed). Add a short "Smoke test" subsection in the doc (e.g. open `/`, hit `/api/health`, run seed and check DB).
- [x] Migrations: document when to run them (`pnpm --filter db migrate` or similar) and whether they run automatically on API start or via CI.

**2. Document how to do it**

- [x] Add a **Local development** doc (e.g. `docs/LOCAL_DEVELOPMENT.md` or a "Development" section in the repo README) that covers:
  - **Prerequisites:** Node version, pnpm, Docker (and Docker Compose), any global tools.
  - **Clone and install:** `git clone ...`, `pnpm install`, copy `.env.example` to `.env` and fill (or list what's required).
  - **Start the stack:** Exact commands in order (e.g. start Docker, run migrations, run seed, start dev servers). One "quick start" path (minimal steps) and optional "Docker-only" or "host API/web" variants if both are supported.
  - **Useful commands:** `pnpm dev`, `pnpm build`, `pnpm lint`, how to run seed, how to run DB migrations, how to reset DB if needed.
  - **URLs:** Local app URL (e.g. `http://localhost:5173`), API base URL (e.g. `http://localhost:4000` or via Nginx).
  - **Troubleshooting:** Common issues (port in use, `DATABASE_URL` wrong, migrations out of date, "forgot to run seed") and how to fix them.
- [x] Keep the doc in the repo so it stays next to the code and can be updated when the setup changes.

### 3.11 CI (GitHub Actions)

- [ ] Workflow: on push/PR, install deps (pnpm), lint, typecheck, build all apps and packages.
- [ ] No deploy in Phase 1; only validate that the monorepo builds and passes checks.
- [ ] CI order should reflect feedback speed: run `lint` + `typecheck` before `build` (or in parallel), not as a byproduct of build dependencies.

---

## Definition of Ready (DoR)

- [ ] Required schema/docs for this phase are finalized.
- [ ] External vendor/provider decisions are finalized (if applicable).
- [ ] Required environment variables and secrets are confirmed.
- [ ] Validation plan is agreed (`pnpm lint`, `pnpm typecheck`, smoke checks, and any relevant performance checks).

---

## 4. How to achieve it

*(Sections 4.1–4.3 unchanged — see draft for full content.)*

---

## 5. Decisions to make

- Whether to include `packages/ui` in Phase 1 or add it when building dashboard components (Phase 2).
- Exact tRPC path and API base URL convention (e.g. `/api/trpc` vs `/trpc`).
- Whether to run API and web in Docker during dev or only Postgres + Nginx in Docker and run API/web with `pnpm dev` on the host.

---

## 6. Possible roadblocks

- Better Auth + Fastify: ensure plugin order and route order so auth routes are registered before tRPC and don't conflict.
- CSV format: if the actual CSV columns differ from the seed script assumptions, document the expected format or add a small CLI to map columns.
- Docker networking: ensure `api` can reach `postgres` and `nginx` can reach `api`; use service names and internal ports.

---

## 7. Definition of done

- [ ] `pnpm install && pnpm build` succeeds at root.
- [ ] `pnpm dev` (or equivalent) runs API and web; login and one protected route work.
- [ ] Seed runs and creates accounts, categories, recurring expenses (and optionally budgets/expenses) from CSV.
- [ ] Docker Compose brings up Postgres, API, Nginx; web build is served and API is reachable.
- [ ] **Local env:** One clear path to start and test everything locally; smoke test (DB, API health, web, login, seed) passes.
- [ ] **Documentation:** A local development guide exists (e.g. `docs/LOCAL_DEVELOPMENT.md` or README section) with prerequisites, clone/install, start commands, useful commands, URLs, and troubleshooting. A new person (or you later) can get the app running by following it.
- [ ] CI runs on push/PR and passes (lint, typecheck, build).
- [ ] All user-facing strings in the web app use i18n keys (English only).
- [ ] Server-side auth boundary is real: tRPC context resolves session/JWT and protected procedures enforce authorization.
- [ ] Shared Prisma client layer exists in `packages/db` and is used by API code.
- [ ] CORS and runtime config are environment-specific and validated via typed env parsing.
- [ ] Workspace packages use stable `dist` entrypoints and explicit exports metadata.
- [ ] Web app uses router-driven single entrypoint (no stale/unused parallel app entry path).
- [ ] Generated artifacts are not tracked in git (`dist`, `.turbo` logs, `*.tsbuildinfo`).

---

## 8. In progress (use after moving to in_progress)

**Achievements:**
- **Step 1 done:** Phase 1 draft moved to `in_progress`. Monorepo initialized: Turborepo + pnpm workspaces; created `apps/api`, `apps/web`, `packages/db`, `packages/shared`, `packages/trpc`; root `package.json` with scripts `dev`, `build`, `lint`, `typecheck`; `turbo.json` with pipeline for build, dev, lint, typecheck. All packages have minimal `package.json` and TypeScript config. Run `pnpm install` at repo root to install dependencies.
- **Step 2 done:** Full Prisma schema in `packages/db/prisma/schema.prisma`: User, Account, Budget, Category, RecurringExpense, Expense, InstallmentPlan, Transfer, SavingsGoal, BudgetCollaborator, BankLink. Enums and relations set. Docker Compose (postgres), root `db:migrate` script with dotenv-cli, docs/LOCAL_DEVELOPMENT.md. Run `pnpm db:migrate` from root then `pnpm build`.
- **Step 3 & 4 done:** packages/trpc: root router, createContext (Fastify; user null for now), protectedProcedure, userRouter with `user.me`, appRouter + AppRouter type. apps/api: Fastify + tRPC at `/api/trpc`, @fastify/cors, health. apps/web: tRPC React client (httpBatchLink), QueryClient + trpc.Provider, App uses `trpc.user.me.useQuery()` and shows "Not signed in". Run `pnpm install` then `pnpm dev`; web at http://localhost:5173, API at http://localhost:4000/api/trpc.
- **Fixes (API):** (1) Fastify FSTDEP022: moved `maxParamLength` into `routerOptions` (ready for Fastify 6). (2) Health endpoint: explicit `reply.status(200).send({ status: "ok" })` so GET http://localhost:4000/health returns `{"status":"ok"}` reliably.
- **Dev flow:** Root has `dev:all` (Postgres + API + web in one command). Migrations: document-only (run `pnpm db:migrate` once after clone); see LOCAL_DEVELOPMENT.md. Smoke test subsection added to doc.
- **Step 5 (3.4) done:** TanStack Router added; public route `/` (Home), protected route `/dashboard` (redirects to `/` if no user). Nav: Home | Dashboard. Run `pnpm install` then `pnpm dev`; open http://localhost:5173, go to Dashboard to see redirect when not signed in.

**Decisions:**
- Package scope: `@expense-management/*` for workspace packages.
- Skipped `packages/ui` in Phase 1 (add in Phase 2 when building dashboard).
- Single FK for Account–BankLink: Account.bankLinkId → BankLink (one link, many accounts can reference it).

**Achievements (this session):**
- **Turbo:** Removed `dependsOn: ["^build"]` from `lint` and `typecheck` so they run without building dependencies first; formatted `turbo.json`.
- **.gitignore:** Added `*.tsbuildinfo` so generated artifacts are not tracked.
- **API env:** Added `apps/api/src/env.ts` with Zod schema for `NODE_ENV`, `PORT`, `CORS_ORIGINS`; `getCorsOrigin()` returns `true` (permissive) when unset or `"*"`/`"true"`, else comma-separated list. API uses `env.PORT` and `getCorsOrigin()` for CORS. Updated `.env.example` with PORT and CORS_ORIGINS.
- **Web:** Removed legacy `App.tsx` (router is the single entry in `main.tsx`). Added `apps/web/src/env.ts` with typed `VITE_API_URL` and default `http://localhost:4000`; `main.tsx` uses `env.VITE_API_URL`.
- **packages/db:** Added `packages/db/src/index.ts` exporting singleton `db` (PrismaClient) and updated tsconfig to include `src/**/*.ts`; typecheck passes. Added `@types/node` and `"types": ["node"]` for `process.env`.
- **Typecheck fixes:** packages/trpc: explicit `Context` type and return type for `createContext`; `protectedProcedure` cast to `typeof t.procedure` to satisfy portable type naming. apps/web: `trpc` export typed as `CreateTRPCReact<AppRouter, unknown>`. packages/trpc: added `fastify` as dependency for type resolution.

**Achievements (3.5):**
- **packages/shared:** Zod schemas and constants: `currencySchema` / `CURRENCIES`, `accountTypeSchema` / `ACCOUNT_TYPES`, `recurringFrequencySchema` / `RECURRING_FREQUENCIES`, `idSchema` (cuid). All aligned with Prisma enums. Exported from `src/index.ts` (currency, account, recurring, common modules).
- **packages/trpc, shared, db packaging:** All three packages now use `dist` entrypoints: `main`, `types`, and `exports` with `types`/`import`/`default` pointing to `./dist/index.js` and `./dist/index.d.ts`. shared and trpc build with `tsc`; db build is `prisma generate && tsc`. Internal imports in shared and trpc use `.js` extensions for ESM output. Root `pnpm build` and `pnpm typecheck` pass.

**Achievements (3.6):**
- Added Better Auth config at `apps/api/src/auth.ts` with Prisma adapter (`@expense-management/db`), email/password enabled, session cookie cache in JWT mode, explicit model names (`User`, `AuthSession`, `AuthAccount`, `AuthVerification`), trusted origins, and secure cookies in production.
- Mounted Better Auth catch-all route in Fastify at `/api/auth/*` and wired CORS `credentials: true` so auth cookies can flow between web and API in local dev.
- Updated tRPC context creation in API to resolve session via `auth.api.getSession` (`fromNodeHeaders`) and attach `ctx.user`; switched `user.me` to `protectedProcedure` so unauthenticated access returns `UNAUTHORIZED`.
- Extended Prisma schema with Better Auth-compatible fields/tables (`User.emailVerified`, `User.image`, `AuthSession`, `AuthAccount`, `AuthVerification`) and added migration `20260213100000_add_better_auth_tables`.
- Implemented web auth client (`better-auth/react`), added sign-in/sign-up form on Home, sign-out in root layout, and configured both Better Auth and tRPC requests to send credentials (`credentials: "include"`).
- Added robust API env loading using `dotenv` against root `.env` (`apps/api/src/env.ts`) and required `DATABASE_URL` in runtime validation to fail fast before request handling.

**Achievements (3.9/3.10 docs + onboarding):**
- Expanded `.env.example` with complete local development defaults: `DATABASE_URL`, `PORT`, `CORS_ORIGINS`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `VITE_API_URL`; aligned local `.env` to the same values.
- Updated `docs/LOCAL_DEVELOPMENT.md` onboarding flow for new contributors: quick start, env variable section, smoke test with auth checks, and useful commands including `pnpm db:studio`.
- Root scripts now include `pnpm db:studio` for one-command Prisma Studio startup using root `.env`.
- Validation after doc/env updates: `pnpm typecheck` passes across all workspace packages.

**Achievements (3.7 i18n):**
- Installed `i18next` and `react-i18next` in `apps/web`. Added `src/i18n.ts` to init i18n with `initReactI18next`, English resources, and `escapeValue: false` for React. Imported `./i18n` in `main.tsx` so it runs before render.
- Created `src/locales/en.json` with namespaced keys for Phase 1: `nav`, `session`, `home`, `dashboard`, `app`, `language`. All UI strings use interpolation where needed (e.g. `{{email}}`, `{{message}}`).
- Replaced every user-facing string with `t('key')` in `__root.tsx`, `index.tsx`, and `dashboard.tsx`; set `document.title` from `t('app.title')` in the root layout.
- Added language switcher placeholder in nav: `language.label` and `language.en` with a comment for Phase 2 Spanish. Root `pnpm build` and typecheck pass.

**Roadblocks:**
- None. Lint fails with "eslint: not found" when run via turbo (scripts use `eslint`; may need `pnpm exec eslint` or root-level eslint).
