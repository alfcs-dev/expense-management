# Expense Management

## Developer Onboarding

Use the full local setup guide:

- `docs/LOCAL_DEVELOPMENT.md`

Quick start (from repo root):

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm dev
```

Local URLs:

- Web: `http://localhost:5173`
- API health: `http://localhost:4000/health`
- Auth health: `http://localhost:4000/api/auth/ok`

Useful commands:

- `pnpm dev` - API + web
- `pnpm dev:all` - postgres + API + web
- `pnpm dev:docker` - full Docker stack (postgres + API + Nginx web)
- `pnpm db:studio` - Prisma Studio
- `pnpm typecheck`
- `pnpm build`

## Repository Architecture

Monorepo managed with `pnpm` workspaces + Turborepo.

Apps:

- `apps/web` - Vite + React frontend
- `apps/api` - Fastify + tRPC backend

Packages:

- `packages/db` - Prisma schema, migrations, and shared Prisma client
- `packages/trpc` - Shared tRPC router/context/procedures
- `packages/shared` - Shared TypeScript types/schemas/constants

Planning and docs:

- `.planning/in_progress/phase-01-foundation.md` - active phase tracker
- `docs/LOCAL_DEVELOPMENT.md` - full local setup and troubleshooting
- `docs/DEPLOYMENT_DO.md` - production deployment runbook for DigitalOcean
