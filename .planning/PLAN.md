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
│   ├── web/                  # React + Vite SPA (static output, served by Nginx)
│   ├── api/                  # Standalone Fastify + tRPC API server
│   └── mobile/               # React Native / Expo (Phase 2)
├── packages/
│   ├── db/                   # Prisma schema + migrations + seed
│   ├── shared/               # Shared types, utils, constants, validators (zod)
│   ├── trpc/                 # tRPC router definitions (consumed by api, imported by clients)
│   └── ui/                   # Shared UI component library (web + mobile)
├── docker/
│   ├── Dockerfile.api        # Builds + runs the Fastify server
│   └── docker-compose.yml    # API + Postgres + Nginx (serves static web build)
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
└── .env.example
```

> **Architecture Decisions**
>
> **1. Separate API Server** — The API lives in `apps/api` as a standalone
> Fastify server. Web and mobile are equal consumers of the same API. The
> API can be optimized and scaled independently.
>
> **2. Static SPA Frontend** — With all data fetching handled by tRPC +
> TanStack Query on the client, the web app is a pure SPA built with Vite.
> The `dist/` output is static files served by Nginx — no Node.js server
> needed for the frontend. This means:
>   - Only two processes on the VPS: Fastify (API) + PostgreSQL
>   - Nginx serves both static files and reverse-proxies `/api` to Fastify
>   - Frontend can trivially move to a CDN in the future

---

## 3. Tech Stack Options

### 3.1 Frontend Framework (Web)

> **Architecture note:** With the API on a standalone Fastify server and
> TanStack Query + tRPC handling all data fetching, the frontend is a pure
> client-side UI layer. This fundamentally changes the framework calculus.
>
> Next.js's biggest advantages — SSR, Server Components, API routes — provide
> little value here. The dashboard is behind authentication (no SEO benefit),
> Server Components can't read the DB directly (it's behind the API), and
> API routes are replaced by Fastify. Meanwhile, Next.js adds a Node.js
> server process, App Router complexity, and potential friction with
> tRPC + TanStack Query patterns.

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **React + Vite (SPA)** | Fastest builds, simplest mental model, static output (no Node server needed), TanStack Router offers file-based routing, perfect fit with TanStack Query + tRPC | No SSR (irrelevant for an auth-gated dashboard) | **Recommended** — the natural fit for this architecture |
| **Next.js (App Router)** | SSR/SSG, huge ecosystem, image optimization | Requires Node server for SSR (extra resources), App Router complexity overlaps with TanStack Query, Server Components add no value when data comes from external API | Only if you specifically want SSR for some pages |
| **Remix** | Good data loading, progressive enhancement | Smaller ecosystem, similar SSR overhead as Next.js | Less compelling without server-side data story |

#### Why React + Vite wins here

1. **Static output** — `vite build` produces static HTML/JS/CSS. Nginx serves
   these files directly. No Node.js process, no memory usage, instant TTFB.
2. **TanStack Router** — Provides file-based routing (like Next.js) plus
   deep integration with TanStack Query for loader patterns, search params
   type safety, and pending UI states.
3. **Zero friction with tRPC** — TanStack Query is tRPC's built-in client
   integration. No conflict with framework-level caching or data fetching.
4. **Simpler deploys** — One fewer Docker container. Just copy the `dist/`
   folder to Nginx.
5. **Same code works in Expo** — The shared packages (`packages/trpc`,
   `packages/shared`) work identically in the SPA and the mobile app.

### 3.2 UI Component Library

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **shadcn/ui + Tailwind CSS** | Copy-paste components (full ownership), beautiful defaults, highly customizable, accessible | Must maintain components yourself | **Recommended** — best balance of quality and control |
| **Mantine** | Feature-rich, great for dashboards, built-in hooks | Larger bundle, less customizable styling | Good alternative especially for data-heavy UIs |
| **Chakra UI** | Good DX, accessible | Performance concerns, less modern feel | Decent but losing momentum |
| **Ant Design** | Enterprise-grade, tons of components | Opinionated styling, large bundle | Only if enterprise look is desired |

### 3.3 Backend / API Layer

> **Decision: Standalone API server with tRPC.**
> Since the app will eventually serve both web and mobile clients, keeping
> the API as an independent service is the right architecture. Both clients
> hit the same backend directly — no Next.js middleman for mobile.

#### API Framework (the HTTP server hosting tRPC)

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Fastify** | Fastest mainstream Node.js framework, excellent plugin system, schema-based validation, hooks lifecycle, mature tRPC adapter | Slightly more boilerplate than Express | **Recommended** — best performance, great ecosystem, battle-tested |
| **Hono** | Ultra-lightweight, runs on Node/Bun/Deno/edge, very modern API, tRPC adapter available | Newer, smaller ecosystem, fewer plugins | Strong alternative — consider if you value minimalism and portability |
| **Express** | Largest ecosystem, most tutorials/examples | Slower, no native async error handling, legacy patterns | No strong reason to choose over Fastify |

#### API Protocol (how clients talk to the server)

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **tRPC** | End-to-end type safety with zero codegen, shared types via monorepo, works with Fastify/Hono, TanStack Query integration built-in | Tied to TypeScript clients (fine for web + Expo) | **Recommended** — perfect for a TS monorepo where all clients are yours |
| **REST (manual)** | Universal, any client can consume, well-understood | No automatic type safety, more boilerplate, need OpenAPI/Swagger for docs | Only if you need third-party API consumers |
| **GraphQL** | Flexible querying, great for complex data relationships | Heavy tooling (codegen, resolvers, schema), overkill for a personal app | Not recommended for this project |

#### How it fits together

```
┌──────────────────┐     ┌─────────────┐
│  React + Vite    │     │  Expo App   │
│  (static SPA)    │     │  (mobile)   │
│  served by Nginx │     │             │
└───────┬──────────┘     └──────┬──────┘
        │     tRPC client       │
        └──────────┬────────────┘
                   │ HTTP (JSON)
                   ▼
          ┌─────────────────┐
          │  Fastify + tRPC │
          │   (apps/api)    │
          └────────┬────────┘
                   │ Prisma
                   ▼
          ┌─────────────────┐
          │   PostgreSQL     │
          └─────────────────┘
