# Expense Deduplication & Reconciliation — Design Document

> Referenced from [SCHEMA_VISUALIZATION.md](SCHEMA_VISUALIZATION.md) and
> [PLAN.md](../PLAN.md) Phase 6.

---

## 1. The Problem

A single real-world purchase can enter the system through **three independent
channels**, at different times, with different descriptions:

```
You buy shoes at Liverpool for $2,500 MXN on Feb 10, pay with HSBC credit
card, and ask for a factura (CFDI).

Channel 1 — Manual (immediate)
  User enters: "Liverpool shoes" / $2,500 / Feb 10 / HSBC WE / Category: Misc

Channel 2 — Banking API sync (hours later, via webhook)
  Banking API returns: "LIVERPOOL INSURGENTES SUR" / $2,500.00 / Feb 10 / txn_bel_abc123

Channel 3 — SAT CFDI sync (days later, via cron)
  CFDI contains: "EL PUERTO DE LIVERPOOL SA DE CV" / RFC: PLI861117PA7
                 $2,155.17 + $344.83 IVA = $2,500.00 / UUID: 8a3f-...-e91b
```

Without deduplication, this becomes **three expenses** in the budget totaling
$7,500. The user only spent $2,500.

### 1.1 Why This Is Hard

| Aspect | Manual | Banking API | CFDI |
|---|---|---|---|
| **Description** | "Liverpool shoes" | "LIVERPOOL INSURGENTES SUR" | "EL PUERTO DE LIVERPOOL SA DE CV" |
| **Amount** | $2,500.00 | $2,500.00 | $2,155.17 + $344.83 IVA |
| **Date** | Feb 10 | Feb 10 (or Feb 11 if bank processes next day) | Feb 10 |
| **Unique ID** | None | `txn_bel_abc123` | `UUID: 8a3f-...-e91b` |
| **Account** | HSBC WE (user selected) | HSBC WE (from banking API link) | Unknown (CFDI has `FormaPago` hint) |
| **Arrives** | Immediately | Hours later | Days later |

The descriptions never match exactly. The dates can be off by 1-2 days. The
CFDI shows pre-tax amount while others show total. Only banking API and CFDI have
stable unique identifiers.

---

## 2. Architecture: Staging → Matching → Reconciliation

Instead of writing external data directly to the `Expense` table, we introduce
a **staging pipeline** with three stages:

```
                  ┌─────────┐
  Manual entry ──▶│ EXPENSE │  (direct — no staging needed)
                  └────┬────┘
                       │ match against
                       ▼
┌──────────┐    ┌──────────────┐    ┌─────────┐
│ Banking API │───▶│   STAGED     │───▶│ EXPENSE │  (matched → enrich)
│  webhook │    │ TRANSACTION  │    │         │  (unmatched → create)
└──────────┘    └──────────────┘    └─────────┘
                       ▲
┌──────────┐           │
│ SAT CFDI │───────────┘
│   cron   │
└──────────┘
```

**Key principle:** Manual entries go directly to `Expense` (the user wants it
there now). External sources go to `StagedTransaction` first, where the
reconciliation engine matches them against existing expenses before deciding
to enrich or create.

---

## 3. New Entity: StagedTransaction

A holding table for incoming external data that hasn't been reconciled yet.

```
StagedTransaction
├── id                  (string, PK)
├── userId              (string, FK → User)
├── source              (enum — banking_api | cfdi | csv)
├── externalId          (string — banking API txn ID or CFDI UUID, unique per source)
├── amount              (int — centavos, total including tax)
├── amountPreTax        (int — nullable, centavos, CFDI subtotal)
├── taxAmount           (int — nullable, centavos, CFDI IVA/ISR/IEPS)
├── currency            (enum — MXN | USD)
├── date                (datetime — transaction date)
├── description         (string — raw description from provider)
├── accountId           (string, FK → Account, nullable — inferred from banking API link or CFDI)
├── rawData             (json — full banking API transaction or CFDI payload)
│
├── status              (enum — pending | matched | created | rejected | review)
├── matchedExpenseId    (string, FK → Expense, nullable)
├── matchConfidence     (float — 0.0 to 1.0)
├── matchReason         (string — nullable, explains why matched)
│
├── processedAt         (datetime, nullable)
├── createdAt           (datetime)
└── updatedAt           (datetime)
```

