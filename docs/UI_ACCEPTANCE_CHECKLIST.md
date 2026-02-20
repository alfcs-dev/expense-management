# UI Acceptance Checklist (Phase 2.5 Core)

Use this checklist for each core route before marking Slice D complete.

Core routes:
- `/accounts`
- `/categories`
- `/budgets`
- `/recurring-expenses`
- `/expenses`
- `/dashboard`

## 1. Layout and Visual Consistency
- Page uses shared shell/container spacing.
- Main sections are grouped in cards/panels.
- Typography hierarchy is clear (`h1`, section headers, helper text).
- Buttons and controls use shared styling patterns.

## 2. State Coverage
- Loading state is visible and understandable.
- Empty state exists and communicates next action.
- Error state is visible with readable message.
- Success/pending affordance exists for create/update actions.

## 3. Form and Interaction UX
- Field labels are present for all inputs.
- Required fields are enforced and user can recover from validation errors.
- Submit actions show pending/disabled state.
- Edit/cancel/delete actions are clearly separated.

## 4. Responsive Baseline
- No horizontal overflow at narrow viewport widths (~360px).
- Forms and lists remain usable on mobile width.
- Tables or dense data are scrollable when needed.

## 5. Accessibility Baseline
- Labels are associated with controls.
- Buttons and links are keyboard reachable.
- Focus state is visible.
- Color usage does not hide critical information by color alone.

## 6. Locale Formatting
- Currency rendering respects selected language/locale.
- Date formatting is locale-aware where shown.

## Route Sign-Off Template
- Route:
- Reviewer:
- Date:
- Pass/Fail:
- Notes:
