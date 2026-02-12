# Phase 7 — Multi-User, Shared Objectives, Notifications & Intelligence

> **Source:** [PLAN.md](../PLAN.md) Section 6, Phase 7.  
> **Shared Objectives:** [SHARED_OBJECTIVES_DESIGN.md](../docs/SHARED_OBJECTIVES_DESIGN.md).  
> **Auth/collab:** [DEV_SERVICES_RESEARCH.md](../research/DEV_SERVICES_RESEARCH.md) (Better Auth organization plugin).  
> **When starting this phase:** move this file to `../in_progress/` and use the "In progress" section at the bottom to log achievements, decisions, and roadblocks.

---

## 1. Goals

- **Multi-user:** User registration, invite system, budget sharing via BudgetCollaborator with roles (owner, editor, viewer).
- **Shared objectives:** Cross-budget savings goals; create objective, invite members, member config (budget/category/account), contribution flow with auto-expense in contributor's budget, dashboard widget, history, projected completion.
- **Notifications:** Push (web: Web Push + Service Worker; mobile: Expo Push), notification preferences UI (what, quiet hours, batching).
- **Intelligence:** Auto-categorization from RFC vendor directory; duplicate detection (bank + SAT); anomaly detection; tax deduction suggestions from CFDI.

---

## 2. Prerequisites

- Phase 6 complete (or at least Phase 3+4) so expenses and accounts are stable.
- Schema includes BudgetCollaborator, SharedObjective, ObjectiveMember, ObjectiveContribution (see SCHEMA_VISUALIZATION and SHARED_OBJECTIVES_DESIGN).
- Phase 5 push token registration if using push in Phase 7.

---

## 3. What's needed (task breakdown)

### 3.1 Multi-user and invites

- [ ] User registration: open signup or invite-only; Better Auth handles registration.
- [ ] Better Auth organization plugin: enable; run migrations. Use for "organization" = budget or app-level groups; or implement custom invite table (inviter, invitee email, budgetId/objectiveId, role, token, expires).
- [ ] Invite flow: send email (or in-app) with link; accept link sets BudgetCollaborator or ObjectiveMember. Handle "user doesn't exist yet" (signup then accept) per DEV_SERVICES_RESEARCH.
- [ ] tRPC: invite list, create invite, accept invite, revoke.

### 3.2 Budget sharing (BudgetCollaborator)

- [ ] tRPC: add collaborator (by email or user id), set role (owner/editor/viewer), remove. List collaborators for a budget.
- [ ] Authorization: owner can edit/delete budget and manage collaborators; editor can edit expenses/categories; viewer read-only.
- [ ] Web (and mobile): "Share budget" UI; list of collaborators; role display and change.

### 3.3 Shared objectives — core

- [ ] tRPC: SharedObjective CRUD; create (name, target amount, account, target date, currency); list for user (as creator or member).
- [ ] ObjectiveMember: add member (invite by email), accept, set budgetId/categoryId/accountId per member, role (owner/contributor).
- [ ] Schema and API per [SHARED_OBJECTIVES_DESIGN.md](../docs/SHARED_OBJECTIVES_DESIGN.md).

### 3.4 Shared objectives — contributions

- [ ] Contribution flow: member submits amount (+ optional notes); backend creates ObjectiveContribution and optionally Expense in member's budget (category/account from member config), updates SharedObjective.currentAmount.
- [ ] tRPC: contribution.create, contribution.list (by objective), objective progress (current/target, per-member breakdown).
- [ ] Projected completion date: from contribution velocity (e.g. average monthly contribution); optional.

### 3.5 Shared objectives — UI

- [ ] Dashboard widget: progress bar, per-member breakdown, recent contributions, projected date.
- [ ] Objective detail page: create/edit objective, invite members, member config, add contribution, history (monthly trends).
- [ ] Contribution history with monthly trends (chart or table).

### 3.6 Push notifications

