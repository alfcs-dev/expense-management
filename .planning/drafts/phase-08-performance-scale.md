# Phase 8 — Frontend Performance & Scale (When Data Gets Heavy)

> **Source:** [PLAN.md](../PLAN.md) Section 6, Phase 8 (Sections 8.1–8.7).  
> **When starting this phase:** move this file to `../in_progress/` and use the "In progress" section at the bottom to log achievements, decisions, and roadblocks.

**Planning Metadata**
- Status: draft
- Owner: @alfcs
- Target start: Continuous after production launch (as needed)
- Target end: Ongoing
- Actual start: TBD
- Actual end: TBD
- Dependencies: Production usage data and measured bottlenecks
- Linked PRs/issues: TBD

---

## 1. Goals

Address performance and scale when the dashboard has years of data, thousands of transactions, and many charts. Apply solutions only when the corresponding bottleneck is observed (see "When to apply" in PLAN).

- **Large lists:** Virtualization, cursor pagination, server-side filtering.
- **Heavy charts:** Downsampling, canvas rendering, lazy load, Web Workers.
- **Bundle size:** Code splitting, dynamic imports, tree-shaking, React Compiler when stable.
- **Initial load:** TanStack Start (SSR) when stable and when load time is a problem; CDN, service worker, streaming.
- **Client memory:** Query GC, optimistic updates, IndexedDB cache, debounced filters.
- **Backend:** Materialized views, Redis cache, indexes, connection pooling.

---

## 2. Prerequisites

- Phases 1–4 (or 1–7) complete; app in production with real usage.
- Measured bottlenecks (e.g. slow dashboard, large list jank, big bundle) or proactive targets (e.g. "support 10k expenses without lag").

---

## 3. What's needed (task breakdown)

### 3.1 Large tables and lists (PLAN 8.1)

- [ ] **TanStack Table + virtualization:** For expense/transaction lists, use TanStack Table with `@tanstack/react-virtual`; render only visible rows. Apply when list exceeds ~200 rows.
- [ ] **Cursor-based pagination:** tRPC procedures return `{ items, nextCursor }`; client uses `useInfiniteQuery`. Apply when single response exceeds ~500 records.
- [ ] **Server-side filtering:** Filter and sort in DB (Prisma where/orderBy); avoid fetching full set and filtering client-side.

### 3.2 Heavy charts (PLAN 8.2)

- [ ] **Data downsampling:** Chart endpoints accept `granularity` (day/week/month); return pre-aggregated series. Apply when chart data exceeds ~500 points.
- [ ] **Canvas charting:** If Recharts (SVG) lags, switch to Chart.js, uPlot, or Recharts canvas. Apply when SVG visibly lags.
- [ ] **Lazy chart load:** Render charts only when in viewport (IntersectionObserver or React.lazy + Suspense). Apply when dashboard has 5+ charts.
- [ ] **Web Workers:** Offload heavy transforms (rolling averages, category rollups) to a worker. Apply when data processing blocks UI.

### 3.3 Bundle size (PLAN 8.3)

- [ ] **Route-based code splitting:** TanStack Router lazy routes; ensure each route loads its own chunk. Enable from day one.
- [ ] **Dynamic imports:** Charts, export dialog, heavy modals via React.lazy + Suspense. Apply when bundle analyzer shows large chunks.
- [ ] **Tree-shaking audit:** Named imports for date-fns, lodash-es, Recharts; avoid barrel exports that prevent tree-shake.
- [ ] **React Compiler:** When stable, enable for automatic memoization. Apply when released.
- [ ] **Phase 2 follow-up (build warning):** Address current web build chunk warning (`~900kB` in `dist/assets/index-*.js`) by introducing route-level lazy loading and deferring dashboard/chart code (Recharts) behind dynamic imports; record before/after bundle sizes.

### 3.4 Initial load (PLAN 8.4)

- [ ] **TanStack Start:** Evaluate migration from SPA to Start (SSR + streaming) when Start is stable and initial load is a measured problem. Same router/query/tRPC; add server layer.
- [ ] **CDN:** Serve static assets from Cloudflare/Vercel/S3+CloudFront if users are multi-region.
- [ ] **Service worker:** Pre-cache app shell (e.g. vite-plugin-pwa/Workbox) for instant repeat loads.
- [ ] **Streaming:** After Start migration, stream HTML; critical UI first, data sections progressive.

