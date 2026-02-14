# Phase 6 — Bank & SAT Integration (Automation)

> **Source:** [PLAN.md](../PLAN.md) Section 6, Phase 6 and Section 9.  
> **Detailed research:** [BANK_SAT_INTEGRATION_RESEARCH.md](../research/BANK_SAT_INTEGRATION_RESEARCH.md).  
> **When starting this phase:** move this file to `../in_progress/` and use the "In progress" section at the bottom to log achievements, decisions, and roadblocks.

**Planning Metadata**
- Status: draft
- Owner: @alfcs
- Target start: Post-MVP milestone
- Target end: Post-MVP milestone
- Actual start: TBD
- Actual end: TBD
- Dependencies: Phase 3 complete; vendor selection finalized; dedup design approved
- Linked PRs/issues: TBD

---

## 1. Goals

- Belvo as primary provider for banking and SAT/CFDI data (or Syncfy/DIY fallback per research).
- Bank and SAT account linking via Belvo Connect Widget (or equivalent).
- Automated bank transaction sync (daily or webhook-triggered).
- Automated CFDI/invoice sync via Belvo `/api/invoices/`.
- Transaction → expense matching and deduplication (staging pipeline).
- Cross-reference CFDIs with bank transactions for reconciliation.
- Optional: import Belvo enrichment (recurring expenses, incomes).
- Fallback: @nodecfdi for SAT if Belvo fiscal pricing is prohibitive.

---

## 2. Prerequisites

- Phase 3 complete (expenses, categories, accounts; optional: StagedTransaction from Phase 3 or add here).
- Belvo (or Syncfy) account and API keys; pricing confirmed for ~6 links (banks + SAT).
- [DEDUPLICATION_RECONCILIATION.md](../docs/DEDUPLICATION_RECONCILIATION.md) read and staging design agreed.

---

## 3. What's needed (task breakdown)

### 3.1 Vendor and pricing

- [ ] Contact Belvo and Syncfy sales; get pricing for personal use (~6 links: 5 banks + 1 SAT).
- [ ] Test Belvo sandbox: validate coverage for HSBC, Nu, Uala, Stori (or your target banks).
- [ ] Decide: Belvo vs Syncfy vs @nodecfdi for fiscal based on pricing and coverage.

### 3.2 Belvo API wrapper

- [ ] Typed wrapper (fetch + Zod): links, accounts, transactions, invoices. Prefer fetch + Zod over stale `belvo` SDK per research.
- [ ] Auth: API key/secret from env; handle token or basic auth as per Belvo docs.
- [ ] Error handling and rate limits; log for debugging.

### 3.3 Connect Widget (bank + SAT linking)

- [ ] Integrate Belvo Connect Widget in web app: user clicks "Link bank" or "Link SAT"; widget opens; on success, store link id and fetch accounts/transactions.
- [ ] Backend: create/update `BankLink` and `Account` records; link external account IDs to internal accounts.
- [ ] SAT linking: same widget or separate flow for fiscal; store SAT link for invoice retrieval.

### 3.4 Automated bank transaction sync

- [ ] Job (cron or scheduler): for each active BankLink, fetch transactions since last sync (or last N days).
- [ ] Write to StagedTransaction (source = 'banking_api', externalId = banking API txn ID, amount, date, description, accountId if mapped).
- [ ] Run matching algorithm (see DEDUPLICATION_RECONCILIATION): match staged → existing Expense (by amount, date, account, fuzzy description); if matched, update expense or link; if not, create new Expense or leave staged for user review.
- [ ] Update lastSyncAt on BankLink.

### 3.5 Automated CFDI/invoice sync

- [ ] Job: for linked SAT connection, call Belvo `/api/invoices/` (or equivalent); get new CFDIs.
- [ ] Map to StagedTransaction (source = 'cfdi', externalId = UUID) or directly to Expense with cfdiUuid and cfdiData.
- [ ] Matching: same as bank — match to existing expense or create; cross-reference with bank transactions when both exist (reconciliation status).

