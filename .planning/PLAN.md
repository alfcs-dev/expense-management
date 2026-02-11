# Budget Manager App — Project Plan

## 1. Project Overview

A personal budget management application to replace the current CSV-based workflow. The app will handle multi-account tracking, recurring and one-time expenses, installment plans (MSI), savings goals, and biweekly salary-based budgeting — all tailored to the Mexican financial context.

### 1.1 Key Insights from Current Workflow

From the existing spreadsheet, the app must model the following real-world patterns:

| Concept | Details |
|---|---|
| **Income** | Biweekly salary ($71,000 MXN × 2 = $142,000/month) |
| **Expense Categories** | Kids, Subscriptions, Telecom, Savings, Auto, Home (Zuhause), Miscellaneous |
| **Accounts** | HSBC World Elite (credit), HSBC (debit), Uala, Nu (multiple "cajitas"), 2Now (multiple), Stori Inversion+, GBM Trading, GBM Dolares |
| **Account Routing** | Each expense has a source account (Cuenta Cargo) and a destination account (Cuenta Deposito) |
| **Annual Expenses** | Some expenses are billed annually but budgeted monthly (e.g., Insurance, NFL Game Pass, Inscriptions) |
| **Installments (MSI)** | Credit card purchases split over months, common in Mexico |
| **Savings Goals** | Short-term (9%) and Long-term (11%) targets |
| **Household (Zuhause)** | Largest category ($67,300/month) — rent, groceries, utilities, cleaning |

### 1.2 Minimum Viable Product (MVP) Scope

1. **Dashboard** — Monthly overview of income vs. expenses, totals per category
2. **Accounts** — CRUD for bank accounts (debit, credit, investment)
3. **Budget Templates** — Define recurring expenses with category, amount, frequency, and account routing
4. **Expense Tracking** — Log actual expenses, compare against budget
5. **Installment Plans** — Create MSI plans that auto-generate future monthly expenses
6. **Transfers** — Track money movement between accounts
7. **Savings Goals** — Define targets with percentage-based allocation
8. **Reports** — Monthly/annual summaries, category breakdowns

---

## 2. Architecture

### 2.1 Monorepo Structure

Since the goal is web-first then mobile, a monorepo is the right call. Here are the options:

| Tool | Pros | Cons | Recommendation |
|---|---|---|---|
| **Turborepo** | Simple config, fast caching, great for JS/TS, Vercel-backed | Less mature plugin ecosystem | **Recommended** — lowest friction for a solo/small project |
| **Nx** | Very mature, powerful generators, great caching | Steeper learning curve, heavier config | Good alternative if project grows significantly |
| **pnpm workspaces (bare)** | Zero extra tooling, just pnpm | No task orchestration, no caching | Only if you want absolute minimalism |

#### Proposed Monorepo Layout

```
budget-app/
├── apps/
│   ├── web/                  # Next.js web application
│   └── mobile/               # React Native / Expo (Phase 2)
├── packages/
│   ├── api/                  # tRPC router definitions (shared backend logic)
│   ├── db/                   # Prisma schema + migrations + seed
│   ├── shared/               # Shared types, utils, constants, validators (zod)
│   └── ui/                   # Shared UI component library
├── docker/
│   ├── Dockerfile.web
│   └── docker-compose.yml
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
└── .env.example
```

---

## 3. Tech Stack Options

### 3.1 Frontend Framework (Web)

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Next.js (App Router)** | SSR/SSG, API routes, huge ecosystem, great DX, App Router + Server Components | Some complexity with App Router patterns | **Recommended** — most versatile for a dashboard-heavy app |
| **Remix** | Great data loading patterns, progressive enhancement | Smaller ecosystem, less community content | Solid alternative |
| **React + Vite (SPA)** | Simple, fast builds, no server needed | No SSR, must build API separately | Only if SSR is not needed |