```

The `packages/trpc` package contains all router definitions and is imported
by `apps/api` (to mount on Fastify) and by `apps/web` + `apps/mobile`
(for the typed client). The `packages/shared` package holds Zod schemas
used by both tRPC input validation and client-side form validation.

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

Since the API is now a standalone server (not inside Next.js), auth must work at the API layer. The web and mobile clients authenticate against the API, which issues/validates tokens.

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Better Auth** | Framework-agnostic, TypeScript-first, works with Fastify/Hono/Express, supports many providers, modern API, session + JWT modes | Newer (less battle-tested than NextAuth) | **Recommended** — best fit for a standalone API that serves multiple clients |
| **Lucia** | Lightweight, no magic, full control, framework-agnostic | More manual setup, recently moved to maintenance mode (v3 is final) | Good if you want maximum control |
| **Custom JWT (jsonwebtoken + bcrypt)** | Full control, minimal deps, framework-agnostic by nature | Must handle refresh tokens, CSRF, password hashing, etc. yourself | Viable for a personal app with simple auth needs |
| **Auth.js (NextAuth v5)** | Many providers, session management | Tightly coupled to Next.js — doesn't fit a standalone API well | **Not recommended** for this architecture |

> **Note:** With a standalone Fastify API, Auth.js loses its main advantage
> (tight Next.js integration). Better Auth or Lucia are more natural fits
> since they work at the HTTP/framework level and can issue JWTs that both
> web and mobile clients use.

### 3.8 Client-Side Routing

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **TanStack Router** | Type-safe routes + search params, file-based routing, built-in TanStack Query integration, loader patterns, pending/error states | Newer, less community content than React Router | **Recommended** — completes the TanStack ecosystem (Router + Query + tRPC) |
| **React Router v7** | Most popular, huge ecosystem, file-based routing (via framework mode) | Less type-safe than TanStack Router, framework mode overlaps with Remix | Solid fallback if TanStack Router feels too new |

> **TanStack ecosystem synergy:** Using TanStack Router + TanStack Query +
> tRPC together creates a deeply integrated data flow. Routes can declare
> data dependencies via `loader`, Query handles caching and revalidation,
> and tRPC provides the typed API layer. All three libraries are designed
> to work together.

### 3.9 State Management (Client)

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **TanStack Query (React Query)** | Best for server state, caching, revalidation | Not for pure client state | **Recommended** — built-in tRPC integration, pairs with TanStack Router |
| **Zustand** | Simple, lightweight, great for client-only state | Another dependency | Add only if needed for complex client state |
| **React Context** | Built-in, no deps | Verbose for complex state, re-render issues | Use for simple global state (theme, locale) |

### 3.10 Charts / Data Visualization

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Recharts** | React-native, declarative, easy to use | Limited customization for complex charts | **Recommended** — good enough for budget dashboards |
| **Tremor** | Built on Recharts + Tailwind, beautiful dashboard components | Less flexible, opinionated | Great if using Tailwind already |
| **Chart.js (react-chartjs-2)** | Feature-rich, well-documented | Imperative API, less React-idiomatic | Solid fallback |
| **Nivo** | Beautiful, many chart types, animations | Heavier bundle | If you need advanced visualizations |

### 3.11 Mobile (Phase 2)

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
DigitalOcean Droplet (1GB RAM is sufficient, 2GB comfortable)
├── Docker Compose
│   ├── api      (Fastify + tRPC — port 4000, internal)
│   ├── postgres (PostgreSQL 16 — port 5432, internal only)
│   └── nginx    (ports 80/443)
│       ├── /            → static files (Vite build from apps/web)
│       └── /api/*       → proxy to api:4000
├── Certbot / Let's Encrypt (HTTPS)
├── GitHub Actions (CI/CD — build, test, deploy via SSH)
└── Automated backups (pg_dump cron + DO Spaces or similar)
```

