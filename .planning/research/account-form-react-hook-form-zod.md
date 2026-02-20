# AccountForm refactor: react-hook-form + shared Zod schemas

## Confidence: **High**

The current setup is well-scoped: one form, clear validation rules, and the backend already uses Zod. The refactor is straightforward with a few deliberate decisions.

---

## Current state

| Layer | What exists |
|-------|-------------|
| **AccountForm.tsx** | Controlled form: `FormState` + `setFormState`; ~15 fields, conditional credit-card block; no client-side schema. |
| **accounts.tsx (parent)** | Holds `formState`, manual validation in `onSubmit` (name trim, CLABE via `parseClabe`, statement/due/grace ranges), builds payload and calls create/update. |
| **packages/trpc account router** | Zod input: `accountInputSchema` (name, type, currency, institutionId, transferProfile, cardProfile, creditCardSettings). Uses `accountTypeSchema`, `currencySchema` from shared; CLABE validated with `parseClabe` after normalize. |

So: backend is already schema-driven; the form and parent do ad-hoc validation and payload building.

---

## Goals

1. **AccountForm** uses **react-hook-form** with **Zod** (e.g. `@hookform/resolvers/zod`) for validation and state.
2. **Shared Zod schemas** used for both:
   - **Backend**: tRPC `.input()` (already almost there; move or reuse from shared).
   - **UI**: Form validation (same rules, same messages where possible).

---

## Design choices

### 1. Schema location and shape

- **Backend** expects a **nested** payload: `{ name, type, currency, institutionId, transferProfile?, cardProfile?, creditCardSettings? }`.
- **Form** state is **flat**: name, type, currency, clabe, depositReference, beneficiaryName, bankName, institutionId, isProgrammable, cardNumberInput, cardBrand, cardLast4, statementDay, dueDay, graceDays.

**Options:**

- **A. Two schemas**  
  - **Form schema (flat)** in `packages/shared` (or web): validates fields as the user sees them; optional CLABE with `clabeSchema`; conditional credit-card days when type is `credit_card`.  
  - **API schema (nested)** in `packages/shared`: same as current `accountInputSchema`; used by tRPC and to validate the payload built from form values before create/update.  
  - Form uses the flat schema with react-hook-form; on submit, parent (or a helper) maps flat → nested and runs nested schema (e.g. `.parse()`) before calling the mutation.

- **B. Single nested schema + transform**  
  - One schema in shared that describes the **nested** API shape.  
  - Form still keeps flat state; on submit, build nested object and validate with that schema. No separate “form schema”; validation in the UI can be minimal (e.g. required name/type/currency) or duplicated from the nested schema’s field rules.  
  - Less duplication of rules but form validation is either loose or we duplicate rules.

**Recommendation:** **A**. Define in **packages/shared** (or a dedicated file re-exported from shared):

- Reusable **field/build block** schemas: e.g. `transferProfileSchema`, `cardProfileSchema`, `creditCardSettingsSchema`, `institutionIdSchema` (already partially in trpc).
- **Account API input schema** (nested): compose those blocks; use it in the **tRPC account router** as `.input()`.
- **Account form schema** (flat): same constraints (lengths, CLABE optional + valid if present, credit-card days 1–31 / 0–90 when type is credit_card); use with **react-hook-form** and `zodResolver`. On submit, map flat → nested and validate the result with the **API input schema** (and optionally type the mutation input from it).

That way backend and UI share the same rules and the same “source of truth” for the API shape.

### 2. What lives in shared

- **Already in shared:** `accountTypeSchema`, `currencySchema`, `clabeSchema` / `isValidClabe` / `normalizeClabe` / `parseClabe`.
- **Add (or move from trpc):**  
  - `transferProfileSchema`, `cardProfileSchema`, `creditCardSettingsSchema`, `institutionIdSchema` (and optionally `institutionCodeSchema` if you still need it).  
  - `accountInputSchema` (nested) built from the above.  
- **Add for the form:**  
  - `accountFormSchema` (flat): all form fields with the right types (string for numeric inputs if you keep them as strings), optional CLABE refined with existing CLABE helpers, conditional refinement for credit_card (statementDay, dueDay, graceDays).  
  - Export inferred TypeScript types from both schemas so the form and tRPC use them.

### 3. react-hook-form integration

- **AccountForm** becomes a presentational form that receives:
  - `control`, `formState: { errors }`, `register`, `setValue`, `watch` (or only what you need),
  - and callbacks: `onSubmit`, `onCancel`, `onChangeCardNumber` (for the non-stored card number field).
