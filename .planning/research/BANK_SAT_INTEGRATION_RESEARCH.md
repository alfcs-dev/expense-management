# Bank & SAT Integration Research: Belvo vs Syncfy vs DIY

> This document compares the available options for automating bank transaction
> import and SAT fiscal data (CFDI) retrieval for the Budget Manager app.
> Referenced from [PLAN.md Section 9](../PLAN.md#9-bank--sat-integration-research).

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Overview](#2-platform-overview)
3. [Banking Capabilities](#3-banking-capabilities)
4. [Fiscal / SAT Capabilities](#4-fiscal--sat-capabilities)
5. [API & Developer Experience](#5-api--developer-experience)
6. [SDK & Widget Comparison](#6-sdk--widget-comparison)
7. [Pricing](#7-pricing)
8. [Integration Effort Estimate](#8-integration-effort-estimate)
9. [DIY Alternative: @nodecfdi for SAT](#9-diy-alternative-nodecfdi-for-sat)
10. [Hybrid Approaches](#10-hybrid-approaches)
11. [Security Considerations](#11-security-considerations)
12. [Recommendation](#12-recommendation)

---

## 1. Executive Summary

| | **Belvo** | **Syncfy (Paybook)** | **DIY (@nodecfdi + manual)** |
|---|---|---|---|
| **Banking sync** | Yes — clean REST API | Yes — REST API | No (would need Belvo/Syncfy) |
| **SAT / Fiscal data** | Yes — dedicated Fiscal Mexico product | Yes — SAT as a "site" credential | Partial — @nodecfdi for CFDI only |
| **Single provider for both** | Yes | Yes | No |
| **Node.js SDK** | `belvo` (official, v0.28.0) | `@paybook/sync-js` (official, v2.0.2) | `@nodecfdi/*` (community, active) |
| **Connect Widget** | Belvo Connect Widget | `@syncfy/authentication-widget` (v1.6.0) | N/A — build your own UI |
| **Documentation language** | English + Spanish + Portuguese | Primarily Spanish | Spanish |
| **API design** | Modern REST, separate endpoints per resource | REST, SAT data via "attachments" model | N/A |
| **Enrichment APIs** | Yes — incomes, recurring expenses, risk insights | No | No |
| **Public pricing** | No — contact sales | No — contact sales | Free (OSS) |
| **Integration effort** | ~3–5 days for banking, ~2–3 days for fiscal | ~3–5 days for banking, ~3–4 days for fiscal | ~5–8 days for SAT only, no banking |
| **Recommended for** | Best overall choice — one provider, clean API, enrichment data | Alternative if Belvo pricing is prohibitive | Fallback for fiscal-only, zero ongoing cost |

**Recommendation: Belvo** as the primary provider for both banking and fiscal
data. Use `@nodecfdi` as a fallback/complement for SAT data if Belvo's fiscal
pricing is too high or if you need deeper CFDI control.

---

## 2. Platform Overview

### 2.1 Belvo

- **Founded:** 2019 (Mexico City & Barcelona)
- **Focus:** Open Banking platform for Latin America (Mexico, Brazil, Colombia, Chile)
- **Products:**
  - Banking (Mexico, Brazil, Colombia)
  - Fiscal Mexico (SAT integration)
  - Fiscal Chile
  - Employment Mexico (IMSS)
  - Payments (Mexico, Brazil)
  - Enrichment APIs (incomes, recurring expenses, risk insights)
- **Regulation:** Aligned with Mexico's Ley Fintech open banking mandates
- **Target customers:** Fintechs, lenders, personal finance apps, accounting tools

### 2.2 Syncfy (formerly Paybook)

- **Founded:** ~2014 as Paybook (Monterrey, Mexico), rebranded to Syncfy
- **Focus:** Financial data aggregation for Latin America, primarily Mexico
- **Products:**
  - Banking aggregation (Mexico, multiple institutions)
  - SAT/CFDI sync (as a "site" within the credential system)
  - Utility providers
  - IMSS
- **Regulation:** Aligned with Mexican banking regulations
- **Target customers:** Fintechs, accounting firms, lenders
- **Note:** Longer track record in Mexico specifically, Paybook was one of the first aggregators in the country

---

## 3. Banking Capabilities

### 3.1 What We Need

For the budget app, we need to:
1. Let the user link their bank accounts (HSBC, Nu, Uala, etc.)
2. Retrieve transactions (date, amount, description, merchant)
3. Get account balances
4. Sync periodically (daily or webhook-triggered)
5. Handle multi-factor authentication (bank 2FA)

### 3.2 Belvo — Banking

| Feature | Details |
|---|---|
| **Supported institutions** | 30+ Mexican institutions. Major banks confirmed: HSBC, BBVA, Banorte, Santander, Citibanamex, Scotiabank. Neobanks: likely Nu, but check current catalog. |
| **API endpoints** | `GET/POST /api/accounts/` — account info (name, type, balance, currency) |
| | `GET/POST /api/transactions/` — transaction list with filtering by date range |
| | `GET/POST /api/owners/` — account holder identity |
| | `GET/POST /api/links/` — manage bank connections |
| **Transaction data** | Amount, date, description, type (inflow/outflow), currency, balance, category (Belvo auto-categorizes), merchant info, status |
| **Enrichment** | `GET/POST /api/incomes/` — detected income sources and patterns |
| | `GET/POST /api/recurring-expenses/` — detected recurring charges (subscriptions, bills) |
| | `GET/POST /api/risk-insights/` — credit risk indicators |
| **Webhooks** | Supported — receive notifications on new transactions, link status changes |
| **Connect Widget** | Embeddable widget that handles bank login, 2FA, credential management |
| **Refresh** | On-demand or scheduled. Link remains active for periodic syncs. |

**Enrichment APIs are particularly valuable for our use case.** Belvo's
`/api/recurring-expenses/` endpoint automatically detects subscriptions and
recurring charges — exactly what our "Recurring Expense" templates model. And
`/api/incomes/` detects salary deposits, which maps directly to our income tracking.

### 3.3 Syncfy — Banking

| Feature | Details |
|---|---|
| **Supported institutions** | 30+ Mexican institutions. Similar coverage to Belvo. Banks treated as "sites" in a unified catalog. |
| **API model** | Create a "credential" (link to a bank) → system fetches accounts and transactions automatically |
| | `GET /accounts` — list accounts for a user |
| | `GET /transactions` — list transactions with date filters |
| **Transaction data** | Amount, date, description, currency, category, reference. Slightly less structured than Belvo. |
| **Enrichment** | No built-in enrichment APIs. You'd need to implement income detection and recurring expense detection yourself. |
| **Webhooks** | Supported — notifications when sync completes or when new transactions arrive |
| **Connect Widget** | `@syncfy/authentication-widget` — handles bank login and 2FA. Recently updated (v1.6.0, Feb 2026). |
| **Refresh** | Periodic sync. Credentials remain active. |

### 3.4 Banking Comparison

| Aspect | Belvo | Syncfy | Winner |
|---|---|---|---|
| **Institution coverage (Mexico)** | 30+ | 30+ | Tie |
| **API design** | RESTful, separate resource endpoints, well-structured | REST, unified credential/site model | Belvo — cleaner separation |
| **Transaction detail** | Rich — includes merchant, auto-category | Standard — amount, date, description | Belvo |
| **Enrichment (income detection)** | Built-in `/api/incomes/` | Not available | Belvo |
| **Enrichment (recurring expenses)** | Built-in `/api/recurring-expenses/` | Not available | Belvo |
| **Webhook support** | Yes | Yes | Tie |
| **Widget** | Belvo Connect Widget | @syncfy/authentication-widget | Tie — both functional |
| **Documentation** | Excellent — English, interactive API reference | Adequate — primarily Spanish, less polished | Belvo |

---

## 4. Fiscal / SAT Capabilities

### 4.1 What We Need

For the budget app, SAT integration provides:
1. **CFDIs (invoices)** — Every formal purchase has a CFDI. Importing these gives verified expense records.
2. **Tax status** — RFC, tax regime, fiscal obligations
3. **Tax returns** — Historical income/expense data for cross-referencing
4. **Tax retentions** — Withheld taxes (relevant for salary reconciliation)

### 4.2 Belvo — Fiscal Mexico

Belvo has a **dedicated Fiscal Mexico product** with separate API endpoints for each data type.

| Endpoint | What It Returns |
|---|---|
| `GET/POST /api/invoices/` | CFDI data: emitted and received invoices. Includes amount, date, vendor/buyer RFC, payment method, currency, line items, UUID, XML reference, CFDI type, tax breakdown (IVA, ISR, IEPS). Supports filtering by date range and type (inflow/outflow). |
| `GET/POST /api/tax-compliance-status/` | Whether the taxpayer is compliant with SAT (opinión de cumplimiento). Useful for vendor verification. |
| `GET/POST /api/tax-returns/` | Personal and business tax returns (monthly and yearly). Income, deductions, tax paid. Supports separate schemas for personal monthly, personal yearly, business monthly, business yearly. |
| `GET/POST /api/tax-retentions/` | Tax retentions (constancias de retención). Shows taxes withheld by employers or clients. |
| `GET/POST /api/tax-status/` | Taxpayer's RFC, tax regime, fiscal address, economic activities, tax obligations. |
| `GET/POST /api/financial-statements/` | Financial statements for businesses. Less relevant for personal use. |

**How authentication works:**
- User provides CIEC (Clave de Identificación Electrónica Confidencial) or
  e.firma credentials through the Belvo Connect Widget
- Belvo handles the SAT authentication flow
- A "link" is created, and you can fetch fiscal data through the API
- Periodic refresh available

**Key advantage:** Belvo normalizes the CFDI XML into structured JSON with
typed fields. You don't need to parse XML yourself. The invoice object includes
all the fields we need for expense mapping (amount, date, vendor, category
hints, payment method).

### 4.3 Syncfy — SAT/Fiscal

Syncfy treats the SAT as another "site" (like a bank) in its unified credential
system. The approach is different from Belvo's dedicated fiscal endpoints.

| Aspect | Details |
|---|---|
| **How it works** | Create a credential of type "SAT" → Syncfy syncs the user's SAT data → CFDIs are returned as "attachments" |
| **CFDI retrieval** | CFDIs are fetched as attachments. You can get the raw XML or extracted JSON data. |
| **Attachment data** | `GET /attachments` returns CFDI files. `GET /attachments/{id}/extra` returns parsed data from the CFDI XML. |
| **Invoice fields** | Accessible via the "extra" endpoint: amount, date, RFC, tax breakdown, payment method, line items. |
| **Tax returns** | Available through the attachment system — not as clean as Belvo's dedicated endpoints. |
| **Authentication** | User provides CIEC credentials through the Syncfy widget. e.firma also supported. |
| **CFDI filtering** | Filter by date, by emitted/received (keywords like "emitidas", "vigente", etc.) |

**Key difference from Belvo:** Syncfy's approach is "sync SAT like a bank,
get CFDIs as file attachments." Belvo's approach is "dedicated fiscal API with
typed invoice objects." Belvo's model is cleaner for programmatic consumption.

### 4.4 Fiscal Comparison

| Aspect | Belvo | Syncfy | Winner |
|---|---|---|---|
| **CFDI retrieval** | Dedicated `/api/invoices/` endpoint with typed JSON | Via `/attachments` + `/attachments/{id}/extra` | Belvo — cleaner API |
| **CFDI data format** | Structured JSON with typed fields | JSON via "extra" endpoint, raw XML available | Belvo — no XML parsing needed |
| **Tax returns** | Dedicated `/api/tax-returns/` with separate schemas per type | Available but via attachment model | Belvo — purpose-built |
| **Tax status** | Dedicated `/api/tax-status/` | Available but less structured | Belvo |
| **Tax compliance** | Dedicated `/api/tax-compliance-status/` | Not clearly documented | Belvo |
| **Tax retentions** | Dedicated `/api/tax-retentions/` | Not clearly documented | Belvo |
| **Authentication methods** | CIEC + e.firma via Connect Widget | CIEC + e.firma via Syncfy Widget | Tie |
| **Maturity for SAT** | Dedicated product, separate from banking | Bolt-on via unified credential model | Belvo — purpose-built |
| **Raw CFDI XML access** | Available alongside JSON | Available | Tie |

---

## 5. API & Developer Experience

### 5.1 Belvo API

```
Base URL: https://api.belvo.com (production)
          https://sandbox.belvo.com (sandbox)
Auth:     HTTP Basic Auth (Secret ID + Secret Password)
Format:   JSON
Pagination: Cursor-based
Rate limits: Documented per plan
```

**Sample: Retrieve invoices (CFDIs)**
```typescript
// Using the belvo npm SDK
import Belvo from 'belvo';

const client = new Belvo(secretId, secretPassword, 'https://api.belvo.com');
await client.connect();

// Get invoices for a linked SAT account
const invoices = await client.invoices.retrieve(linkId, '2025-01-01', '2025-12-31', {
  type: 'INFLOW',  // received invoices (your expenses)
});

// Each invoice contains:
// - type: 'INFLOW' | 'OUTFLOW'
// - invoiceIdentification: UUID
// - invoiceDate
// - senderName, senderRfc
// - receiverName, receiverRfc
// - totalAmount, currency
// - paymentMethod
// - invoiceDetails: [{ description, quantity, unitAmount, totalAmount, ... }]
// - taxes: [{ taxType, percentage, amount }]
```

**Sample: Retrieve bank transactions**
```typescript
const transactions = await client.transactions.retrieve(bankLinkId, '2025-01-01', '2025-01-31');

// Each transaction contains:
// - amount
// - currency
// - description
// - category
// - merchant: { name, website, logo }
// - type: 'INFLOW' | 'OUTFLOW'
// - valueDate
// - accountingDate
// - balance
// - reference
```

### 5.2 Syncfy API

```
Base URL: https://sync.paybook.com/v1 (production)
          https://sync.paybook.com/v1 (sandbox - separate API key)
Auth:     Bearer Token (session-based, obtained from API key)
Format:   JSON
Pagination: Offset-based
Rate limits: Not publicly documented
```

**Sample: Retrieve transactions**
```typescript
import Sync from '@paybook/sync-js';

const sync = new Sync({ api_key: 'YOUR_API_KEY' });

// Create session
const session = await sync.auth(userId);

// Get transactions
const transactions = await sync.getTransactions(session.token, {
  id_credential: credentialId,
  dt_transaction_from: '2025-01-01',
  dt_transaction_to: '2025-01-31'
});

// Each transaction contains:
// - amount
// - currency
// - description
// - dt_transaction (date)
// - dt_refresh (last sync time)
// - id_account
// - reference
```

**Sample: Retrieve CFDI attachments**
```typescript
// Get CFDI attachments from SAT
const attachments = await sync.getAttachments(session.token, {
  id_credential: satCredentialId,
});

// Get parsed CFDI data
const cfdiData = await sync.getAttachmentExtra(session.token, attachmentId);

// cfdiData contains parsed CFDI fields:
// - RFC emisor, RFC receptor
// - Fecha, Total, SubTotal
// - Conceptos (line items)
// - Impuestos (taxes)
// - MetodoPago, FormaPago
```

### 5.3 Developer Experience Comparison

| Aspect | Belvo | Syncfy |
|---|---|---|
| **API documentation** | Excellent. Interactive API reference at developers.belvo.com. Separate pages per product. Multiple languages. OpenAPI spec available. | Adequate. Available at syncfy.com. Primarily in Spanish. Less interactive. |
| **Quickstart guides** | Yes — per product (banking, fiscal, etc.) | Yes — general quickstart |
| **Code examples** | Multiple languages (Python, Ruby, Node.js) | Primarily Node.js and Python |
| **Sandbox** | Full sandbox with test institutions and test fiscal data | Sandbox available with test data |
| **Error handling** | Well-documented error codes with descriptions | Basic error responses |
| **API versioning** | Versioned, backwards-compatible changes documented | Less clear versioning strategy |
| **Postman collection** | Available | Not publicly available |
| **MCP Server** | Referenced in docs (VS Code integration) | Not available |

---

## 6. SDK & Widget Comparison

### 6.1 Node.js SDK

| Aspect | Belvo (`belvo`) | Syncfy (`@paybook/sync-js`) |
|---|---|---|
| **npm package** | `belvo` | `@paybook/sync-js` |
| **Current version** | v0.28.0 | v2.0.2 |
| **Last published** | Jan 2024 (~2 years ago) | Sept 2024 (~1.5 years ago) |
| **Total versions** | 32 releases | 9 releases |
| **Dependencies** | axios, core-js, moment, regenerator-runtime | Not documented in npm |
| **TypeScript support** | Types included but SDK written in JS | JavaScript only, no TS types |
| **License** | MIT | MIT |
| **Maintained by** | Belvo team (multiple maintainers) | Paybook team |

**Concern with both SDKs:** Neither has been updated very recently. The Belvo
SDK still uses `moment` (deprecated) and `core-js`. For our project, we might
want to use the REST APIs directly with `fetch` or `axios` and create our own
typed wrappers — this gives us full TypeScript support and avoids stale SDK
dependencies.

### 6.2 Connect Widget

| Aspect | Belvo Connect Widget | Syncfy Authentication Widget |
|---|---|---|
| **npm package** | Loaded via script tag or npm (check docs) | `@syncfy/authentication-widget` v1.6.0 |
| **Last updated** | Active (check docs for latest) | Feb 2026 (very recently!) |
| **What it handles** | Bank login, SAT login (CIEC/e.firma), 2FA prompts, error handling | Bank login, SAT login, 2FA prompts |
| **Customization** | Theming, custom callbacks, locale | Theming support |
| **Mobile support** | WebView compatible | WebView compatible |
| **React integration** | Via callbacks + refs | Via callbacks |

The Syncfy widget's very recent update (Feb 2026) suggests active product
development — a positive signal for the platform's health.

---

## 7. Pricing

**Neither platform publishes public pricing.** Both require contacting sales.
Here's what's known from the industry:

### 7.1 Belvo Pricing Model

| Aspect | Details |
|---|---|
| **Model** | Pay-per-link (each connected bank account or SAT link is a "link") |
| **Sandbox** | Free — unlimited API calls with test data |
| **Production** | Contact sales. Known to offer startup-friendly plans. |
| **Billing** | Per active link/month. A link = one bank connection or one SAT connection per user. |
| **Estimated range** | Industry estimates suggest $0.50–$5.00 USD per active link/month depending on volume and products. Banking and fiscal may be priced separately. |
| **Free tier** | Sandbox only. No production free tier documented. |

**For our app (MVP):** A single user with ~5 bank accounts + 1 SAT link =
~6 active links. At estimated pricing, this could be $3–$30/month.

### 7.2 Syncfy Pricing Model

| Aspect | Details |
|---|---|
| **Model** | Per-user or per-credential pricing (contact for details) |
| **Sandbox** | Free — available with test API key |
| **Production** | Contact sales |
| **Billing** | Credential-based. Each bank or SAT connection counts. |
| **Estimated range** | Generally competitive with or slightly lower than Belvo for Mexican-only use cases. |
| **Free tier** | Sandbox only. |

**For our app (MVP):** Similar to Belvo — expect $3–$30/month for a single
user with multiple connections.

### 7.3 DIY (@nodecfdi) Pricing

| Aspect | Details |
|---|---|
| **Model** | Free (open source, MIT license) |
| **Ongoing cost** | $0 — you host everything |
| **Trade-off** | Development time instead of money. ~5–8 days of initial development. |
| **Limitation** | SAT/CFDI only — no bank transaction sync. |

---

## 8. Integration Effort Estimate

Estimated development time to integrate each platform into our Fastify +
tRPC + Prisma stack.

### 8.1 Belvo Integration

| Task | Effort | Notes |
|---|---|---|
| **Account setup** | 1 hour | Create Belvo account, get API keys, explore sandbox |
| **Typed API wrapper** | 4–6 hours | Create TypeScript wrapper around Belvo REST API (skip stale SDK). Define Zod schemas for responses. |
| **Connect Widget integration** | 3–4 hours | Embed widget in React app, handle callbacks, store link IDs |
| **Bank sync endpoint** | 4–6 hours | tRPC procedure to fetch transactions, map to Expense model, deduplicate |
| **CFDI/Invoice sync** | 4–6 hours | tRPC procedure to fetch invoices, map to Expense model, parse tax data |
| **Enrichment sync** | 2–3 hours | Fetch recurring expenses and incomes from Belvo, map to our models |
| **Webhook handler** | 2–3 hours | Fastify route to receive Belvo webhooks for real-time updates |
| **Scheduled sync** | 2–3 hours | Cron job or scheduled task for periodic full sync |
| **Deduplication logic** | 3–4 hours | Match Belvo transactions against existing expenses, prevent duplicates |
| **Auto-categorization** | 3–4 hours | Map Belvo categories + merchant info to our Category model |
| **Testing** | 4–6 hours | End-to-end testing with sandbox data |
| **Total** | **~30–45 hours (4–6 days)** | For both banking + fiscal |

### 8.2 Syncfy Integration

| Task | Effort | Notes |
|---|---|---|
| **Account setup** | 1 hour | Create Syncfy/Paybook account, get API keys |
| **Typed API wrapper** | 6–8 hours | Create TypeScript wrapper (SDK has no types). More manual type definitions needed. |
| **Widget integration** | 3–4 hours | Embed Syncfy widget, handle credential creation callbacks |
| **Bank sync endpoint** | 4–6 hours | Fetch transactions, map to Expense model |
| **SAT/CFDI sync** | 6–8 hours | Fetch attachments, call "extra" endpoint for parsed data, handle XML fallback |
| **Webhook handler** | 2–3 hours | Handle Syncfy webhook notifications |
| **Scheduled sync** | 2–3 hours | Periodic sync job |
| **Deduplication** | 3–4 hours | Same as Belvo |
| **Auto-categorization** | 4–6 hours | Less data from Syncfy (no enrichment), more manual rules needed |
| **Testing** | 4–6 hours | End-to-end testing |
| **Total** | **~35–50 hours (5–7 days)** | Slightly more due to less structured fiscal API and no TS types |

### 8.3 DIY with @nodecfdi (SAT Only)

| Task | Effort | Notes |
|---|---|---|
| **e.firma handling** | 4–6 hours | Certificate upload UI, secure storage, `@nodecfdi/credentials` integration |
| **SAT WS Descarga Masiva** | 8–12 hours | SOAP protocol implementation via `@nodecfdi/sat-ws-descarga-masiva`. Request → verify → download flow. Handle SAT downtime/delays. |
| **CFDI XML parsing** | 4–6 hours | Parse downloaded XMLs with `@nodecfdi/cfdi-to-json`, map to Expense model |
| **Scheduled download** | 3–4 hours | Cron job for periodic CFDI downloads |
| **Deduplication** | 2–3 hours | Based on CFDI UUID (guaranteed unique) |
| **Testing** | 4–6 hours | Tricky — SAT sandbox doesn't exist, need real credentials for testing |
| **Total** | **~25–37 hours (4–5 days)** | SAT/CFDI only — no banking |

---

## 9. DIY Alternative: @nodecfdi for SAT

The `@nodecfdi` ecosystem is a community-maintained TypeScript toolkit for
Mexican fiscal operations. It's the best open-source option for SAT integration.

### 9.1 Key Packages

| Package | Version | Stars | Description |
|---|---|---|---|
| `@nodecfdi/sat-ws-descarga-masiva` | v2.0.0 | 27 | SAT bulk CFDI download service (SOAP WS) |
| `@nodecfdi/cfdi-to-json` | v2.0.1 | 14 | Parse CFDI XML to JSON |
| `@nodecfdi/cfdi-to-pdf` | latest | 21 | Generate PDF from CFDI (for display/export) |
| `@nodecfdi/credentials` | v3.2.0 | — | e.firma certificate handling (read .cer/.key) |
| `@nodecfdi/sat-estado-cfdi` | v3.0.0 | 4 | Query CFDI status on SAT |
| `@nodecfdi/cfdi-core` | v1.0.1 | 3 | Base CFDI utilities |
| `@nodecfdi/cfdi-expresiones` | v3.0.4 | 1 | CFDI expression generators (QR codes, etc.) |
| `@nodecfdi/sat-micro-catalogs` | v1.0.2 | — | SAT catalog data (product codes, tax regimes, etc.) |

### 9.2 Pros and Cons

**Pros:**
- Free — no per-link fees, no vendor dependency
- Full control over data flow and storage
- All TypeScript, actively maintained (most packages updated 2024–2025)
- MIT licensed
- Can extract more detail from CFDIs than aggregator APIs
- CFDI UUID provides perfect deduplication
- Can generate PDFs from CFDIs for receipt viewing

**Cons:**
- SAT WS Descarga Masiva is a SOAP service — complex protocol
- SAT web services have unreliable uptime and slow response times
- Requires e.firma (electronic signature) — more complex user onboarding
  than CIEC (simple password)
- No sandbox — testing requires real SAT credentials
- No banking capability — only fiscal data
- Must handle SAT's quirks (request queuing, delayed processing,
  inconsistent XML formatting across CFDI versions)

### 9.3 When @nodecfdi Is the Right Choice

1. **Zero ongoing cost** is a hard requirement
2. You only need fiscal data (banking handled separately or manually)
3. You need deep CFDI parsing (individual line items, tax breakdowns per concept)
4. You want to generate CFDI PDFs for receipt viewing
5. You're comfortable with the e.firma onboarding flow

---

## 10. Hybrid Approaches

Given the trade-offs, here are three viable integration strategies:

### Strategy A: Belvo for Everything (Recommended)

```
User → Belvo Connect Widget → Belvo API → Our API → PostgreSQL

Banking: Belvo /api/transactions/ → Expense records
Fiscal:  Belvo /api/invoices/     → Expense records (verified with CFDI)
Enrichment: Belvo /api/recurring-expenses/ → RecurringExpense suggestions
            Belvo /api/incomes/            → Income records
```

**Pros:** Single vendor, cleanest API, enrichment data, minimal code
**Cons:** Ongoing cost, vendor dependency
**Cost:** ~$3–30/month for personal use

### Strategy B: Belvo for Banking + @nodecfdi for SAT

```
Banking: User → Belvo Widget → Belvo API → Our API → PostgreSQL
Fiscal:  User uploads e.firma → @nodecfdi → SAT WS → Our API → PostgreSQL
```

**Pros:** Banking convenience from Belvo, zero cost for fiscal, deep CFDI control
**Cons:** Two integration paths to maintain, e.firma UX friction
**Cost:** Belvo banking only (~$2–15/month), SAT is free

### Strategy C: Syncfy for Everything

```
User → Syncfy Widget → Syncfy API → Our API → PostgreSQL

Banking: Syncfy /transactions → Expense records
Fiscal:  Syncfy /attachments → CFDI data → Expense records
```

**Pros:** Single vendor, potentially lower pricing for Mexico-only
**Cons:** Less structured fiscal API, no enrichment, weaker documentation
**Cost:** ~$3–30/month for personal use

### Strategy D: Phase It

Start with manual import, then automate progressively:

```
Phase 3: Manual CSV/XML upload (free, no third-party)
Phase 6A: Add Belvo for banking (test with sandbox first)
Phase 6B: Add Belvo fiscal OR @nodecfdi for SAT
Phase 7: Smart categorization, cross-referencing, reconciliation
```

**This is what the current roadmap follows.** It lets you validate the data
model with manual imports before committing to a paid service.

---

## 11. Security Considerations

Both platforms handle sensitive financial credentials. Here's what to consider:

### 11.1 Credential Handling

| Aspect | Belvo | Syncfy | @nodecfdi (DIY) |
|---|---|---|---|
| **Bank credentials** | Handled by Belvo — never touch your server | Handled by Syncfy — never touch your server | N/A |
| **SAT CIEC** | Handled by platform via widget | Handled by platform via widget | N/A (uses e.firma) |
| **e.firma certificates** | Handled by platform (if supported) | Not primary method | **Stored on your server** — must encrypt at rest |
| **Data in transit** | TLS/HTTPS | TLS/HTTPS | TLS/HTTPS to SAT |
| **Data at rest** | Stored on platform's infrastructure | Stored on platform's infrastructure | Stored on your infrastructure |
| **Compliance** | SOC 2, CNBV-aligned | CNBV-aligned | Your responsibility |

### 11.2 Key Security Requirements for Our App

1. **Never store bank credentials** — let the aggregator handle this via widget
2. **Encrypt e.firma files at rest** if using @nodecfdi (AES-256)
3. **Store Belvo/Syncfy API keys as environment variables** (not in code)
4. **Audit log** for all sync operations (who synced what, when)
5. **User consent flow** before connecting any external account
6. **Token rotation** for API sessions
7. **Data retention policy** — how long to keep synced transaction data

---

## 12. Recommendation

### Primary: Belvo (Strategy A / D hybrid)

**Use Belvo as the single provider for both banking and fiscal data.**

Reasoning:
1. **One integration, two data sources** — banking + SAT through the same
   API, same widget, same authentication model
2. **Best fiscal API** — dedicated `/api/invoices/` with typed JSON vs.
   Syncfy's attachment-based model. Less code to write, fewer edge cases.
3. **Enrichment APIs are gold** — `/api/recurring-expenses/` and `/api/incomes/`
   directly feed our app's core features. This saves weeks of building
   detection algorithms ourselves.
4. **Better documentation** — English + Spanish, interactive reference,
   OpenAPI spec. Faster integration.
5. **TypeScript-friendly** — Even though the SDK is stale, the REST API is
   clean enough to wrap with typed `fetch` + Zod schemas in ~4 hours.

### Fallback: @nodecfdi for SAT

Keep `@nodecfdi` as a **backup plan** for fiscal data if:
- Belvo's fiscal pricing is too high for personal use
- You need deeper CFDI parsing than Belvo provides
- You want zero ongoing cost for fiscal data

The @nodecfdi packages are high quality (TypeScript, actively maintained,
MIT licensed) and can complement or replace Belvo's fiscal product.

### Not Recommended: Syncfy as Primary

Syncfy is a capable platform, but for this project:
- The attachment-based SAT API adds unnecessary complexity vs. Belvo's dedicated fiscal endpoints
- No enrichment APIs means more code to write for income/recurring expense detection
- Documentation quality is lower, making integration slower
- No clear advantage in pricing or coverage to offset these differences

Syncfy would only be preferred if:
- Belvo doesn't support a specific bank you need (check catalog)
- Syncfy offers a significantly better price for your usage pattern
- You're already familiar with the Paybook/Syncfy ecosystem

### Implementation Order (matches PLAN.md Phase 6)

1. **Contact both Belvo and Syncfy sales** — get actual pricing for your
   usage pattern (single user, ~6 links). This is the key differentiator
   that can't be determined from public information.
2. **Start with Belvo sandbox** — test banking + fiscal APIs with test data
3. **Build typed API wrapper** — our own thin client with Zod schemas
4. **Implement banking sync first** — higher immediate value
5. **Add fiscal sync** — cross-reference with banking data
6. **Keep @nodecfdi as fallback** — if fiscal pricing is a blocker
