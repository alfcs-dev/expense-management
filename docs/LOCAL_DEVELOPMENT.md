# Local development

How to run and test the app on your machine. Use this when onboarding or when you need to recall the steps.

---

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Docker** and **Docker Compose** (for Postgres)
- Git

---

## Quick start

From the **repository root**:

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env (defaults are local-ready)
cp .env.example .env

# 3. Start Postgres
docker compose up -d postgres

# 4. Run migrations (creates DB schema)
pnpm db:migrate

# 5. (Optional) Preview seed mapping from CSV (no DB writes)
pnpm db:seed:preview

# 6. Start API + web (one terminal)
pnpm dev
```

Alternative full Docker stack (Postgres + API + Nginx static web):

```bash
# 1. Install dependencies (needed for builds/tests in this repo)
pnpm install

# 2. Start full stack (builds api/nginx images)
pnpm dev:docker
```

If port `5432` is already in use on your host:

```bash
POSTGRES_PORT=5433 pnpm dev:docker
```

Then open:

- **Web app (via Nginx):** http://localhost
- **API health (via Nginx):** http://localhost/health
- **Auth endpoint check (via Nginx):** http://localhost/api/auth/ok

- **Web app:** http://localhost:5173  
- **API (e.g. health):** http://localhost:4000/health  
- **Auth endpoint check:** http://localhost:4000/api/auth/ok

---

## Smoke test

After starting the stack, you can confirm everything works:

1. **DB:** `docker compose ps` shows `postgres` (or `expense-management-db`) running.
2. **API health:** Open http://localhost:4000/health in a browser or run `curl http://localhost:4000/health` — response should be `{"status":"ok"}`.
3. **Web + auth:** Open http://localhost:5173, create an account on Home, then open `/dashboard` and confirm it loads as an authenticated page.
4. **Seed (optional):** After running seed, you can verify data in the DB or via the app when those features exist.

If running full Docker stack instead:

1. `curl http://localhost/health` returns `{"status":"ok"}`.
2. Open `http://localhost` and confirm the app loads.
3. `curl http://localhost/api/auth/ok` returns `{"ok":true}`.

---

## Environment variables

`.env` is required at the repository root. The committed `.env.example` already contains local defaults for:

- `DATABASE_URL`
- `POSTGRES_PORT` (optional, Docker-only host mapping; default `5432`)
- `PORT`
- `CORS_ORIGINS`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `VITE_API_URL`
- `SEED_BUDGET_CSV_PATH` (optional)
- `SEED_DEBT_CSV_PATH` (optional)
- `SEED_ACCOUNTS_CSV_PATH` (optional)
- `SEED_CSV_PATH` (optional legacy alias for budget CSV path)
- `SEED_USER_EMAIL` (optional)
- `SEED_USER_NAME` (optional)
- `SEED_DEBT_START_DATE` (optional, `YYYY-MM-DD` for seeded installment plan start date)

For local development, you can usually just copy `.env.example` to `.env` without edits.

---

## What was needed for migrations to work

### Where `.env` lives

- **`.env` must be at the repository root** (next to `package.json`).
- Copy from `.env.example` and set at least `DATABASE_URL`.

### Why `pnpm db:migrate` (and not `pnpm --filter @expense-management/db migrate`)

- Prisma looks for `.env` in the **db package** directory (`packages/db/`), not the repo root.
- If you run `pnpm --filter @expense-management/db migrate` from root, Prisma runs in the db package context and does **not** see the root `.env`, so you get:
  - `Error: Environment variable not found: DATABASE_URL`
- **Fix:** Use the root script that loads the root `.env` before calling Prisma:
  - **`pnpm db:migrate`** (from repo root) uses `dotenv-cli` to load root `.env`, then runs Prisma migrate in the db package. So `DATABASE_URL` is set and migrations work.

### Summary

| Command | Where to run | Purpose |
|--------|---------------|--------|
| `pnpm db:migrate` | **Repo root** | Run/apply DB migrations (uses root `.env`) |
| `pnpm db:generate` | Repo root | Regenerate Prisma client |
| `pnpm --filter @expense-management/db migrate` | Repo root | Will fail with "DATABASE_URL not found" unless you put `.env` in `packages/db/` |

Keep a single `.env` at the repo root and use **`pnpm db:migrate`** for migrations.

### Better Auth env

- `BETTER_AUTH_URL` defaults to `http://localhost:4000` if omitted.
- `BETTER_AUTH_SECRET` is optional in local development, but required in production.

---

## Useful commands

| Command | Description |
|--------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Start API and web in parallel (Turborepo) |
| `pnpm dev:all` | Start Postgres, then API + web (one command) |
| `pnpm dev:docker` | Start full Docker stack (postgres + api + nginx) |
| `pnpm dev:docker:down` | Stop full Docker stack |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint |
| `pnpm typecheck` | Type-check |
| `pnpm db:migrate` | Run DB migrations (from root; loads root `.env`) |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:studio` | Open Prisma Studio using root `.env` |
| `pnpm db:seed:preview` | Parse CSV and print seed representation only (no DB writes) |
| `pnpm db:seed` | Apply CSV seed to DB (idempotent reset/recreate for seed user) |
| `docker compose up -d postgres` | Start Postgres only (for local dev) |

---

## URLs

| Service | URL |
|--------|-----|
| Web (Vite) | http://localhost:5173 |
| API (Fastify) | http://localhost:4000 |
| API health | http://localhost:4000/health |
| API auth health | http://localhost:4000/api/auth/ok |

---

## Troubleshooting

### "Environment variable not found: DATABASE_URL"

- Ensure `.env` exists at the **repo root** (copy from `.env.example`).
- Run migrations with **`pnpm db:migrate`** from the repo root, not `pnpm --filter @expense-management/db migrate`.

### "no configuration file provided: not found" (Docker)

- Run `docker compose` from the **repository root** (where `docker-compose.yml` is), e.g.:
  - `cd c:\Users\alfca\dev\expense-management`
  - `docker compose up -d postgres`

### Port 5432 already in use

- Another Postgres (or service) is using 5432. Stop it, or run with `POSTGRES_PORT=5433`:
  - `POSTGRES_PORT=5433 docker compose up -d postgres`
  - `POSTGRES_PORT=5433 pnpm dev:docker`
- If you change the DB host port for host-run API (`pnpm dev`), update `DATABASE_URL` accordingly.

### Port 80 already in use (full Docker stack)

- Another web server is bound to 80. Stop it, or change nginx published port in `docker-compose.yml` from `80:80` to another value (for example `8080:80`) and use that URL.

### Migrations out of date

- After pulling schema changes: from root, run `pnpm db:migrate` to apply new migrations.
- To regenerate the client only: `pnpm db:generate` or `pnpm build`.

### Postgres not running

- Start it: `docker compose up -d postgres`.
- Check: `docker compose ps` or `docker ps` and confirm the postgres container is up.

### TypeScript / IDE shows many errors

- The repo uses a **base tsconfig** (`tsconfig.base.json` at root). Each app and package extends it so options are consistent.
- **Install deps:** From repo root run `pnpm install` so all workspace packages and types are installed (pnpm may hoist them to root `node_modules`).
- **Use workspace TypeScript:** In VS Code/Cursor, run **“TypeScript: Select TypeScript Version”** and choose **“Use Workspace Version”** so the IDE uses the project’s TypeScript and resolves workspace packages correctly.
- **Restart TS server:** Run **“TypeScript: Restart TS Server”** after changing tsconfig or installing deps.
- **Check from CLI:** Run `pnpm typecheck` at root; if that passes, the IDE may just need the steps above.