- Parent (**accounts.tsx**) owns `useForm` with:
  - `resolver: zodResolver(accountFormSchema)`,
  - `defaultValues`: from `emptyFormState` / from the selected account when editing.
- **Card number:** keep as a non-submitted field: parent still computes brand + last4 (e.g. with `card-validator`) and sets them via `setValue('cardBrand', ...)`, `setValue('cardLast4', ...)` when the user types. Form schema can omit `cardNumberInput` or treat it as optional; payload construction only uses brand + last4 (and optional cardProfile).
- **CLABE → institution:** keep the current effect that, when CLABE is valid and institution is empty, looks up institution and calls `setValue('institutionId', id)`. Same logic, but driven by `watch('clabe')` and form values.
- **Conditional validation:** in `accountFormSchema`, use `.superRefine()` or `.refine()`: when `type === 'credit_card'`, require statementDay/dueDay/graceDays in range; optionally same for “at least one of transfer profile fields” if you want that in Zod instead of in code.

### 4. Parent (accounts.tsx) responsibilities

- Create form with `useForm<AccountFormValues>({ resolver: zodResolver(accountFormSchema), defaultValues })`.
- On “Create”: `reset(emptyFormState)` (or schema default values).
- On “Edit”: `reset(accountToFormState(account))`.
- `onSubmit`: get `data` from the form; build nested payload (flat → transferProfile/cardProfile/creditCardSettings); run `accountInputSchema.parse(payload)` (or rely on tRPC to do it); call `createMutation.mutateAsync(payload)` or `updateMutation.mutateAsync({ id, data: payload })`.
- Pass form props and error messages (formError, createErrorMessage, updateErrorMessage) into AccountForm as today.

---

## Implementation steps (concise)

1. **Shared schemas (packages/shared)**  
   - Add (or move) transferProfile, cardProfile, creditCardSettings, institutionId (and if needed institutionCode) building blocks.  
   - Add `accountInputSchema` (nested).  
   - Add `accountFormSchema` (flat) with conditional refinements.  
   - Export types `AccountFormValues`, `AccountInput` (or similar).

2. **tRPC account router**  
   - Replace local schema definitions with imports from `@expense-management/shared` (or a single `accountInputSchema` export).  
   - Keep create/update logic; only change `.input(...)` to use the shared schema.

3. **AccountForm.tsx**  
   - Switch to react-hook-form: receive `control`, `errors`, `register`, `setValue`, `watch` (and any other needed props).  
   - Replace `formState`/`setFormState` with `register`/`control`/`watch`; show `errors` next to fields.  
   - Keep UI structure (sections, conditional card block, CLABE description, etc.).  
   - Keep `onChangeCardNumber` and optional info popover for card number.

4. **accounts.tsx**  
   - Add `useForm` with `zodResolver(accountFormSchema)`, default values, and reset on open create/edit.  
   - Implement submit handler: read form data, map to nested payload, validate with `accountInputSchema` (optional but good for typing), call mutations.  
   - Keep CLABE → institution effect using `watch('clabe')` and `setValue('institutionId', ...)`.  
   - Remove manual validation (name, CLABE, days); that’s now in the form schema.

5. **Dependencies**  
   - In apps/web: ensure `react-hook-form` and `@hookform/resolvers` (with zod) are installed.

6. **Cleanup**  
   - Remove `FormState` / `emptyFormState` from AccountForm (or keep only as a type/constant for default values if useful).  
   - Optionally delete or merge the duplicate `account-form.tsx` so only one form file (e.g. AccountForm.tsx) remains.

---

## Risks / caveats

- **Conditional schema:** Credit-card-only fields (statementDay, dueDay, graceDays) need a refinement so they’re only required when `type === 'credit_card'`. Straightforward in Zod; test create/edit for both credit and non-credit accounts.
- **Card number:** Never sent to the API; only brand + last4. Keep this as a “transient” field and keep using `card-validator` in the parent; no change to backend contract.
- **Institution vs CLABE:** Backend infers institution from CLABE when possible; the form’s effect that sets `institutionId` from CLABE stays in the parent, now using `watch`/`setValue` instead of `setFormState`.

---

## Summary

Confidence is **high**: the refactor is mostly mechanical once the two schemas (flat form + nested API) and their placement in shared are decided. Using react-hook-form + Zod in the form and the same (or derived) Zod for the API in both the UI and the backend will give you consistent validation and better type safety with limited risk.
