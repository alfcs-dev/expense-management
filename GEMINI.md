# Gemini CLI Context: Expense Management System

This document provides essential context for the Gemini CLI to assist in the development and maintenance of the Expense Management project.

## Project Overview

A comprehensive personal finance and budget management application built as a TypeScript monorepo. It handles multi-account tracking, recurring expenses, installment plans (MSI), and savings goals, with planned integrations for Mexican banking APIs (Belvo) and SAT (CFDI).

### Core Technologies
- **Monorepo Management:** [Turborepo](https://turbo.build/) + [pnpm workspaces](https://pnpm.io/workspaces)
- **Backend:** [Fastify](https://www.fastify.io/) with [tRPC](https://trpc.io/) v11
- **Frontend:** [React](https://react.dev/) + [Vite](https://vitejs.dev/) SPA
- **Routing & Data Fetching:** [TanStack Router](https://tanstack.com/router) & [TanStack Query](https://tanstack.com/query)
- **Database:** [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/)
- **Validation:** [Zod](https://zod.dev/)
- **Authentication:** [Better Auth](https://www.better-auth.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)

## Repository Structure

```text
.
├── apps/
│   ├── api/            # Fastify + tRPC server (Backend)
│   └── web/            # React + Vite + TanStack Router (Frontend)
├── packages/
│   ├── db/             # Prisma schema, migrations, and seed scripts
│   ├── shared/         # Shared utilities, constants, and Zod schemas
│   └── trpc/           # Centralized tRPC router definitions
├── .planning/          # Detailed project roadmap and design docs
├── docker-compose.yml  # Local infrastructure (PostgreSQL)
└── turbo.json          # Turborepo task configuration
```

## Getting Started

### Prerequisites
- Node.js (>=20)
- pnpm (>=9)
- Docker (for local database)

### Development Commands
- `pnpm dev`: Start all applications in development mode.
- `pnpm dev:all`: Spin up Dockerized PostgreSQL and start dev servers.
- `pnpm build`: Build all packages and applications.
- `pnpm lint`: Run linting across the monorepo.
- `pnpm typecheck`: Run TypeScript type checking.
- `pnpm db:migrate`: Run Prisma migrations (requires `.env`).
- `pnpm db:generate`: Regenerate the Prisma client.

## Development Conventions

- **Type Safety:** Ensure end-to-end type safety by defining Zod schemas in `packages/shared` or `packages/trpc` and sharing them between the API and Web app.
- **Database Changes:** All schema changes must be done in `packages/db/prisma/schema.prisma` followed by `pnpm db:migrate`.
- **Component Pattern:** Use shadcn/ui components in `apps/web`. New UI components should be consistent with the existing Tailwind-based design.
- **API Development:** Define new procedures in `packages/trpc/src/routers/`. The API server in `apps/api` automatically picks up changes from the shared TRPC package.
- **Documentation:** Refer to `.planning/PLAN.md` for the current roadmap and `docs/` for specific technical research (e.g., bank integrations).

## Key Files for Reference
- `packages/db/prisma/schema.prisma`: The "source of truth" for the data model.
- `packages/trpc/src/root.ts`: Main entry point for API routing.
- `.planning/PLAN.md`: Current development phase and feature status.
- `apps/web/src/main.tsx`: Frontend entry point and provider setup.
- `apps/api/src/index.ts`: Backend server initialization.
