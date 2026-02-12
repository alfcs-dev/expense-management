# Phase 1 — Foundation (Weeks 1–2)

> **Source:** [PLAN.md](../PLAN.md) Section 6, Phase 1.  
> **When starting this phase:** move this file to `../in_progress/` and use the "In progress" section at the bottom to log achievements, decisions, and roadblocks.

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

### 3.2 API (Fastify + tRPC)

- [ ] `apps/api`: Fastify server, tRPC adapter (e.g. `@trpc/server` Fastify adapter), health route.
- [ ] Mount tRPC router from `packages/trpc` at a path (e.g. `/api/trpc` or `/trpc`).
- [ ] CORS and request logging configured for local + future production.

### 3.3 One dev command (start everything for local testing)

Set this up right after API and web exist so you can test as you add code.

- [ ] **Single command for all dev services:** Root `pnpm dev` runs both `apps/api` and `apps/web` in parallel via Turborepo (e.g. `turbo run dev` with `dev` scripts in each app). One terminal: API and web start together with hot reload.
- [ ] **Database:** Postgres must be running before `pnpm dev`. Either: (a) start it once with `docker compose up -d postgres` (or a small `docker-compose.dev.yml` with only postgres), or (b) add a root script (e.g. `dev:all` or `dev`) that starts postgres then runs `turbo run dev`, so a true one-command start is possible. Prefer (b) for "one command" if you're okay with a short wrapper script.
- [ ] **Migrations:** Decide whether to run migrations automatically when API starts (e.g. `prisma migrate deploy` in a predev script) or document "run once after clone: pnpm --filter db migrate". Either way, document it.
- [ ] Result: after `pnpm install` and first-time DB setup (migrate + optional seed), running `pnpm dev` (or `pnpm dev:all`) starts everything needed to work on the app; no need to open multiple terminals for API and web.

### 3.4 Web app (React + Vite + TanStack)

- [ ] `apps/web`: Vite + React + TypeScript, TanStack Router (file-based routes), TanStack Query.
- [ ] tRPC client configured to point at API (env for API URL).
- [ ] At least one protected route and one public route (e.g. login vs dashboard shell) to validate auth flow later.

### 3.5 Shared packages

- [ ] **packages/db:** Prisma schema, migrations, generated client. Schema must include `User` and all Phase 1 entities with `userId` FK and `currency` enum (see [SCHEMA_VISUALIZATION.md](../docs/SCHEMA_VISUALIZATION.md)). No need for Phase 6/7 tables (e.g. `StagedTransaction`, `SharedObjective`) yet unless you want full schema in one go.
- [ ] **packages/trpc:** Root router, `createContext` (accept request, resolve user from session/JWT), protected procedure helper. Initial procedures can be minimal (e.g. `user.me`).
- [ ] **packages/shared:** Zod schemas, shared constants (e.g. currency enum), types used by both API and clients.

### 3.6 Authentication (Better Auth)