> **Only two processes** — Fastify and PostgreSQL. The web frontend is static
> files copied into the Nginx container (or a shared volume) at build time.
> No Node.js process for the frontend, which significantly reduces memory
> usage compared to running Next.js. A 1GB droplet ($6/mo) is likely enough
> for the MVP.

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
- [ ] Set up Fastify API server (`apps/api`) with tRPC
- [ ] Set up React + Vite SPA (`apps/web`) with TanStack Router + tRPC client
- [ ] Create shared packages (`packages/db`, `packages/trpc`, `packages/shared`)
- [ ] Configure Prisma + PostgreSQL schema
- [ ] Implement authentication (Better Auth on Fastify)
- [ ] Seed database from existing CSV data
- [ ] Set up Docker Compose for local development (API + Postgres + Nginx)
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

### Phase 6 — Frontend Performance & Scale (When Data Gets Heavy)

This phase addresses the inevitable point where the dashboard handles years of
expense history, thousands of transactions, and complex visualizations. The
optimizations are grouped by the specific bottleneck they solve.

#### 6.1 Problem: Large Tables & Lists (Transaction History, Expense Lists)

As transaction count grows into the thousands, rendering full lists will
cause jank and high memory usage.

| Solution | What It Does | When to Apply |
|---|---|---|
| **TanStack Table + Virtualization** | Only renders rows visible in the viewport. TanStack Table (same ecosystem) handles sorting, filtering, grouping, and column pinning. Pair with `@tanstack/react-virtual` for virtualized rendering. | When any list exceeds ~200 rows |
| **Cursor-based pagination** | API returns pages of data instead of full datasets. tRPC + TanStack Query support `useInfiniteQuery` natively for infinite scroll patterns. | When single API responses exceed ~500 records |
| **Server-side filtering & aggregation** | Move filtering, search, and grouping to the API/database layer instead of fetching all data and filtering client-side. PostgreSQL is very good at this. | When client-side filtering causes noticeable lag |