### 3.2 UI Component Library

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **shadcn/ui + Tailwind CSS** | Copy-paste components (full ownership), beautiful defaults, highly customizable, accessible | Must maintain components yourself | **Recommended** — best balance of quality and control |
| **Mantine** | Feature-rich, great for dashboards, built-in hooks | Larger bundle, less customizable styling | Good alternative especially for data-heavy UIs |
| **Chakra UI** | Good DX, accessible | Performance concerns, less modern feel | Decent but losing momentum |
| **Ant Design** | Enterprise-grade, tons of components | Opinionated styling, large bundle | Only if enterprise look is desired |

### 3.3 Backend / API Layer

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **tRPC (inside Next.js)** | End-to-end type safety, no code generation, works great in monorepos | Tied to TypeScript clients, not great for public APIs | **Recommended for MVP** — perfect for a personal app with TS frontend |
| **Next.js Route Handlers (REST)** | Simple, built-in, no extra deps | Manual type sharing, more boilerplate | Good fallback if tRPC feels like overhead |
| **Fastify (standalone)** | Very fast, great plugin system, schema validation | Separate server to deploy and maintain | Better if you want to decouple API from frontend |
| **NestJS** | Enterprise patterns, decorators, DI | Heavy for a personal project, steep learning curve | Overkill for MVP |

### 3.4 Database

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **PostgreSQL** | Robust, ACID, great for financial data, JSON support, excellent ecosystem | Heavier resource usage on a small VPS | **Recommended** — the right choice for financial data integrity |
| **SQLite (via Turso/libsql)** | Zero config, lightweight, great for single-server | Limited concurrency, fewer features | Good if VPS resources are very constrained |
| **MySQL** | Widely known, good performance | Less feature-rich than Postgres for this use case | No strong reason to prefer over Postgres |

### 3.5 ORM / Database Toolkit

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Prisma** | Excellent DX, auto-generated types, great migrations, visual studio | Slightly heavier runtime, query limitations for complex cases | **Recommended** — best DX for rapid development |
| **Drizzle** | Lightweight, SQL-like syntax, great performance, no runtime overhead | Newer, smaller ecosystem, more manual | Great alternative if you prefer writing closer-to-SQL |
| **Kysely** | Type-safe query builder, zero overhead | No migrations built-in, more manual | Only if you want raw SQL control |

### 3.6 Validation

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Zod** | TS-first, great with tRPC and React Hook Form, runtime validation | Slightly larger bundle than alternatives | **Recommended** — the de facto standard with tRPC |
| **Valibot** | Smaller bundle, tree-shakeable | Newer, smaller ecosystem | Consider if bundle size is critical |

### 3.7 Authentication

Since this is a personal app, auth can be simple. However, planning for multi-user (e.g., partner access via `BUDGET_COLLABORATOR`) is wise.

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Auth.js (NextAuth v5)** | Built for Next.js, many providers, session management | Config can be finicky, breaking changes between versions | **Recommended** — most integrated with Next.js |
| **Lucia** | Lightweight, no magic, full control | More manual setup, less documentation | Great if you want full control |
| **Better Auth** | New, modern, TypeScript-first, supports many frameworks | Very new (less battle-tested) | Worth evaluating |
| **Custom JWT** | Full control, minimal deps | Must handle security yourself | Only if the above don't fit |

### 3.8 State Management (Client)

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **TanStack Query (React Query)** | Best for server state, caching, revalidation | Not for pure client state | **Recommended** — pairs perfectly with tRPC |
| **Zustand** | Simple, lightweight, great for client-only state | Another dependency | Add only if needed for complex client state |
| **React Context** | Built-in, no deps | Verbose for complex state, re-render issues | Use for simple global state (theme, locale) |

