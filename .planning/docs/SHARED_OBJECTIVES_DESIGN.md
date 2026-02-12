# Shared Objectives Feature — Design Document

> Referenced from [SCHEMA_VISUALIZATION.md](SCHEMA_VISUALIZATION.md) Section 4
> and [PLAN.md](../PLAN.md) Phase 7.

---

## 1. Problem Statement

Two users — who may be partners sharing one budget OR two independent people
with separate budgets — want to:

1. Create a shared financial goal (e.g., house down payment, vacation fund,
   emergency fund)
2. Assign a target account where the money accumulates
3. Both contribute money toward the goal over time
4. Each person tracks their contributions as expenses in their own budget
5. Both see real-time progress toward the target

**This is not the same as a shared budget.** A shared budget (via
`BudgetCollaborator`) means two people manage the same monthly budget. A shared
objective means two people with potentially *different* budgets are saving
toward the same goal.

---

## 2. User Stories

### 2.1 Creating an Objective

> As a user, I want to create a shared savings objective with a name, target
> amount, target date, and target account, so my partner and I can track our
> progress toward a shared financial goal.

**Flow:**
1. User A creates an objective: "House Down Payment" / $500,000 MXN / Dec 2027
2. User A selects or creates a target account (e.g., "GBM Inversiones")
3. User A is automatically added as an `owner` member
4. User A invites User B (via email or in-app)
5. User B accepts and configures their tracking preferences:
   - Which budget category to file contributions under (e.g., "Ahorro")
   - Which source account to debit from (e.g., "Nu Dalia Debito")

### 2.2 Contributing to an Objective

> As a member of a shared objective, I want to log a contribution that
> automatically appears as an expense in my budget, so I don't have to
> enter the same transaction twice.

**Flow:**
1. User A opens the objective and clicks "Add Contribution"
2. Enters amount ($10,000 MXN) and optional note ("February contribution")
3. System creates:
   - An `ObjectiveContribution` record linked to the objective
   - An `Expense` record in User A's current monthly budget, using User A's
     configured category and account
4. Objective's `currentAmount` is updated
5. Both User A and User B see the updated progress

### 2.3 Viewing Progress

> As a member of a shared objective, I want to see total progress, each
> person's contributions, and how much is left, so I know if we're on track.

**Dashboard widget shows:**
- Progress bar (current / target)
- Per-member contribution breakdown
- Monthly contribution trend
- Projected completion date (based on contribution velocity)
- List of recent contributions

### 2.4 Two Partners, One Objective, Different Budgets

> As a couple with separate budgets, we want to save toward a shared goal
> without merging our budgets.

**Example:**
- Alfredo has budget "Alfredo - Febrero 2026"
- Dalia has budget "Dalia - Febrero 2026"
- Both contribute to "Fondo para Casa" objective
- Alfredo's $10,000 contribution shows as:
  - An expense in "Alfredo - Febrero 2026" under category "Ahorro",
    debited from "HSBC Debit"
- Dalia's $8,000 contribution shows as:
  - An expense in "Dalia - Febrero 2026" under category "Inversiones",
    debited from "Nu Dalia Debito"
- Both see $18,000 total progress on the objective dashboard

### 2.5 Two Partners, One Shared Budget, One Objective

> As a couple sharing one budget, our contributions to a shared goal should
> both appear in our shared budget.

**Example:**
- Both share budget "Familia - Febrero 2026" (via `BudgetCollaborator`)
- Both contribute to "Vacaciones Cancún" objective
- Both contributions land as expenses in the same shared budget
- Objective tracks who contributed what

---

## 3. Data Model

### 3.1 SharedObjective

The goal itself.

```
SharedObjective
├── id              (string, PK)
├── createdByUserId (string, FK → User)
├── accountId       (string, FK → Account — where money lives)
├── name            (string — "House Down Payment")
├── description     (string, nullable)
├── targetAmount    (int — centavos)
├── currentAmount   (int — centavos, denormalized)
├── currency        (enum — MXN | USD)
├── targetDate      (datetime, nullable)
├── status          (enum — active | completed | paused | cancelled)
├── createdAt       (datetime)
└── updatedAt       (datetime)
```

**Notes:**
- `accountId` points to an `Account` that represents where the money
  physically accumulates. This account is owned by one user but visible
  (read-only) to all members.
- `currentAmount` is denormalized (updated on each contribution) for fast
  reads. A periodic reconciliation job verifies it matches
  `SUM(contributions.amount)`.

### 3.2 ObjectiveMember

Links a user to an objective and stores their personal tracking preferences.