#### 6.2 Problem: Heavy Charts & Visualizations

Multi-year trend charts with thousands of data points can choke the browser,
especially on mobile.

| Solution | What It Does | When to Apply |
|---|---|---|
| **Data downsampling** | API returns pre-aggregated data (e.g., weekly averages instead of daily entries for charts spanning years). Add `granularity` parameter to chart endpoints (`day`, `week`, `month`). | When chart datasets exceed ~500 points |
| **Canvas-based charting** | Switch from SVG-based Recharts to a Canvas renderer (e.g., Chart.js, uPlot, or Recharts with `<canvas>` via `customized`). Canvas handles 10k+ points without DOM overhead. | When SVG charts visibly lag on zoom/pan |
| **Lazy chart loading** | Only render charts when they scroll into the viewport using `IntersectionObserver` or `React.lazy` + `Suspense`. Dashboard pages with 5+ charts benefit significantly. | When dashboard initial render is slow |
| **Web Workers for data processing** | Offload heavy data transformations (rolling averages, category rollups, percentile calculations) to a Web Worker so the main thread stays responsive. | When data processing blocks UI interaction |

#### 6.3 Problem: Bundle Size Growth

As features accumulate, the JS bundle grows and initial load slows down.

| Solution | What It Does | When to Apply |
|---|---|---|
| **Route-based code splitting** | TanStack Router supports lazy route loading out of the box. Each route's component and data loader are separate chunks loaded on navigation. | Enable from day one — nearly free |
| **Dynamic imports for heavy components** | Charts, rich editors, export dialogs — anything heavy that isn't needed on first render. Use `React.lazy()` + `Suspense`. | When `vite-bundle-analyzer` shows large chunks |
| **Tree-shaking audit** | Ensure imports from large libraries (date-fns, lodash-es, Recharts) use named imports. Vite tree-shakes well, but barrel exports can defeat it. | Periodic audit every few months |
| **React Compiler** | Automatic memoization of components and hooks. Eliminates the need for manual `useMemo`/`useCallback`. Expected to be stable and production-ready by this phase. | When it hits stable release |

#### 6.4 Problem: Slow Initial Load / Perceived Performance

Even with code splitting, a large SPA can feel slow on first load compared
to a server-rendered page.

| Solution | What It Does | When to Apply |
|---|---|---|
| **TanStack Start (SSR migration)** | The natural evolution of the current stack. TanStack Start is a full-stack framework built on TanStack Router + Vite. Migrating from the SPA to Start adds SSR/streaming without changing the router, query, or tRPC setup. The migration path is designed to be incremental. | When TanStack Start reaches stable (currently beta) and initial load time becomes a user complaint |
| **CDN for static assets** | Move the Vite build output to Cloudflare Pages, Vercel, or an S3 + CloudFront setup. Assets load from edge nodes worldwide instead of your single VPS. | When users access the app from multiple regions |
| **Service Worker (pre-caching)** | Cache the app shell and critical assets so repeat visits load instantly. Workbox (by Google) integrates with Vite via `vite-plugin-pwa`. | When you want offline support or instant repeat loads |
| **Streaming / Progressive rendering** | With TanStack Start, the server can stream HTML as data becomes available. Critical UI appears immediately, data-heavy sections fill in progressively. | After migrating to TanStack Start |

#### 6.5 Problem: Client-Side Memory & Responsiveness

Long sessions with lots of open views, background data refreshing, and
accumulated query cache can cause memory pressure.

| Solution | What It Does | When to Apply |
|---|---|---|
| **TanStack Query garbage collection** | Configure `gcTime` (garbage collection time) and `staleTime` per query to evict old cache entries. Reduce `gcTime` for heavy queries like full transaction lists. | When DevTools shows query cache growing unbounded |
| **Optimistic updates** | Update the UI immediately on mutation (e.g., marking an expense as paid) and reconcile with the server response. Reduces perceived latency and avoids full refetches. Already supported by tRPC + TanStack Query. | When mutations feel slow due to network round-trips |
| **IndexedDB for local cache** | Persist TanStack Query cache to IndexedDB (via `persistQueryClient` plugin) so the app starts with warm data instead of loading everything fresh. | When startup data fetching is noticeable |
| **Debounced search & filters** | Debounce user input before triggering API calls. Prevents request storms when typing in search fields or adjusting date ranges. | From the start — but tune thresholds as data grows |

