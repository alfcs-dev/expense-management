# Planning + AGENTS Improvements (Review Draft)

## Scope reviewed
- `AGENTS.md`
- `.planning/PLAN.md`
- `.planning/in_progress/phase-01-foundation.md`
- `.planning/drafts/README.md`
- `.planning/drafts/phase-02-core-features.md`
- `.planning/drafts/phase-03-advanced-features.md`
- `.planning/drafts/phase-04-deployment-polish.md`
- `.planning/drafts/phase-05-mobile-app.md`
- `.planning/drafts/phase-06-bank-sat-integration.md`
- `.planning/drafts/phase-07-multi-user-shared-objectives-notifications.md`
- `.planning/drafts/phase-08-performance-scale.md`
- `.planning/docs/SCHEMA_VISUALIZATION.md`
- `.planning/docs/SHARED_OBJECTIVES_DESIGN.md`
- `.planning/docs/DEDUPLICATION_RECONCILIATION.md`
- `.planning/research/BANK_SAT_INTEGRATION_RESEARCH.md`
- `.planning/research/DEV_SERVICES_RESEARCH.md`

## High-impact improvements

1. Add a lightweight planning metadata block to every phase file.
- Why: current files are consistent in sections, but missing machine-readable fields for status tracking.
- Add at top of each phase:
  - `Status: draft | in_progress | blocked | done`
  - `Owner:`
  - `Target start:`
  - `Target end:`
  - `Actual start:`
  - `Actual end:`
  - `Dependencies:`
  - `Linked PRs/issues:`

2. Introduce Definition of Ready (DoR) per phase.
- Why: each phase has "Prerequisites" but no strict gate for starting work.
- Add a short DoR checklist before "How to achieve it", including:
  - Required schema/docs finalized.
  - External vendor decisions finalized (if applicable).
  - Env vars and secrets list confirmed.
  - Validation plan agreed (`lint`, `typecheck`, smoke tests, any perf checks).

3. Split checklists into `MVP` vs `Stretch` tasks.
- Why: current checklists are comprehensive but can blur must-have vs nice-to-have.
- Apply to all phase files under `3. What's needed` and `7. Definition of done`.

4. Add explicit risk register template to each phase.
- Why: "Possible roadblocks" exists, but no owner/mitigation/trigger tracking.
- Template columns:
  - `Risk`
  - `Impact (H/M/L)`
  - `Likelihood (H/M/L)`
  - `Owner`
  - `Mitigation`
  - `Trigger signal`

5. Add cross-reference links from each phase to exact design/research docs.
- Why: references exist, but linkage can be tighter and reduce context-switching.
- Example: phase 6 should deep-link to sections in `BANK_SAT_INTEGRATION_RESEARCH.md`; phase 7 should deep-link to `SHARED_OBJECTIVES_DESIGN.md`; phase 8 should link back to `PLAN.md` section anchors.

## PLAN.md improvements

1. Add "Current baseline" section near roadmap.
- Include actual current state snapshot (what is implemented today), not only desired phases.
- This reduces drift between roadmap and real repo state.

2. Convert long option analyses into appendices.
- Keep decision + rationale in main body.
- Move large comparisons (e.g., GraphQL deep analysis) to appendix/research docs.
- Benefit: easier re-reading and faster onboarding.

3. Add explicit dependency map between phases.
- Example:
  - Phase 3 depends on Phase 2 recurring expense maturity.
  - Phase 7 depends on auth and collaborator model hardening.
  - Phase 8 can start partially before 7 (frontend perf work is partly independent).

## Phase file improvements

1. `.planning/in_progress/phase-01-foundation.md`
- Sections mention "Sections 4.1–4.3 unchanged" but those details are omitted in-file; include them directly or link to canonical source to avoid ambiguity.
- Add a compact "Remaining critical path" list at the top of section 8 so unfinished items are obvious.

2. `.planning/drafts/README.md`
- Add explicit archive convention (for completed phases), e.g. `.planning/done/phase-0N-...`.
- Add rule that moved files keep same filename to preserve references.

3. Draft phases 2-8
- Add effort estimate per checklist item (`S/M/L` or hours).
- Add test evidence expectations per phase (what proof is required to mark done).

## Design/research doc improvements

1. Add "Decision log" subsection to each design/research doc.
- Keep immutable decision records with date and rationale.
- Useful for revisiting choices like Belvo vs alternatives.

2. Add "Assumptions that may change" in vendor research docs.
- Especially for pricing/coverage claims in:
  - `.planning/research/BANK_SAT_INTEGRATION_RESEARCH.md`
  - `.planning/research/DEV_SERVICES_RESEARCH.md`
- Include "last verified on" date and re-validation cadence.

3. Add implementation readiness check in design docs.
- Before coding starts, confirm:
  - Data model finalized
  - API contract finalized
  - Migration plan finalized
  - Rollback plan defined

## AGENTS.md improvements

1. Add a "Planning update protocol" section.
- Require that any phase implementation PR updates:
  - Current phase checklist
  - In-progress log (decisions/roadblocks)
  - Relevant design/research doc links

2. Add "Done criteria for agent tasks".
- For plan-related coding tasks, require:
  - Code changes complete
  - Docs updated
  - Validation commands run
  - Remaining risks explicitly listed

3. Add "When to create a mini-RFC" trigger.
- Example triggers:
  - New external dependency/vendor
  - Schema changes affecting 3+ entities
  - Auth model changes
  - Background-job architecture changes

4. Add strict file-level ownership conventions for planning.
- Example:
  - `PLAN.md` = strategic source of truth
  - `drafts/*` = phase templates
  - `in_progress/*` = execution log
  - `docs/*` = design specs
  - `research/*` = vendor/platform research

## Quick wins (do these first)

1. Add metadata header + DoR to all phase files.
2. Add `Last verified` date fields to both research docs.
3. Add planning update protocol to `AGENTS.md`.
4. Create `.planning/done/` and define move rule in drafts README.

## Suggested follow-up execution order

1. Update `AGENTS.md` with planning protocol and completion expectations.
2. Standardize phase file template and apply to phase 2-8 drafts.
3. Patch `phase-01-foundation.md` to expose remaining critical path clearly.
4. Add decision-log sections to design/research docs.
