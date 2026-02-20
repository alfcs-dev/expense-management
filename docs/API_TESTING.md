# API Testing (Transactions-First Core)

This project uses Fastify + tRPC + Better Auth. The fastest direct API testing path is Postman.

## Files

- `tools/postman/ExpenseManager.postman_collection.json`
- `tools/postman/ExpenseManager.local.postman_environment.json`

## 1. Start services

From repo root:

```bash
pnpm dev:all
```

Verify health endpoint:

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{"status":"ok"}
```

## 2. Import Postman assets

1. Import `ExpenseManager.postman_collection.json`.
2. Import `ExpenseManager.local.postman_environment.json`.
3. Select the environment in Postman.

## 3. Run the baseline lifecycle

1. `Health`
2. `Auth > Sign Up (email)` (or `Sign In`)
3. `Auth > Get Session`
4. `Core tRPC > Category Create`
5. `Core tRPC > Account Create (cash)`

## 4. Run Finance V2 lifecycle

Use requests in `Finance V2 tRPC` folder:

1. `Budget Period Create`
2. `Income Plan Item Create`
3. `Budget Rule Create (fixed)`
4. `Budget Rule Create (percent)`
5. `Budget Allocation Generate For Period`
6. `Budget Allocation List`
7. `Budget Allocation Set Override`

Environment variables are populated automatically for:
- `budget_period_id`
- `budget_rule_id`
- `income_plan_item_id`

## 5. Account metadata (CLABE + institution + card profile)

Use requests in `Core tRPC`:

1. `Institution Catalog List`
2. `Account Create (debit + transfer profile)`
3. `Account Create (credit card metadata)`

These requests validate the current account UX contract:
- CLABE normalization + checksum validation
- institution lookup compatibility (`institutionId` storage, optional legacy `institutionCode` input)
- optional card brand/last4 metadata
- required credit card cycle settings for `credit_card` type

## 6. Transaction / statement / installment checks

Use direct tRPC calls (or extend collection):

- `transaction.create`
- `transaction.list`
- `creditCardStatement.close`
- `creditCardStatement.recordPayment`
- `installment.generateSchedule`
- `installment.progress`

Note: `expense.*` is currently an alias to `transaction.*` during transition.
`recurringExpense.*` is intentionally deprecated after cutover.

## 7. Auth/session handling

- `Sign Up` and `Sign In` capture `Set-Cookie` into `session_cookie`.
- tRPC requests send `Cookie: {{session_cookie}}`.
- If auth fails, re-run `Sign In` and `Get Session`.

## 8. tRPC payload format

- Mutations: `POST /api/trpc/<router>.<procedure>` with JSON body input
- Queries: `GET /api/trpc/<router>.<procedure>?input=<url-encoded-json>`

Examples:

- `POST /api/trpc/transaction.create`
- `GET /api/trpc/transaction.list?input=%7B%7D`
- `POST /api/trpc/budgetAllocation.generateForPeriod`

## 9. Common issues

- `UNAUTHORIZED`: session cookie missing/expired.
- `NOT_FOUND`: stale IDs in environment variables.
- Validation errors: verify required IDs (`account_id`, `category_id`, `budget_period_id`) are set.
- `Institution not found`: run `pnpm --filter @expense-management/db sync:institutions` to populate `institution_catalog`.
- If tRPC path errors appear in dev, restart watchers with `pnpm dev`.