**Unique constraint:** `(userId, source, externalId)` — prevents importing
the same banking API transaction or CFDI twice at the staging level.

---

## 4. Enhanced Expense Entity

The `Expense` table needs to support multiple source references (a single
expense can be confirmed by manual entry + banking API + CFDI):

```
Expense (additions to existing schema)
├── ...existing fields...
├── source              (enum — manual | banking_api | cfdi | csv | recurring | installment | objective)
│                       ↑ the ORIGINAL source that created this expense
├── bankingApiTransactionId  (string, nullable — banking API unique transaction ID)
├── cfdiUuid            (string, nullable — SAT CFDI UUID)
├── cfdiData            (json, nullable — parsed CFDI: RFC, tax breakdown, line items)
├── reconciliationStatus (enum — unmatched | partial | full)
│                        unmatched: only one source
│                        partial:   two of three sources matched
│                        full:      manual + bank + CFDI all confirmed
├── isVerified          (boolean — true if confirmed by at least 2 sources)
└── ...existing fields...
```

**Key change:** Instead of a single `externalId`, the expense now has
**dedicated fields** for each external source. A single expense can
simultaneously have a `bankingApiTransactionId` AND a `cfdiUuid`, meaning
it's been verified by both the bank and the tax authority.

---

## 5. Matching Algorithm

The reconciliation engine runs when new staged transactions arrive (webhook,
cron completion, or file upload).

### 5.1 Match Priority

```
For each StagedTransaction:

1. EXACT EXTERNAL ID MATCH (confidence: 1.0)
   └─ Does an Expense already have this bankingApiTransactionId or cfdiUuid?
      → Yes: skip (already processed)

2. EXACT AMOUNT + DATE + ACCOUNT (confidence: 0.95)
   └─ Find Expense where:
      • amount == staged.amount
      • date == staged.date (same day)
      • accountId == staged.accountId
      → Match found: enrich expense with new source data

3. EXACT AMOUNT + NEAR DATE + ACCOUNT (confidence: 0.85)
   └─ Find Expense where:
      • amount == staged.amount
      • date within ±2 days of staged.date
      • accountId == staged.accountId
      → Match found: enrich expense, flag date difference

4. NEAR AMOUNT + DATE + ACCOUNT (confidence: 0.75)
   └─ Find Expense where:
      • amount within ±1% of staged.amount (handles rounding)
      • date within ±2 days
      • accountId == staged.accountId
      → Match found: enrich but flag for user review

5. CFDI → BANKING_API CROSS-MATCH (confidence: 0.80)
   └─ If staged is CFDI, find a banking_api-sourced Expense where:
      • amount == cfdi.total
      • date within ±3 days
      • CFDI FormaPago hints match account type
      → This catches cases where manual entry doesn't exist
        but both external sources agree

6. NO MATCH (confidence: 0.0)
   └─ No existing Expense matches
      → Auto-create new Expense (if confidence threshold allows)
      → OR flag for user review
```

### 5.2 Confidence Thresholds

| Confidence | Action |
|---|---|
| **≥ 0.90** | Auto-match: enrich existing expense silently |
| **0.70 – 0.89** | Auto-match: enrich but add to review queue |
| **0.50 – 0.69** | Suggest match: show user "Did you mean this?" |
| **< 0.50** | No match: create new expense or hold for review |

The user can adjust these thresholds in settings. Conservative users can
require manual confirmation for everything. Trusting users can auto-match
at lower confidence.

### 5.3 Matching Flow Diagram