```
ObjectiveMember
├── id              (string, PK)
├── objectiveId     (string, FK → SharedObjective)
├── userId          (string, FK → User)
├── budgetId        (string, FK → Budget, nullable)
│                   — which budget to auto-create expenses in
│                   — nullable: user can contribute without budget tracking
├── categoryId      (string, FK → Category, nullable)
│                   — which category to file contributions under
├── accountId       (string, FK → Account, nullable)
│                   — source account for contributions
├── role            (enum — owner | contributor)
├── joinedAt        (datetime)
└── updatedAt       (datetime)
```

**Notes:**
- `budgetId` can be null if the user wants to contribute but not
  auto-track in a budget. The `Expense` creation is optional.
- `categoryId` and `accountId` are the user's *default* preferences.
  They can override these per-contribution if needed.
- Each user configures their own tracking independently. User A might use
  category "Ahorro" and account "HSBC". User B might use "Inversiones"
  and "Nu Debito".

### 3.3 ObjectiveContribution

Each deposit toward the goal.

```
ObjectiveContribution
├── id              (string, PK)
├── objectiveId     (string, FK → SharedObjective)
├── memberId        (string, FK → ObjectiveMember)
├── expenseId       (string, FK → Expense, nullable)
│                   — the auto-created expense in the contributor's budget
├── amount          (int — centavos)
├── currency        (enum — MXN | USD)
├── date            (datetime)
├── notes           (string, nullable)
└── createdAt       (datetime)
```

**Notes:**
- `expenseId` links to the `Expense` record auto-created in the
  contributor's budget. This is the key that creates the dual-tracking
  behavior. If null, the contribution wasn't tracked as a budget expense.
- The `Expense` record has `source: 'objective'` and
  `objectiveContributionId` pointing back to this contribution, making
  the link bidirectional.

---

## 4. Contribution Flow (Detailed)

```
User clicks "Add Contribution" on objective
│
├── Input: amount, date, notes (optional)
│
▼
┌─────────────────────────────────────────┐
│            tRPC Mutation                 │
│  objective.contribute                   │
│                                         │
│  1. Validate: user is a member          │
│  2. Validate: objective is active       │
│  3. Validate: amount > 0               │
│                                         │
│  4. BEGIN TRANSACTION                   │
│  │                                      │
│  ├─ Create ObjectiveContribution        │
│  │                                      │
│  ├─ If member has budgetId configured:  │
│  │  ├─ Find or create current Budget    │
│  │  ├─ Create Expense {                 │
│  │  │    userId: member.userId          │
│  │  │    budgetId: member.budgetId      │
│  │  │    categoryId: member.categoryId  │
│  │  │    accountId: member.accountId    │
│  │  │    description: "→ {objective}"   │
│  │  │    amount: contribution.amount    │
│  │  │    source: 'objective'            │
│  │  │    objectiveContributionId: id    │
│  │  │  }                               │
│  │  └─ Link Expense to Contribution    │
│  │                                      │
│  ├─ Update SharedObjective.currentAmount│
│  │   += contribution.amount             │
│  │                                      │
│  ├─ If currentAmount >= targetAmount:   │
│  │   └─ Set status: 'completed'         │
│  │                                      │
│  └─ COMMIT TRANSACTION                  │
│                                         │
└─────────────────────────────────────────┘
│
▼
Both users see updated progress in real-time
(via TanStack Query invalidation)
```

---

## 5. API Design (tRPC Procedures)

```typescript
// packages/trpc/src/routers/objective.ts

objectiveRouter = router({
  // ── Queries ──
  list:          publicProcedure.query(...)     // List objectives for current user
  getById:       publicProcedure.query(...)     // Full objective with members + recent contributions
  getProgress:   publicProcedure.query(...)     // Summary stats: progress %, per-member breakdown
  contributions: publicProcedure.query(...)     // Paginated contribution history

  // ── Mutations ──
  create:        publicProcedure.mutation(...)  // Create objective + add self as owner
  invite:        publicProcedure.mutation(...)  // Invite user by email
  join:          publicProcedure.mutation(...)  // Accept invite, set tracking preferences
  configure:     publicProcedure.mutation(...)  // Update member's budget/category/account prefs
  contribute:    publicProcedure.mutation(...)  // Add contribution (+ auto-create expense)
  update:        publicProcedure.mutation(...)  // Edit objective (name, target, date)
  pause:         publicProcedure.mutation(...)  // Pause objective
  complete:      publicProcedure.mutation(...)  // Mark as completed
  cancel:        publicProcedure.mutation(...)  // Cancel objective
  removeMember:  publicProcedure.mutation(...)  // Remove a member (owner only)
  leave:         publicProcedure.mutation(...)  // Leave an objective (contributor only)
})
```

---

## 6. UI Concepts

### 6.1 Objective Dashboard Card