### 3.6 Enrichment (optional)

- [ ] Belvo `/api/recurring-expenses/` and `/api/incomes/`: import or suggest recurring templates and income entries. Map to RecurringExpense or internal income model; allow user to accept/reject.

### 3.7 Staging and matching

- [ ] Implement matching algorithm from DEDUPLICATION_RECONCILIATION: confidence score, match reason, manual review queue for low-confidence.
- [ ] UI: list StagedTransaction (pending, matched, rejected); user can confirm match, link to expense, or create new expense from staged.
- [ ] Deduplication: never create duplicate Expense for same externalId (banking API txn id or CFDI UUID).

### 3.8 Fallback: @nodecfdi for SAT

- [ ] If Belvo fiscal is dropped: use @nodecfdi for SAT CFDI retrieval (e.g. sat-ws-descarga-masiva); parse XML; same staging and matching flow. Document in research.

---

## Definition of Ready (DoR)

- [ ] Required schema/docs for this phase are finalized.
- [ ] External vendor/provider decisions are finalized (if applicable).
- [ ] Required environment variables and secrets are confirmed.
- [ ] Validation plan is agreed (`pnpm lint`, `pnpm typecheck`, smoke checks, and any relevant performance checks).

---

## 4. How to achieve it

### 4.1 Key references

- [BANK_SAT_INTEGRATION_RESEARCH.md](../research/BANK_SAT_INTEGRATION_RESEARCH.md) — API endpoints, SDK notes, pricing, integration effort.
- [DEDUPLICATION_RECONCILIATION.md](../docs/DEDUPLICATION_RECONCILIATION.md) — StagedTransaction, matching logic, reconciliation status.
- [PLAN.md](../PLAN.md) Section 9 — Recommendation (Belvo primary, @nodecfdi fallback).

### 4.2 Suggested order

1. Confirm vendor and pricing; sandbox tests.
2. Implement Belvo API wrapper (links, accounts, transactions, invoices).
3. Connect Widget integration; BankLink and Account creation.
4. Staging: ensure StagedTransaction schema and write path for Belvo transactions and CFDI.
5. Matching algorithm (amount, date, account, description); link or create Expense.
6. Cron/scheduler for daily (or webhook) sync; run sync and matching.
7. CFDI sync job; cross-reference with bank data.
8. UI for staged transactions and manual review.
9. Optional: enrichment import. Optional: @nodecfdi path if needed.

### 4.3 Technical notes

- **Security:** Store Belvo (and SAT) credentials securely; never log full responses with PII. Use env for API keys.
- **Idempotency:** Use externalId (banking API txn id, CFDI UUID) as unique key; upsert StagedTransaction and avoid duplicate Expense.

---

## 5. Decisions to make

- Webhook vs cron for sync frequency; Belvo webhook support if available.
- Whether to create Expense automatically for high-confidence matches or always require user confirmation for first version.
- Enrichment: auto-create RecurringExpense suggestions or only show in UI for user to add.

---

## 6. Possible roadblocks

- Belvo sandbox limitations (which banks, which endpoints); may need production keys for full testing.
- Matching false positives/negatives; tune thresholds and add manual review.
- SAT linking: user may need to re-authenticate periodically; handle expired links.

---

## 7. Definition of done

- [ ] At least one bank and (if using Belvo fiscal) SAT linked via widget; transactions and invoices sync.
- [ ] Automated sync runs on schedule (or webhook); new transactions and CFDIs enter staging.
- [ ] Matching links or creates expenses; no duplicates for same externalId.
- [ ] User can review and resolve staged transactions in UI.
- [ ] Reconciliation status (e.g. full/partial) updated when CFDI and bank txn match.
- [ ] Fallback @nodecfdi path documented and implemented if Belvo fiscal not used.

---

## 8. In progress (use after moving to in_progress)

*When you start Phase 6, move this file to `../in_progress/` and fill below.*

**Achievements:**
- 

**Decisions:**
- 

**Roadblocks:**
- 