### 3.5 Client memory (PLAN 8.5)

- [ ] **TanStack Query GC:** Set `gcTime` and `staleTime` per query; lower for heavy lists so cache doesn’t grow unbounded.
- [ ] **Optimistic updates:** Use for mutations (e.g. mark expense paid) to avoid full refetch; already supported by tRPC + TanStack Query.
- [ ] **IndexedDB cache:** Persist query client (e.g. persistQueryClient) so app starts with warm data. Apply when startup fetch is noticeable.
- [ ] **Debounced search/filters:** Debounce input before calling API; tune threshold.

### 3.6 Backend (PLAN 8.6)

- [ ] **Materialized views:** Pre-compute monthly totals, category breakdowns, YoY; refresh on schedule or on write. Apply when dashboard queries exceed ~200ms.
- [ ] **Redis:** Cache category list, account list, monthly summaries; add Redis to Docker Compose. Apply when same heavy queries run repeatedly.
- [ ] **Indexes:** Compound indexes for common patterns (e.g. expenses: userId, date, categoryId); use EXPLAIN ANALYZE to find slow queries.
- [ ] **Connection pooling:** PgBouncer or Prisma pool for concurrent requests. Apply when concurrency grows.

### 3.7 TanStack Start migration (PLAN 8.7)

- [ ] **When:** Only when Start is stable (v1.0) and initial load is a real complaint.
- [ ] **What:** Add server entry, keep router/query/tRPC; deploy with Node process for SSR.
- [ ] **Document:** Migration steps and rollback; measure before/after LCP and TTFB.

---

## Definition of Ready (DoR)

- [ ] Required schema/docs for this phase are finalized.
- [ ] External vendor/provider decisions are finalized (if applicable).
- [ ] Required environment variables and secrets are confirmed.
- [ ] Validation plan is agreed (`pnpm lint`, `pnpm typecheck`, smoke checks, and any relevant performance checks).

---

## 4. How to achieve it

### 4.1 Key references

- [PLAN.md](../PLAN.md) Sections 8.1–8.7 — Each subsection has a table: Solution, What it does, When to apply.
- Apply incrementally; measure before and after (Lighthouse, bundle size, API latency).

### 4.2 Suggested order

1. Apply "when to apply" from day one: route code splitting, debounced filters.
2. When lists grow: add pagination (cursor) and virtualization to largest list.
3. When charts lag: add granularity to chart API, then lazy load charts, then consider canvas.
4. When bundle grows: analyzer run, dynamic imports for heavy components.
5. When backend slows: indexes and EXPLAIN; then materialized views or Redis if needed.
6. TanStack Start only after it’s stable and load time is the bottleneck.

### 4.3 Technical notes

- **Measure first:** Use React DevTools, Lighthouse, network tab, and DB EXPLAIN before and after each change.
- **Incremental:** Phase 8 is a toolkit; not every item is required. Prioritize by user impact.

---

## 5. Decisions to make

- Whether to adopt TanStack Start at all (adds server process and deploy complexity).
- Redis vs in-memory cache (e.g. node-cache) for single-instance API.
- How aggressive to be with virtualization (all lists vs only expense/transaction lists).

---

## 6. Possible roadblocks

- TanStack Start still in beta; API may change.
- Materialized view refresh strategy: on every write vs cron; consistency vs freshness.
- Redis persistence and failover if you later scale to multiple API instances.

---

## 7. Definition of done

- [ ] Lists that can grow large are virtualized and/or paginated; server-side filtering where needed.
- [ ] Charts use downsampling or lazy load where appropriate; no UI jank on large date ranges.
- [ ] Bundle is split and heavy components lazy-loaded; tree-shake verified.
- [ ] Backend has indexes and (if needed) materialized views or Redis for slow queries.
- [ ] Optional: TanStack Start migration documented and (if done) deployed with improved LCP/TTFB.
- [ ] Optional: Service worker and CDN in place for repeat visits and global users.

---

## 8. In progress (use after moving to in_progress)

*When you start Phase 8, move this file to `../in_progress/` and fill below.*

**Achievements:**
- 

**Decisions:**
- 

**Roadblocks:**
- 