```
┌──────────────────────────────────────────┐
│  🏠 House Down Payment                   │
│                                          │
│  ████████░░░░░░░░░░░░░░  32%            │
│  $160,000 / $500,000 MXN                │
│                                          │
│  Alfredo:  $100,000  (62.5%)             │
│  Dalia:    $60,000   (37.5%)             │
│                                          │
│  Target: Dec 2027 · On track ✓           │
│                                          │
│  [+ Add Contribution]                    │
└──────────────────────────────────────────┘
```

### 6.2 Contribution History

```
┌──────────────────────────────────────────┐
│  Recent Contributions                    │
│                                          │
│  Feb 1   Alfredo   $10,000   February    │
│  Feb 1   Dalia     $8,000    February    │
│  Jan 15  Alfredo   $10,000   Bonus       │
│  Jan 1   Alfredo   $10,000   January     │
│  Jan 1   Dalia     $8,000    January     │
│                                          │
│  Monthly avg: $23,000                    │
│  Est. completion: Oct 2027               │
└──────────────────────────────────────────┘
```

### 6.3 In Budget View

When viewing a monthly budget, objective contributions appear as regular
expenses within the configured category:

```
Category: Ahorro
├── Largo Plazo (Stori)        $1,100
├── Trading (GBM)              $500
├── Dólares (GBM)              $500
└── → House Down Payment       $10,000  ← objective contribution
    └── 📎 Shared Objective
```

The `→` prefix and tag help visually distinguish objective contributions
from regular savings expenses.

---

## 7. Edge Cases & Design Decisions

### 7.1 What if a contribution expense is deleted?

If the user deletes the `Expense` from their budget:
- The `ObjectiveContribution` remains (objective progress is not affected)
- The `expenseId` on the contribution is set to null
- The user can re-link it by recreating the expense from the contribution

**Rationale:** The objective is a shared agreement. One person deleting a
budget entry shouldn't erase the contribution. The money was still contributed.

### 7.2 What if the objective account belongs to one user?

The target account typically belongs to one person. The other person sees
objective progress but doesn't have direct access to the account in
their own account list.

**Possible enhancement:** Add a read-only "shared accounts" view where
members can see the balance of the objective account without full access.

### 7.3 Currency mismatch?

If User A contributes in MXN and the objective is in USD (or vice versa):
- For MVP: require all contributions to match the objective's currency
- Future: allow cross-currency contributions with an exchange rate at
  time of contribution, stored on the `ObjectiveContribution` record

### 7.4 What about withdrawals?

Sometimes money needs to come back out of an objective (emergency, plan change):
- Allow negative contributions (withdrawals) from the owner only
- Withdrawal creates a negative `ObjectiveContribution`
- If budget-tracked, creates a negative expense (income) in the budget
- `currentAmount` decreases accordingly

### 7.5 Multiple objectives per pair?

Fully supported. Two users can have multiple shared objectives simultaneously
(house, vacation, emergency fund, car). Each has its own target account,
progress, and contribution history.

### 7.6 More than two members?

The model supports N members per objective. While the primary use case is
couples, nothing prevents a roommate group or family from creating a shared
objective with 3+ contributors.

---

## 8. Phase Placement

This feature sits at the **intersection of Multi-User (Phase 7) and
Savings Goals (Phase 3)**.

### Recommended Implementation Order

**Phase 3 (MVP):**
- Build `SavingsGoal` as a single-user feature (personal savings targets)
- No shared functionality yet

**Phase 7 (Multi-User):**
- Implement multi-user support (User invites, authentication for multiple users)
- Build `SharedObjective`, `ObjectiveMember`, `ObjectiveContribution`
- Add the auto-expense-creation flow
- Dashboard widget for objective progress
- Contribution history view

**Why not earlier?**
- Shared objectives require multi-user auth to be in place first
- The invite/join flow needs user management
- Testing requires two real user accounts
- The single-user `SavingsGoal` covers 80% of the value for the MVP

**Schema placement:** Define the tables in the Prisma schema from day one
(Phase 1) but don't build the UI or API routes until Phase 7. This keeps
the migration path clean.

---

## 9. Relationship to Existing Features

| Feature | Relationship to Shared Objectives |
|---|---|
| **SavingsGoal** | Personal, single-user version. SharedObjective is the multi-user evolution. Could merge or keep both — they serve different UX patterns. |
| **BudgetCollaborator** | Orthogonal. Two users can share a budget AND have shared objectives. Or have separate budgets with shared objectives. |
| **Transfer** | A contribution could be modeled as a Transfer (from user's account to objective account). For MVP, keep them separate. Future enhancement: auto-create Transfer records. |
| **RecurringExpense** | A user could set up a recurring contribution to an objective. Future enhancement: `RecurringExpense` with `objectiveId` that auto-contributes monthly. |