```
StagedTransaction arrives
│
├─ 1. Check externalId uniqueness
│     └─ Already exists in staging? → SKIP (duplicate import)
│
├─ 2. Check if Expense already has this external ID
│     └─ Expense.bankingApiTransactionId == staged.externalId? → SKIP
│     └─ Expense.cfdiUuid == staged.externalId? → SKIP
│
├─ 3. Run match algorithm (steps 1-6 above)
│     │
│     ├─ HIGH confidence match found
│     │   └─ ENRICH existing Expense:
│     │       • Add bankingApiTransactionId or cfdiUuid
│     │       • Add cfdiData (tax breakdown, RFC, line items)
│     │       • Update reconciliationStatus
│     │       • Set isVerified = true if 2+ sources
│     │       • Update staged.status = 'matched'
│     │
│     ├─ MEDIUM confidence match found
│     │   └─ Same as above, but also:
│     │       • Add to REVIEW QUEUE for user confirmation
│     │       • User can confirm or reject the match
│     │
│     └─ NO match found
│         └─ Create NEW Expense:
│             • source = staged.source
│             • bankingApiTransactionId or cfdiUuid = staged.externalId
│             • category = auto-categorize (or "Uncategorized")
│             • Update staged.status = 'created'
│             • Add to REVIEW QUEUE (user should categorize)
│
└─ Done. staged.processedAt = now()
```

---

## 6. Scenario Walkthrough

Let's trace the Liverpool purchase through all three channels:

### Step 1: Manual Entry (Feb 10, 8:00 PM)

User logs the expense right after buying:

```
Expense created:
  id: exp_001
  description: "Liverpool shoes"
  amount: 250000 (centavos)
  date: 2026-02-10
  accountId: acc_hsbc_we
  categoryId: cat_misc
  source: manual
  bankingApiTransactionId: null
  cfdiUuid: null
  reconciliationStatus: unmatched
  isVerified: false
```

### Step 2: Banking API Webhook (Feb 10, 11:00 PM)

The banking API (e.g. Belvo) sends a webhook with the new bank transaction:

```
StagedTransaction created:
  id: stg_001
  source: banking_api
  externalId: txn_bel_abc123
  amount: 250000
  date: 2026-02-10
  description: "LIVERPOOL INSURGENTES SUR"
  accountId: acc_hsbc_we (matched via BankLink)
  status: pending
```

**Reconciliation engine runs:**
1. Check: does any Expense have `bankingApiTransactionId = txn_bel_abc123`? → No
2. Match: amount=250000 AND date=Feb 10 AND accountId=acc_hsbc_we → **exp_001 found!**
3. Confidence: 0.95 (exact amount + exact date + same account)
4. Action: **ENRICH exp_001**

```
Expense updated (exp_001):
  bankingApiTransactionId: txn_bel_abc123    ← NEW
  reconciliationStatus: partial          ← was: unmatched
  isVerified: true                       ← confirmed by bank
  (description stays "Liverpool shoes" — user's description wins)

StagedTransaction updated (stg_001):
  status: matched
  matchedExpenseId: exp_001
  matchConfidence: 0.95
  matchReason: "exact_amount_date_account"
  processedAt: 2026-02-10T23:01:00
```

### Step 3: SAT CFDI Cron (Feb 13, 3:00 AM)

CFDI download job finds the invoice:

```
StagedTransaction created:
  id: stg_002
  source: cfdi
  externalId: 8a3f-...-e91b (CFDI UUID)
  amount: 250000 (total)
  amountPreTax: 215517
  taxAmount: 34483 (IVA)
  date: 2026-02-10
  description: "EL PUERTO DE LIVERPOOL SA DE CV"
  accountId: null (CFDI doesn't directly identify bank account)
  rawData: { rfc: "PLI861117PA7", conceptos: [...], ... }
  status: pending
```

**Reconciliation engine runs:**
1. Check: does any Expense have `cfdiUuid = 8a3f-...-e91b`? → No
2. Match: amount=250000 AND date=Feb 10 → **exp_001 found!**
   (account is null on CFDI, so we match on amount + date only, slightly
   lower confidence)
