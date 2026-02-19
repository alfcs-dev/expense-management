# Repository Guidelines

## Project Structure & Module Organization
This repo is a `pnpm` workspace managed with Turborepo.

- `apps/web`: Vite + React frontend (`src/routes`, `src/utils`).
- `apps/api`: Fastify + tRPC API (`src/index.ts` entrypoint, `/health` route).
- `packages/trpc`: Shared tRPC router/context used by API and web.
- `packages/db`: Prisma schema and migrations (`prisma/schema.prisma`, `prisma/migrations`).
- `packages/shared`: Shared TypeScript utilities/types.
- `docs/LOCAL_DEVELOPMENT.md`: Local setup and troubleshooting.

## Build, Test, and Development Commands
Run from repository root unless noted.

- `pnpm install`: Install workspace dependencies.
- `pnpm dev`: Start API and web via Turbo.
- `pnpm dev:all`: Start Postgres in Docker, then API + web.
- `pnpm build`: Build all apps/packages.
- `pnpm lint`: Run ESLint tasks across the workspace.
- `pnpm typecheck`: Run TypeScript checks across the workspace.
- `pnpm db:migrate`: Apply Prisma migrations using root `.env`.
- `pnpm db:generate`: Regenerate Prisma client.

## Coding Style & Naming Conventions
- Language: TypeScript (ES modules, `strict` mode via `tsconfig.base.json`).
- Use 2-space indentation, semicolons, and double quotes to match existing files.
- Naming: `camelCase` for variables/functions, `PascalCase` for React components/types, lowercase folder names.
- React/web file naming convention (primary):
  - Component files: `PascalCase` (example: `UserProfile.tsx`).
  - Non-component files: `kebab-case` or `camelCase` (example: `format-date.ts` or `formatDate.ts`).
  - Folders: `kebab-case` (example: `user-profile/`).
  - Custom hooks: `camelCase` prefixed with `use` (example: `useAuth.ts`).
- Keep package boundaries clear; shared logic belongs in `packages/*`, not duplicated in apps.

## Testing Guidelines
There is currently no committed automated test suite. Minimum validation for changes:

- `pnpm typecheck`
- `pnpm lint`
- Manual smoke check:
  - API: `curl http://localhost:4000/health` returns `{"status":"ok"}`
  - Web: `http://localhost:5173` loads without runtime errors

When adding tests, place them near source files using `*.test.ts` / `*.test.tsx`.

## Commit & Pull Request Guidelines
Recent history follows concise, prefixed messages such as:
- `feat(apps): ...`
- `feat(packages): ...`
- `chore(monorepo): ...`

Use imperative subject lines and scoped prefixes when possible. For PRs, include:
- what changed and why
- impacted apps/packages
- setup or migration steps (especially DB changes)
- screenshots/GIFs for UI changes and linked issue(s) when applicable

## Agent Commit Workflow
- Always create scoped commits grouped by concern (do not mix unrelated backend/frontend/docs changes in one commit).
- Preferred commit scopes:
  - `feat(web): ...`, `fix(web): ...`, `chore(web): ...` for `apps/web`.
  - `feat(db): ...`, `fix(db): ...`, `chore(db): ...` for `packages/db`.
  - `feat(trpc): ...`, `fix(trpc): ...` for `packages/trpc`.
  - `docs(planning): ...`, `docs(monorepo): ...`, `chore(monorepo): ...` for cross-cutting docs/tooling.
- Before each commit:
  - stage only relevant files (`git add <paths...>`).
  - verify staged diff (`git diff --staged --name-only` and `git diff --staged`).
  - run applicable validation for that scope (at minimum lint/typecheck for touched area).
- Commit message rules:
  - use imperative, explicit subjects.
  - mention the concrete intent and affected area.
  - avoid generic subjects like `update files` or `fix stuff`.
- If multiple independent changes exist, commit in sequence:
  1. infra/schema/runtime fixes
  2. feature/UI changes
  3. docs/rules/planning updates

## Security & Configuration Tips
- Keep secrets only in root `.env` (copy from `.env.example`).
- Run Prisma commands through root scripts (`pnpm db:migrate`) so `DATABASE_URL` is loaded correctly.

## Planning Update Protocol
- Any phase implementation PR must update the relevant planning artifacts in the same branch.
- Update the active phase file checklist in `.planning/in_progress/*` (or move a draft into `in_progress` when starting).
- Record decisions, achievements, and roadblocks in the phase file "In progress" section.
- Add or refresh links to related design/research docs when implementation changes assumptions or scope.

## Planning Context Preflight
- Before starting implementation, review `.planning/in_progress/` to identify active phase status, completed checklist items, and current blockers.
- Also review relevant `.planning/drafts/` phase file(s) to confirm upcoming scope, dependencies, and definition-of-ready checks.
- If architecture or sequencing decisions are being made, cross-check against both directories and note any conflicts or drift in your response/PR notes.

## Done Criteria for Agent Tasks
- For plan-driven tasks, do not mark work complete until code, docs, and validation status are all reflected.
- Minimum closure checklist:
  - Code changes are complete for the scoped task.
  - Planning/docs updates are committed alongside code changes.
  - Validation commands were run (or clearly marked as not run/blocking).
  - Remaining risks or follow-ups are explicitly listed.