### 3.9 Charts / Data Visualization

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Recharts** | React-native, declarative, easy to use | Limited customization for complex charts | **Recommended** — good enough for budget dashboards |
| **Tremor** | Built on Recharts + Tailwind, beautiful dashboard components | Less flexible, opinionated | Great if using Tailwind already |
| **Chart.js (react-chartjs-2)** | Feature-rich, well-documented | Imperative API, less React-idiomatic | Solid fallback |
| **Nivo** | Beautiful, many chart types, animations | Heavier bundle | If you need advanced visualizations |

### 3.10 Mobile (Phase 2)

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Expo (React Native)** | Share logic with web (via monorepo), native feel, OTA updates | Separate UI layer from web | **Recommended** — best path from a shared monorepo |
| **Capacitor** | Wrap web app as-is, minimal extra work | Not truly native, potential UX limitations | Quick-and-dirty option |
| **PWA** | Zero extra work if web is responsive | Limited native APIs, no app store | Good interim solution before native app |

---

## 4. Infrastructure & Deployment (DigitalOcean VPS)

### 4.1 Deployment Strategy Options

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Docker Compose** | Reproducible, isolates services, easy to manage Postgres + app | Slightly more memory usage | **Recommended** — cleanest setup for a VPS |
| **PM2 + systemd** | Lower overhead, simple process management | Manual Postgres setup, less portable | Good if VPS is very resource-constrained |
| **Coolify (self-hosted PaaS)** | Heroku-like experience, git push to deploy, manages Docker for you | Uses resources for the platform itself | Worth considering — great DX if VPS has 2GB+ RAM |

### 4.2 Recommended VPS Stack

```
DigitalOcean Droplet (2GB+ RAM recommended)
├── Docker Compose
│   ├── app (Next.js — production build)
│   ├── postgres (PostgreSQL 16)
│   └── nginx (reverse proxy + SSL termination)
├── Certbot / Let's Encrypt (HTTPS)
├── GitHub Actions (CI/CD — build, test, deploy via SSH)
└── Automated backups (pg_dump cron + DO Spaces or similar)
```

### 4.3 CI/CD

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **GitHub Actions** | Free for public repos, generous free tier for private, great ecosystem | YAML config | **Recommended** |
| **Coolify built-in** | Zero config, git push deploy | Requires Coolify setup | If using Coolify |

### 4.4 Domain & SSL

- Use a custom domain (can register via Namecheap, Cloudflare, etc.)
- Cloudflare DNS (free tier) for DNS management + DDoS protection
- Let's Encrypt via Certbot for free SSL certificates
- Alternatively, Cloudflare Tunnel to avoid exposing VPS IP

---

## 5. Refined Database Schema

Building on the existing schema visualization, here's an enhanced version addressing the patterns found in the CSV:

### 5.1 Key Enhancements Over Current Schema

1. **Recurring Expenses** — Add a `RecurringExpense` entity to model budget templates (the rows in the CSV)
2. **Frequency Handling** — Support monthly, biweekly, annual, bimonthly frequencies
3. **Account Routing** — Each recurring expense maps source account → destination account
4. **Savings Goals** — First-class entity with target percentages
5. **Budget Periods** — Support biweekly budgeting (matching salary cycle)
6. **Tags/Labels** — Flexible tagging for cross-cutting concerns
7. **Currency** — Support MXN and USD (for dollar savings)

### 5.2 Proposed Entities

```
User
Account (type: debit | credit | investment | cash)
Budget (monthly budget instance)
BudgetPeriod (biweekly or monthly period)
Category (Kids, Subscriptions, Telecom, Savings, Auto, Home, Misc)
RecurringExpense (budget template — what you expect to spend)
Expense (actual recorded expense)
InstallmentPlan (MSI tracking)
Transfer (inter-account movement)
SavingsGoal (target allocation)
```

---

## 6. Phased Roadmap

### Phase 1 — Foundation (Weeks 1–2)

- [ ] Initialize monorepo (Turborepo + pnpm)
- [ ] Set up Next.js app with App Router
- [ ] Configure Prisma + PostgreSQL schema
- [ ] Implement authentication (Auth.js)
- [ ] Seed database from existing CSV data
- [ ] Set up Docker Compose for local development
- [ ] Basic CI with GitHub Actions (lint, type-check, build)