- [ ] Better Auth server config in `apps/api` (or shared config): session + JWT, user table (or use Better Auth's default schema).
- [ ] Prisma schema includes `User` (and any Better Auth tables: session, account, etc.) and matches Better Auth expectations.
- [ ] Auth routes mounted on Fastify (e.g. `/api/auth/*`).
- [ ] tRPC `createContext`: read session/JWT from request, attach `user` (or null) to context; protected procedure throws UNAUTHORIZED if no user.
- [ ] Web: login/signup UI (simple form or redirect to Better Auth pages), store session (cookie or token), send credentials with tRPC requests.

### 3.7 i18n

- [ ] Install and configure `react-i18next` + `i18next` in `apps/web`.
- [ ] Create `en.json` (or namespaced files) with keys for all Phase 1 UI strings.
- [ ] Wrap every user-facing string in `t('key')`; no raw English in JSX for translatable content.
- [ ] (Optional) Language detector and switcher placeholder for Phase 2 Spanish.

### 3.8 Seed and CSV import

- [ ] `packages/db/seed.ts`: read CSV (path from env or default), parse rows.
- [ ] Map CSV columns to Prisma: accounts, categories, recurring expenses (and any budgets/expenses if CSV has them). Handle currency (MXN/USD) and amounts as integers (centavos).
- [ ] Idempotent seed where possible (e.g. clear seed data or skip if already present).
- [ ] Document how to run seed (`pnpm --filter db seed` or similar).

### 3.9 Docker and local dev

- [ ] `docker/` or repo root: `docker-compose.yml` with services: `postgres` (PostgreSQL 16), and optionally `api` + `nginx` for a production-like full stack. For day-to-day dev, postgres-only compose (or the same file with only postgres) is enough if you use `pnpm dev` for API + web (see 3.3).
- [ ] Nginx: serve static files from a volume or built `apps/web` output; proxy `/api` (or your API prefix) to `api`. (Only needed when testing full Docker stack.)
- [ ] `.env.example` with `DATABASE_URL`, `API_URL` (or equivalent), Better Auth secrets.

### 3.10 Local env: test everything locally and document it

**1. Make sure we can test/start everything locally**

- [ ] Default "full local" mode: Postgres in Docker + **one command** `pnpm dev` (or `pnpm dev:all`) for API and web on the host (see 3.3). Full Docker stack (API + Nginx) remains optional for production-like testing.
- [ ] One command gets the dev stack up: either `pnpm dev` (with postgres started separately once) or `pnpm dev:all` (script starts postgres then `turbo run dev`). No hidden manual steps (migrations either in the script or clearly in the doc).
- [ ] Verification checklist: after starting, a new contributor (or you in 6 months) can confirm: DB is up, API health returns OK, web app loads, login works, seed data is present (or they know how to run seed). Add a short "Smoke test" subsection in the doc (e.g. open `/`, hit `/api/health`, run seed and check DB).
- [ ] Migrations: document when to run them (`pnpm --filter db migrate` or similar) and whether they run automatically on API start or via CI.

**2. Document how to do it**

- [ ] Add a **Local development** doc (e.g. `docs/LOCAL_DEVELOPMENT.md` or a "Development" section in the repo README) that covers:
  - **Prerequisites:** Node version, pnpm, Docker (and Docker Compose), any global tools.
  - **Clone and install:** `git clone ...`, `pnpm install`, copy `.env.example` to `.env` and fill (or list what's required).
  - **Start the stack:** Exact commands in order (e.g. start Docker, run migrations, run seed, start dev servers). One "quick start" path (minimal steps) and optional "Docker-only" or "host API/web" variants if both are supported.
  - **Useful commands:** `pnpm dev`, `pnpm build`, `pnpm lint`, how to run seed, how to run DB migrations, how to reset DB if needed.
  - **URLs:** Local app URL (e.g. `http://localhost:5173`), API base URL (e.g. `http://localhost:4000` or via Nginx).
  - **Troubleshooting:** Common issues (port in use, `DATABASE_URL` wrong, migrations out of date, "forgot to run seed") and how to fix them.
- [ ] Keep the doc in the repo so it stays next to the code and can be updated when the setup changes.

### 3.11 CI (GitHub Actions)

- [ ] Workflow: on push/PR, install deps (pnpm), lint, typecheck, build all apps and packages.
- [ ] No deploy in Phase 1; only validate that the monorepo builds and passes checks.

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

---

## 8. In progress (use after moving to in_progress)

**Achievements:**
- **Step 1 done:** Phase 1 draft moved to `in_progress`. Monorepo initialized: Turborepo + pnpm workspaces; created `apps/api`, `apps/web`, `packages/db`, `packages/shared`, `packages/trpc`; root `package.json` with scripts `dev`, `build`, `lint`, `typecheck`; `turbo.json` with pipeline for build, dev, lint, typecheck. All packages have minimal `package.json` and TypeScript config. Run `pnpm install` at repo root to install dependencies.

**Decisions:**
- Package scope: `@expense-management/*` for workspace packages.
- Skipped `packages/ui` in Phase 1 (add in Phase 2 when building dashboard).

**Roadblocks:**
- None so far.