- [ ] **Web:** Web Push API; VAPID keys; service worker subscribes and receives push; store subscription in backend (e.g. PushSubscription table: userId, endpoint, keys, userAgent).
- [ ] **Mobile:** Expo Push; use device token from Phase 5; send via Expo Push API or your backend.
- [ ] Backend: notification preferences (what to send: upcoming payments, objective updates, etc.); quiet hours; batching (e.g. daily digest). Queue and send (e.g. cron or queue worker).
- [ ] UI: preferences page (toggle types, quiet hours, enable/disable push).

### 3.7 Intelligence — auto-categorization (RFC)

- [ ] Use RFC vendor directory or SAT data to map RFC → category (or merchant name → category). Store in CategoryMapping (matchType = 'rfc', matchValue, categoryId).
- [ ] Apply on import and on banking API sync: suggest or assign category for new transactions based on RFC/merchant.

### 3.8 Intelligence — duplicate detection

- [ ] Across bank + SAT + manual: same amount, date, account (or similar); flag or merge. May reuse staging match logic; add "duplicate" flag or merge UI for expenses.

### 3.9 Intelligence — anomaly and tax

- [ ] Anomaly: unusual amount or frequency (e.g. 2x average); surface in dashboard or report.
- [ ] Tax deductions: from CFDI data (deducible expenses); suggest or tag for tax report. Optional report "deducibles by period".

---

## 4. How to achieve it

### 4.1 Key references

- [SHARED_OBJECTIVES_DESIGN.md](../docs/SHARED_OBJECTIVES_DESIGN.md) — Data model, contribution flow, UI stories.
- [DEV_SERVICES_RESEARCH.md](../research/DEV_SERVICES_RESEARCH.md) — Better Auth organization plugin; invite handling.
- [PLAN.md](../PLAN.md) Section 8.2 — Push notification scope and effort.

### 4.2 Suggested order

1. Better Auth organization plugin (or custom invite); user registration if not already open.
2. BudgetCollaborator API and UI (share budget, roles).
3. SharedObjective + ObjectiveMember API (create, invite, member config).
4. Contribution API and auto-expense creation; progress and history.
5. Shared objective UI (widget, detail, contribution form).
6. Push: Web Push + Expo; backend subscription storage and preference model.
7. Send logic: upcoming payments, objective updates; preferences and batching.
8. Auto-categorization (RFC/vendor); duplicate detection; anomaly and tax suggestions (can be minimal in first cut).

### 4.3 Technical notes

- **currentAmount:** Denormalized on SharedObjective; update on each contribution. Optional reconciliation job: SUM(contributions) vs currentAmount.
- **Invite "user doesn't exist":** Better Auth may not support invite-before-signup out of the box; implement custom invite table and signup link that accepts invite after registration.

---

## 5. Decisions to make

- Organization model: Better Auth organizations = one per budget, or one per "workspace", or custom (no org plugin, only BudgetCollaborator + invite table).
- Push provider: self-hosted (node web-push, Expo) vs third-party (OneSignal, Firebase) for delivery.
- Anomaly/tax: depth of first version (e.g. simple rules vs ML later).

---

## 6. Possible roadblocks

- Email delivery for invites: need SMTP or email API (SendGrid, Resend, etc.); ensure deliverability and not spam.
- Push: browser permission and user opt-in; iOS/Android notification permissions.
- Shared objective edge cases: member leaves, objective paused, currency mismatch between members.

---

## 7. Definition of done

- [ ] Users can register; invites (budget or objective) can be sent and accepted; "new user" invite flow works.
- [ ] Budgets can be shared with owner/editor/viewer; role enforcement in API and UI.
- [ ] Shared objectives: create, invite, member config, contributions with auto-expense; progress and history visible.
- [ ] Push notifications (web and/or mobile) sent for configured events; preferences UI in place.
- [ ] Auto-categorization uses RFC/vendor data; duplicate detection and anomaly/tax suggestions available (at least basic).

---

## 8. In progress (use after moving to in_progress)

*When you start Phase 7, move this file to `../in_progress/` and fill below.*

**Achievements:**
- 

**Decisions:**
- 

**Roadblocks:**
- 
