# Core/UI Decision Log

Track implementation-level decisions, alternatives, rationale, and revisit triggers.

| Date | Decision | Chosen Option | Alternatives Considered | Why | Revisit Trigger |
|---|---|---|---|---|---|
| 2026-02-14 | Deployable baseline | `main` (Phase 2 core) | Hard revert Phase 3 branch; soft-hide Phase 3 routes | Preserve stable baseline and avoid destructive rollback while simplifying execution | If `main` diverges from required core workflow or lacks critical fixes |
| 2026-02-14 | Advanced work handling | Keep `phase-3-advanced-features` parked/deferred | Immediate merge; destructive rollback | Retain advanced work as reference while preventing scope creep in core hardening | After `v0-core-stable`, reintroduce features in controlled sequence |
| 2026-02-14 | Direct API testing strategy | Postman-first | Swagger/OpenAPI-first; both in parallel | Fastest path to direct API validation with current tRPC architecture | If external API consumers or formal API contracts become urgent |
| 2026-02-14 | Execution model | Vertical slices (API + UI + checks) | Backend-first, dual-track mock-only UI | Reduces integration drift and keeps each feature shippable end-to-end | If team size increases and separate frontend/backend streams are needed |
| 2026-02-14 | UI library direction (current phase) | Keep `shadcn/ui` direction | Migrate now to Mantine/MUI/Chakra/Radix/Ant | Avoid migration cost during core stabilization; focus on reliability and polish | Reassess after core stabilization and UI velocity metrics |
| 2026-02-14 | Advanced feature order after core | Installments -> Imports -> Auto-categorization -> Transfers/Savings -> advanced reports | Keep original full Phase 3 order | Prioritize features with fastest real-data value after core baseline | Reorder only with explicit product priority change |

## Notes
- Every material product/architecture change must add a row here in the same PR.
- Planning artifacts should reference this file when a decision is “locked.”