### Phase 2 — Core Features (Weeks 3–5)

- [ ] Account management (CRUD)
- [ ] Category management
- [ ] Recurring expense templates (the budget "plan")
- [ ] Monthly budget generation from templates
- [ ] Expense logging (manual entry)
- [ ] Dashboard with monthly overview
- [ ] Budget vs. actual comparison

### Phase 3 — Advanced Features (Weeks 6–8)

- [ ] Installment plan (MSI) management
- [ ] Transfer tracking
- [ ] Savings goals with progress tracking
- [ ] Annual expense proration (monthly breakdown)
- [ ] Reports and charts (monthly/annual trends)
- [ ] Data export (CSV)

### Phase 4 — Deployment & Polish (Weeks 9–10)

- [ ] Docker Compose production setup
- [ ] Deploy to DigitalOcean VPS
- [ ] SSL + domain setup
- [ ] CI/CD pipeline (GitHub Actions → VPS)
- [ ] Database backup automation
- [ ] Performance optimization
- [ ] UX polish and responsive design

### Phase 5 — Mobile & Beyond (Future)

- [ ] PWA support (offline, installable)
- [ ] Expo mobile app (shared logic from monorepo)
- [ ] Bank statement import (CSV/OFX parsing)
- [ ] Notification system (upcoming payments, budget alerts)
- [ ] Multi-user / collaborator support
- [ ] AI-powered expense categorization

---

## 7. Recommended Stack Summary

This is the recommended "default" stack based on the analysis above. Alternatives are documented in Section 3 for each decision.

| Layer | Choice | Reasoning |
|---|---|---|
| **Monorepo** | Turborepo + pnpm | Simple, fast, purpose-built for JS/TS |
| **Frontend** | Next.js 15 (App Router) | SSR, API routes, largest ecosystem |
| **UI** | shadcn/ui + Tailwind CSS v4 | Beautiful, accessible, full ownership |
| **API** | tRPC v11 | End-to-end type safety, no codegen |
| **Database** | PostgreSQL 16 | ACID compliance, best for financial data |
| **ORM** | Prisma | Best DX, auto-generated types, great migrations |
| **Validation** | Zod | Standard with tRPC, runtime + static types |
| **Auth** | Auth.js v5 | Built for Next.js, session management |
| **State** | TanStack Query | Server state caching, pairs with tRPC |
| **Charts** | Recharts or Tremor | Simple, declarative, Tailwind-compatible |
| **Deployment** | Docker Compose on DO VPS | Reproducible, manages Postgres + app |
| **CI/CD** | GitHub Actions | Free, great ecosystem |
| **Mobile (future)** | Expo | Shared logic via monorepo packages |

---

## 8. Open Questions & Decisions Needed

Before starting development, these decisions should be finalized:

1. **ORM**: Prisma vs. Drizzle — Prisma is easier to start with; Drizzle is lighter and closer to SQL. Which do you prefer?
2. **Auth**: Do you need multi-user from day one, or is single-user (with login) fine for MVP?
3. **Deployment tool**: Plain Docker Compose vs. Coolify (self-hosted PaaS)? Coolify adds convenience but uses more resources.
4. **Budget period**: Is the primary budgeting cycle monthly or biweekly (aligned with salary)?
5. **Data migration**: Should the app import the existing CSV as seed data for the initial setup?
6. **Locale**: Should the app support i18n from the start (Spanish + English), or English-only MVP?
7. **Currency**: Should the app handle multi-currency (MXN + USD) from the start?
8. **Mobile timeline**: When do you realistically want to start the mobile app? This affects early architecture decisions.
9. **Notifications**: Do you want payment reminders? If so, email or push notifications?
10. **Bank integration**: Any interest in connecting to bank APIs (e.g., Belvo for Mexican banks) for automatic transaction import?
