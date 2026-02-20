# Phase 2.6 — Finance V2 Stabilization & Replan Baseline

> **Source context:** In-branch stabilization work on `phase-2.6-finance-v2` to be merged and then replanned from `main`.

**Planning Metadata**
- Status: in_progress
- Owner: @alfcs
- Baseline branch: `phase-2.6-finance-v2`
- Start date: 2026-02-19
- Target end: TBD (post-merge replanning)
- Dependencies: Phase 2.5 core hardening baseline
- Linked checkpoint commit: `b5469cf`
- Linked predecessor: `.planning/in_progress/phase-2.5-core-hardening.md`

---

## 1. Objective

Capture a clean baseline of finance-v2 progress that is stable enough to merge, then replan next increments from `main` without losing decisions or implementation context.

---

## 2. Scope Snapshot (Current Baseline)

### In scope (implemented in this branch)
- Transaction intent flow split:
  - `/transactions` list + filters hub
  - `/transactions/deposit` form (income path)
  - `/transactions/expense` form (expense path)
- Backend transaction safeguards:
  - sign/category-kind consistency checks
  - atomic account balance projection updates on create/update/delete
- Category bootstrap behavior:
  - default user categories provisioned on list when missing (`Income`, `Expenses`)
- Opening balance foundations:
  - account creation writes an initial balance snapshot
  - migration backfills missing opening snapshots
- UI routing baseline:
  - dashboard entry uses `/transactions` as central flow

### Out of scope (for post-merge replan)
- Full transaction list UX polish (advanced quick filters, bulk actions, pagination tuning).
- Statement automation (auto-close scheduling/job execution).
- Scale-oriented category template dedup migration execution.

---

## 3. Delivery Checklist

- [x] `/transactions` list route mounted in router.
- [x] Deposit/expense routes mounted and usable as intent-specific forms.
- [x] Dashboard navigation aligned to transaction hub.
- [x] Web validation passed for routing changes (`typecheck`, `lint`).
- [x] Checkpoint commit created to mark merge-ready baseline.
- [ ] Replan document from `main` after merge with updated sequencing and risks.

---

## 4. Validation Status

- Completed in this baseline cycle:
  - `pnpm --filter @expense-management/web typecheck`
  - `pnpm --filter @expense-management/web lint`

- Pending for merge/release gate (run in merge context):
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm build`

---

## 5. In Progress Log

**Achievements**
- 2026-02-20: Confirmed transaction hub route behavior and navigation wiring:
  - `apps/web/src/routes/transactions.tsx`
  - `apps/web/src/routes/router.tsx`
  - `apps/web/src/routes/dashboard.tsx`
- 2026-02-20: Recorded merge checkpoint for branch stabilization:
  - Commit `b5469cf` created as the agreed new starting point.
- 2026-02-20: Stabilized CI for branch gate checks:
  - Added `DATABASE_URL` to Turborepo global env passthrough so `@expense-management/db` typecheck can resolve Prisma config in GitHub Actions.
  - Added explicit workspace dependency build before API smoke tests in `.github/workflows/ci.yml` so Vitest resolves `@expense-management/trpc` reliably in CI.
  - Added `DATABASE_URL` to the CI `build` job env so `@expense-management/db` build can run `prisma generate` without Prisma config env resolution failures.

**Decisions**
- Keep both patterns:
  - `/transactions` for discovery, list, and filters.
  - `/transactions/deposit` and `/transactions/expense` for low-friction intent capture.
- Treat this phase file as a handoff artifact for replanning once merged into `main`.

**Roadblocks**
- None blocking this checkpoint baseline.