3. Confidence: 0.85 (exact amount + exact date, no account confirmation)
4. But exp_001 already has `bankingApiTransactionId` set AND the banking API-matched
   account is a credit card (matches CFDI's `FormaPago: 04` = credit card)
   → boost confidence to 0.90
5. Action: **ENRICH exp_001**

```
Expense updated (exp_001):
  cfdiUuid: 8a3f-...-e91b               ← NEW
  cfdiData: {                            ← NEW
    rfc: "PLI861117PA7",
    vendor: "EL PUERTO DE LIVERPOOL SA DE CV",
    subtotal: 215517,
    iva: 34483,
    conceptos: [{ description: "Calzado", ... }]
  }
  reconciliationStatus: full             ← was: partial
  isVerified: true                       ← confirmed by manual + bank + SAT
```

### Final State

One expense, fully reconciled across all three sources:

```
exp_001:
  description: "Liverpool shoes"              ← user's original
  amount: 250000
  date: 2026-02-10
  accountId: acc_hsbc_we
  categoryId: cat_misc
  source: manual                              ← original source
  bankingApiTransactionId: txn_bel_abc123         ← bank confirmation
  cfdiUuid: 8a3f-...-e91b                    ← tax authority confirmation
  cfdiData: { rfc, vendor, subtotal, iva, conceptos }
  reconciliationStatus: full                  ← all three sources agree
  isVerified: true
```

---

## 7. Alternate Scenarios

### 7.1 Banking API Arrives First, Then Manual, Then CFDI

If the user didn't enter it manually but the banking API caught it:

1. Banking API → staged → no match → **auto-create** Expense with `source: banking_api`
   (goes to review queue for categorization)
2. User sees it in review queue, categorizes it, edits description
   (this is now the same as having a manual + banking_api expense)
3. CFDI → staged → matches existing expense → enriches with fiscal data

### 7.2 CFDI Arrives First (User Uploads XML)

1. User uploads CFDI XML → staged → no match → auto-create Expense
   with `source: cfdi`, enriched with tax data
2. Banking API sync → staged → matches by amount + date → enriches with bank ID
3. User never needs to enter it manually at all

### 7.3 Only Two Sources Match

Not every expense has all three:
- Cash purchases have no banking API transaction (no bank)
- Informal purchases have no CFDI (no invoice)
- Some expenses are only manual

The system handles all combinations gracefully:

| Manual | Banking API | CFDI | reconciliationStatus |
|---|---|---|---|
| ✓ | ✗ | ✗ | `unmatched` |
| ✓ | ✓ | ✗ | `partial` |
| ✓ | ✗ | ✓ | `partial` |
| ✓ | ✓ | ✓ | `full` |
| ✗ | ✓ | ✗ | `unmatched` (auto-created from banking API) |
| ✗ | ✓ | ✓ | `partial` (auto-created, verified) |
| ✗ | ✗ | ✓ | `unmatched` (auto-created from CFDI) |

### 7.4 Multiple Expenses on Same Day, Same Amount, Same Account

The trickiest case. Example: Two separate $500 charges at the same store
on the same day.

**How the matcher handles it:**
1. First staged transaction matches the first expense (one-to-one)
2. Second staged transaction finds the first expense already has a
   `bankingApiTransactionId` → skip it
3. Looks for another expense with same amount/date/account without a
   `bankingApiTransactionId` → finds the second one → match
4. If no second expense exists → create new (this is a legitimate
   separate purchase the user didn't enter manually)

**Rule:** An expense can only be matched to ONE staged transaction per
source. If `bankingApiTransactionId` is already set, that expense is excluded
from banking API matching.

### 7.5 Amount Discrepancy Between Sources

Sometimes amounts don't match exactly:
- Banking API shows $2,500.00 (total charge)
- CFDI shows subtotal $2,155.17 + IVA $344.83 = $2,500.00
- Manual entry was $2,490 (user rounded or misremembered)

**Strategy:**
- Banking API vs CFDI: compare against CFDI `total`, not `subtotal`. They should match.
- Manual vs external: allow ±1% tolerance. Flag the discrepancy for review.
- When enriching, **don't change the amount.** Keep the user's amount (or
  Banking API's if auto-created) and store the CFDI breakdown in `cfdiData`.
- Show a "discrepancy" badge in the UI if manual amount ≠ verified amount.

---

## 8. Review Queue

Expenses that need user attention are surfaced in a **Review Queue**:

### 8.1 What Goes Into the Review Queue

| Trigger | Reason |
|---|---|
| Medium-confidence auto-match | System is 70-89% sure — user should confirm |
| New expense from external source | Auto-created from banking API/CFDI — needs categorization |
| Amount discrepancy | Manual amount ≠ bank/CFDI amount |
| Unmatched staged transaction | No match found — is this a new expense or did user forget to enter it? |
| Multiple potential matches | System found 2+ expenses that could match — user picks |

### 8.2 Review Queue UI

```
┌──────────────────────────────────────────────────────┐
│  Review Queue (5 items)                              │
│                                                      │
│  ┌─ 🏦 Bank Transaction ───────────────────────────┐ │
│  │  LIVERPOOL INSURGENTES SUR                       │ │
│  │  $2,500.00 · Feb 10 · HSBC WE                   │ │
│  │                                                  │ │
│  │  Possible match:                                 │ │
│  │  ✏️ "Liverpool shoes" · $2,500.00 · Feb 10       │ │
│  │  Confidence: 95%                                 │ │
│  │                                                  │ │
│  │  [✓ Confirm Match]  [✗ Not the Same]  [Skip]    │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ 📄 SAT Invoice ────────────────────────────────┐ │
│  │  SPORTS WORLD SA DE CV · RFC: SWO040101XX2       │ │
│  │  $3,900.00 · Feb 1                               │ │
│  │                                                  │ │
│  │  No match found.                                 │ │
│  │  [+ Create Expense]  [🗑 Ignore]                 │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 8.3 Actions

| Action | Effect |
|---|---|
| **Confirm Match** | Link staged transaction to existing expense. Enrich with external data. |
| **Not the Same** | Reject match. Create new expense from staged data. Mark staged as `created`. |
| **Create Expense** | Create new expense from unmatched staged transaction. User selects category. |
| **Ignore** | Mark staged as `rejected`. Won't be matched again. |
| **Skip** | Leave in queue for later. |

---

## 9. Auto-Categorization During Reconciliation

When external data creates a new expense (no manual match), the system needs
to assign a category. Strategy:

### 9.1 Categorization Priority

```
1. BELVO CATEGORY (if available)
   └─ Banking API auto-categorizes transactions (food, transport, etc.)
   └─ Map banking API categories to user's categories

2. CFDI RFC LOOKUP
   └─ Maintain a local RFC → Category mapping
   └─ "PLI861117PA7" (Liverpool) → "Shopping"
   └─ Builds over time from user corrections

3. RECURRING EXPENSE MATCH
   └─ Does the description/amount match a RecurringExpense template?
   └─ "SPORTS WORLD" + $3,900 → matches "Sports World" recurring → "Subscriptions"

4. HISTORICAL PATTERN
   └─ Same merchant/RFC was previously categorized as X by the user
   └─ Use the most recent categorization

5. FALLBACK
   └─ Category: "Uncategorized" → goes to review queue
```

### 9.2 Learning From User Corrections

When the user re-categorizes an auto-categorized expense:
- Store the mapping: `{ merchantName | rfc } → categoryId`
- Next time the same merchant/RFC appears, use the learned category
- This improves over time without ML — just pattern matching

---

## 10. Implementation Plan

### 10.1 Schema Changes

Add to Prisma schema:

```prisma
model StagedTransaction {
  id                String   @id @default(cuid())
  userId            String
  source            String   // banking_api | cfdi | csv
  externalId        String   // unique per source
  amount            Int      // centavos, total
  amountPreTax      Int?     // centavos, CFDI subtotal
  taxAmount         Int?     // centavos, CFDI tax
  currency          String   // MXN | USD
  date              DateTime
  description       String
  accountId         String?  // inferred from BankLink or CFDI
  rawData           Json     // full payload from provider
  status            String   @default("pending") // pending|matched|created|rejected|review
  matchedExpenseId  String?  // FK → Expense
  matchConfidence   Float?
  matchReason       String?
  processedAt       DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user    User     @relation(fields: [userId], references: [id])
  expense Expense? @relation(fields: [matchedExpenseId], references: [id])

  @@unique([userId, source, externalId])
  @@index([userId, status])
  @@index([userId, amount, date])
}

// Add to Expense model:
// bankingApiTransactionId    String?   @unique
// cfdiUuid              String?   @unique
// cfdiData              Json?
// reconciliationStatus  String    @default("unmatched")
// isVerified            Boolean   @default(false)

model CategoryMapping {
  id         String @id @default(cuid())
  userId     String
  matchType  String // rfc | merchant_name | banking_api_category
  matchValue String // the RFC, merchant name, or banking API category
  categoryId String
  confidence Float  @default(1.0) // 1.0 = user-set, lower = inferred
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user     User     @relation(fields: [userId], references: [id])
  category Category @relation(fields: [categoryId], references: [id])

  @@unique([userId, matchType, matchValue])
}
```

### 10.2 tRPC Procedures

```typescript
reconciliationRouter = router({
  // ── Queries ──
  reviewQueue:     protectedProcedure.query(...)   // Staged txns needing review
  reviewCount:     protectedProcedure.query(...)   // Badge count for nav
  matchSuggestions: protectedProcedure.query(...)   // For a specific staged txn

  // ── Mutations ──
  confirmMatch:    protectedProcedure.mutation(...)  // User confirms a match
  rejectMatch:     protectedProcedure.mutation(...)  // Not the same → create new
  createFromStaged: protectedProcedure.mutation(...)  // Create expense from unmatched
  ignoreStaged:    protectedProcedure.mutation(...)  // Reject/ignore staged txn
  bulkConfirm:     protectedProcedure.mutation(...)  // Batch confirm high-confidence matches
  reprocess:       protectedProcedure.mutation(...)  // Re-run matching for a staged txn
})
```

### 10.3 Background Jobs

| Job | Trigger | What It Does |
|---|---|---|
| `processBankingApiWebhook` | Banking API webhook POST | Write to StagedTransaction, run matcher |
| `syncBankingApiTransactions` | Scheduled (daily) | Fetch new transactions from banking API, stage them, run matcher |
| `syncSatCfdis` | Scheduled (daily/weekly) | Download new CFDIs via banking API or @nodecfdi, stage them, run matcher |
| `processCSVUpload` | User uploads file | Parse CSV/OFX, stage transactions, run matcher |
| `runReconciliation` | After any staging | Run match algorithm on all pending staged transactions |
| `updateCategoryMappings` | User re-categorizes expense | Update CategoryMapping table for future auto-categorization |

### 10.4 Phase Breakdown

**Phase 3 — Manual Import Foundation:**
- [ ] `StagedTransaction` table in Prisma schema
- [ ] CSV/OFX upload → staging → basic matching (amount + date)
- [ ] CFDI XML upload → staging → matching
- [ ] Simple review queue UI

**Phase 6 — Automated Reconciliation:**
- [ ] Banking API webhook handler → staging pipeline
- [ ] Banking API scheduled sync → staging pipeline
- [ ] CFDI automated sync → staging pipeline
- [ ] Full matching algorithm (all 6 priority levels)
- [ ] Confidence thresholds (configurable in settings)
- [ ] Enhanced review queue UI with match suggestions
- [ ] Auto-categorization with `CategoryMapping`
- [ ] `reconciliationStatus` and `isVerified` on Expense
- [ ] Reconciliation dashboard (stats: how many matched, unmatched, verified)

**Phase 7 — Intelligence:**
- [ ] Learned category mappings from user corrections
- [ ] Historical pattern matching for categorization
- [ ] Duplicate detection across all sources
- [ ] Discrepancy alerts (manual ≠ bank ≠ CFDI amounts)

---

## 11. Performance Considerations

| Concern | Solution |
|---|---|
| **Matching query speed** | Index on `(userId, amount, date)` and `(userId, bankingApiTransactionId)` and `(userId, cfdiUuid)`. Most matches resolve on first index lookup. |
| **Large staging backlog** | Process staged transactions in batches (100 at a time). Use database transactions to ensure atomicity. |
| **Webhook bursts** | Queue banking API webhooks (e.g., BullMQ or simple Postgres-based queue) and process sequentially per user to avoid race conditions. |
| **CFDI bulk download** | SAT bulk download can return thousands of CFDIs. Process in chunks, with progress tracking. |
| **Concurrent matching** | Acquire a per-user advisory lock before running reconciliation to prevent two jobs matching the same expense simultaneously. |