#### 6.6 Problem: Backend Becomes the Bottleneck

Sometimes the frontend is fast but waiting on slow API responses.

| Solution | What It Does | When to Apply |
|---|---|---|
| **PostgreSQL materialized views** | Pre-compute expensive aggregations (monthly totals, category breakdowns, year-over-year comparisons). Refresh on a schedule or on data change. | When dashboard summary queries exceed ~200ms |
| **Redis caching layer** | Cache frequently-read, rarely-changed data (category lists, account info, monthly summaries). Add a Redis container to Docker Compose. | When the same expensive queries run repeatedly |
| **Database indexes** | Add compound indexes for common query patterns (e.g., `expenses(userId, date, categoryId)`). Use `EXPLAIN ANALYZE` to identify slow queries. | Proactively during Phase 3–4, then ongoing |
| **Connection pooling** | Use PgBouncer or Prisma's built-in connection pool to handle concurrent requests efficiently. | When API concurrency increases (multiple users or aggressive prefetching) |

#### 6.7 The TanStack Start Migration Path

This deserves special attention because it's the single biggest architectural
improvement available to the frontend, and the migration is designed to be smooth.

**What TanStack Start is:** A full-stack framework built on TanStack Router +
TanStack Query + Vite. It adds SSR, streaming, and server functions to the
exact stack we're already using.

**Why the migration is low-risk:**
- The SPA already uses TanStack Router → Start uses the same router with the
  same file-based route structure
- TanStack Query integration stays identical
- tRPC client code doesn't change
- Vite remains the build tool
- You're essentially adding a thin server layer on top of the existing app

**What you gain:**
- Server-side rendering for faster initial paint
- Streaming HTML — critical UI renders immediately, data fills in progressively
- Server functions — for operations that benefit from running server-side
  (e.g., generating PDF reports, heavy data transforms)
- Still deploys to your VPS — just adds a Node.js process for SSR (like
  adding Next.js back, but without leaving the TanStack ecosystem)

**When to do it:** When TanStack Start reaches stable (v1.0) AND you have
a measurable performance problem with initial load times that can't be solved
by code splitting and caching alone.

---

## 7. Recommended Stack Summary

This is the recommended "default" stack based on the analysis above. Alternatives are documented in Section 3 for each decision.

| Layer | Choice | Reasoning |
|---|---|---|
| **Monorepo** | Turborepo + pnpm | Simple, fast, purpose-built for JS/TS |
| **Frontend** | React + Vite (SPA) | Static output, fastest builds, no server needed, TanStack Router for file-based routing |
| **Routing** | TanStack Router | Type-safe, file-based routes, deep TanStack Query integration |
| **UI** | shadcn/ui + Tailwind CSS v4 | Beautiful, accessible, full ownership |
| **API Server** | Fastify | Fastest Node.js framework, great plugin system, mature |
| **API Protocol** | tRPC v11 (on Fastify) | End-to-end type safety, no codegen, serves web + mobile |
| **Database** | PostgreSQL 16 | ACID compliance, best for financial data |
| **ORM** | Prisma | Best DX, auto-generated types, great migrations |
| **Validation** | Zod | Standard with tRPC, runtime + static types |
| **Auth** | Better Auth | Framework-agnostic, TS-first, works with standalone API |
| **State** | TanStack Query | Server state caching, built-in tRPC integration |
| **Charts** | Recharts or Tremor | Simple, declarative, Tailwind-compatible |
| **Deployment** | Docker Compose on DO VPS | API + Postgres in containers, static frontend in Nginx |
| **CI/CD** | GitHub Actions | Free, great ecosystem |
| **Mobile (future)** | Expo | Shared tRPC client + logic via monorepo |

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
