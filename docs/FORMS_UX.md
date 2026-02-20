# Forms UX Surface Strategy

This document defines which interaction surface we use for each entity form and why.

## Goals

- Keep quick actions fast.
- Keep complex forms readable.
- Keep behavior consistent across create/edit flows.

## Surface Policy

- Drawer is the default for medium/complex forms.
- Modal is used for quick transactional forms that should be reusable from multiple entry points.
- Popover is used only for tiny, low-risk forms.

## Entity Mapping

- `Categories`: popover for create/edit.
- `Budgets`: modal for create.
- `Expenses`: modal for create/edit.
- `Accounts`: drawer for create/edit.
- `Recurring expenses`: drawer for create/edit.

## Shared Behavior Contract

- Same action order in footers: cancel then save.
- Same disabled/pending submit state handling.
- Same close semantics:
  - successful submit closes the surface
  - manual cancel closes and resets editing state
- Same route-level cache invalidation pattern after mutation success.

## Out of Scope

- Tags are intentionally deferred to a separate phase.
- This phase does not change tRPC schemas or Prisma models.
