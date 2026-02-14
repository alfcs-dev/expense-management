# Phase 5 — Mobile App (After Solid MVP)

> **Source:** [PLAN.md](../PLAN.md) Section 6, Phase 5.  
> **When starting this phase:** move this file to `../in_progress/` and use the "In progress" section at the bottom to log achievements, decisions, and roadblocks.

**Planning Metadata**
- Status: draft
- Owner: @alfcs
- Target start: Post-MVP milestone
- Target end: Post-MVP milestone
- Actual start: TBD
- Actual end: TBD
- Dependencies: Phase 4 complete (production baseline)
- Linked PRs/issues: TBD

---

## 1. Goals

- PWA support for web (offline capable, installable) as interim mobile solution.
- Expo app in monorepo reusing tRPC client and shared packages.
- Core mobile screens: Dashboard, Expense entry, Account overview.
- Better Auth token-based auth flow for mobile.
- Push notification groundwork: Expo Push, device token registration (delivery in Phase 7).

---

## 2. Prerequisites

- Phase 4 complete (or at least web MVP and API stable).
- Node and pnpm; Expo CLI / EAS familiarity optional.

---

## 3. What's needed (task breakdown)

### 3.1 PWA (web)

- [ ] Add PWA support to `apps/web`: manifest, service worker (e.g. Vite PWA plugin / Workbox), offline caching for shell and critical assets.
- [ ] Installable prompt or instructions; ensure app works offline for already-visited routes (cached data).
- [ ] Test on mobile browser: Add to Home Screen, offline behavior.

### 3.2 Expo app in monorepo

- [ ] Create `apps/mobile` with Expo (React Native), TypeScript.
- [ ] Configure workspace: `apps/mobile` depends on `packages/trpc`, `packages/shared` (and optionally `packages/ui` if shared components work with RN).
- [ ] tRPC client: same router types and procedures; base URL from env (API URL). Use TanStack Query + tRPC in mobile.
- [ ] Zod validators and shared constants from `packages/shared` for forms and validation.

### 3.3 Auth on mobile

- [ ] Better Auth: token-based flow (e.g. session token or JWT in secure storage). No cookie-based session; use Authorization header with token.
- [ ] Login/signup screen; store token (Expo SecureStore or equivalent); attach token to tRPC client.
- [ ] Logout and token refresh if Better Auth supports it; handle 401 and redirect to login.

### 3.4 Core screens

- [ ] **Dashboard:** Monthly summary (income vs expenses, category totals). Reuse or adapt API procedures from web. Simple list or cards.
- [ ] **Expense entry:** Form (amount, category, account, date, description); call `expense.create`. Optionally camera/receipt later.
- [ ] **Account overview:** List accounts with balances; tap to see recent expenses or transfers for that account.
- [ ] Navigation: bottom tabs or drawer (Dashboard, Expenses, Accounts, Settings/Profile).

### 3.5 Push notification groundwork

- [ ] Expo Push: register device token with Expo Push API; store token in backend (e.g. new table `DevicePushToken`: userId, token, platform, createdAt).
- [ ] tRPC or API: `push.registerToken({ token, platform })`, `push.unregisterToken({ token })`.
- [ ] No actual notification sending in Phase 5; only registration so Phase 7 can send (e.g. upcoming payments, shared objective updates).

---

## Definition of Ready (DoR)

- [ ] Required schema/docs for this phase are finalized.
- [ ] External vendor/provider decisions are finalized (if applicable).
- [ ] Required environment variables and secrets are confirmed.
- [ ] Validation plan is agreed (`pnpm lint`, `pnpm typecheck`, smoke checks, and any relevant performance checks).

---

## 4. How to achieve it

### 4.1 Key references

- [PLAN.md](../PLAN.md) — Section 3.11 (Mobile: Expo recommended), Section 6 Phase 5, Section 8.2 (push later).
- PLAN: shared packages (trpc, shared) work identically for web and mobile.

### 4.2 Suggested order

1. PWA for web (manifest, service worker, test install + offline).
2. Create `apps/mobile` with Expo; wire pnpm workspace and shared packages.
3. tRPC client + auth (token in SecureStore, header); login screen.
4. Dashboard screen (data from API).
5. Expense entry screen.
6. Account list and account detail.
7. Push token registration (Expo SDK + backend storage).

### 4.3 Technical notes

- **Shared UI:** If `packages/ui` uses only React + Tailwind, it may not work in RN (different primitives). Use React Native Paper, Tamagui, or native components in mobile; share logic and types, not necessarily components.
- **API URL:** Mobile must point to production (or staging) API; no localhost. Use env (e.g. EXPO_PUBLIC_API_URL).

---

## 5. Decisions to make

- Whether to use EAS Build and EAS Submit for app store builds in this phase or only local/Expo Go.
- Navigation library (Expo Router vs React Navigation).
- How much UI to share (none vs shared design tokens and logic only).

---

## 6. Possible roadblocks

- Better Auth token flow: ensure mobile gets a long-lived token or refresh flow; document in DEV_SERVICES_RESEARCH or auth docs.
- iOS/Android differences: permissions (notifications), secure storage; test on both if possible.
- PWA caching: avoid stale data; consider cache-first for shell, network-first for API data or short stale time.

---

## 7. Definition of done

- [ ] Web app is installable and works offline for shell; PWA manifest and SW in place.
- [ ] Expo app runs (Expo Go or dev build); uses same API via tRPC.
- [ ] Login and token-based auth work on mobile.
- [ ] Dashboard, expense entry, and account overview screens functional.
- [ ] Device push token can be registered and stored for future Phase 7 notifications.

---

## 8. In progress (use after moving to in_progress)

*When you start Phase 5, move this file to `../in_progress/` and fill below.*

**Achievements:**
- 

**Decisions:**
- 

**Roadblocks:**
- 
