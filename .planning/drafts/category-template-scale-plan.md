# Category Template Scale Plan (System Categories vs Per-User Duplicates)

> **Scope:** Future-facing scale hardening for category management. This plan documents how to move from repeated default categories per user to a template-linked model.

**Planning Metadata**
- Status: draft
- Owner: @alfcs
- Target start: After core stable (`v0-core-stable`) or when user growth warrants
- Dependencies: Stable transaction/category UX and baseline analytics needs
- Related phase: `.planning/drafts/phase-08-performance-scale.md`

---

## 1. Problem Statement

Today we auto-provision default categories per user (for example `Income`, `Expenses`). This keeps UX simple, but duplicates the same semantic categories across all users.

At larger scale, this causes:
1. category table growth from repeated defaults
2. slower queries/index churn on category-heavy views
3. global taxonomy changes requiring N-user updates
4. localization/name drift for what should be canonical defaults

---

## 2. Goals

1. Keep current UX (simple category selection with defaults) unchanged.
2. Reduce duplication cost for system-default categories.
3. Preserve user-specific custom categories and edits.
4. Enable global/default taxonomy evolution without mass rewrites.

---

## 3. Target Model

### 3.1 Data model direction

Introduce `system_categories` as canonical templates, keep `categories` for user-owned rows.

Proposed additions:
1. `system_categories` table
   - `id`
   - `code` (stable key, e.g. `income.default`, `expense.default`)
   - `kind` (`income|expense|...`)
   - `default_name`
   - `is_active`
2. Optional `categories.system_category_id`
   - nullable FK to `system_categories.id`
   - indicates category was derived from system template

### 3.2 API behavior

1. Category list endpoint returns user categories plus active system defaults (or user materialized clones depending on strategy).
2. Transaction/category validation remains driven by `kind`.
3. Default category lookup prefers system key (e.g. `income.default`) over name matching.

---

## 4. Migration Strategies

### Strategy A (recommended): Template-linked user rows

1. Keep user rows in `categories` (least disruptive).
2. Add `system_category_id` to existing default-like rows where match exists.
3. Future default provisioning links rows instead of plain duplicate names.

Pros:
1. minimal UX breakage
2. simple rollback
3. easier incremental rollout

Cons:
1. still stores one row per user for defaults

### Strategy B: Virtual system categories (no per-user duplicates)

1. System defaults stay only in `system_categories`.
2. Category list API merges system + user categories at read time.
3. Transactions can reference either user category id or system category id via abstraction.

Pros:
1. maximum deduplication

Cons:
1. larger app/API refactor
2. more migration/testing complexity

---

## 5. Execution Plan (incremental)

1. Add `system_categories` table + seed canonical defaults.
2. Add `categories.system_category_id` nullable FK.
3. Backfill existing `Income`/`Expenses` user rows to link templates where safe.
4. Update provisioning logic to use template linkage by key instead of name.
5. Add uniqueness guard on user categories to reduce accidental duplicates:
   - either `(user_id, kind, normalized_name)`
   - or app-level normalized check if DB expression index is deferred.
6. Add telemetry/reporting:
   - count of unlinked default-like categories
   - template link coverage %

---

## 6. Validation Checklist

1. Existing users keep seeing same categories after migration.
2. New users receive default categories without duplicate rows per user+name+kind.
3. Transaction create/update still validates sign/category-kind correctly.
4. Category CRUD on custom categories remains unchanged.
5. Performance baseline before/after documented for category list query.

---

## 7. Risks and Mitigations

1. Risk: incorrect backfill links user-custom categories.
   - Mitigation: strict backfill rules (`kind` + exact known default names + no parent + optional manual review mode).
2. Risk: translated/default names differ by locale.
   - Mitigation: use stable system `code` for logic; names are display-only.
3. Risk: duplicate categories remain from historical data.
   - Mitigation: one-time dedup report and optional admin cleanup script.

---

## 8. Done Criteria

1. Template model exists and is seeded.
2. Default provisioning uses template keys.
3. Existing users migrated with no UX regression.
4. Category duplication growth is bounded by constraints/logic.
5. Related planning files linked and updated in in-progress log.
