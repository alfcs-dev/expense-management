# API Testing (Core Flow)

This project uses Fastify + tRPC + Better Auth. The fastest direct API testing path for current core scope is Postman.

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

## 3. Run the core lifecycle

Run requests in this order:

1. `Health`
2. `Auth > Sign Up (email)` (or `Sign In` if user already exists)
3. `Auth > Get Session`
4. `Core tRPC > Category Create`
5. `Core tRPC > Account Create (cash)`
6. `Core tRPC > Budget Create`
7. `Core tRPC > Recurring Expense Create`
8. `Core tRPC > Expense Create (manual)`
9. `Core tRPC > Expense List By Budget`
10. `Core tRPC > Budget Planned By Category`

The collection stores IDs into environment variables (`category_id`, `account_id`, `budget_id`, etc.).

## 4. Auth/session handling

- `Sign Up` and `Sign In` requests capture `Set-Cookie` and save `session_cookie`.
- tRPC requests send `Cookie: {{session_cookie}}`.
- If authentication fails, re-run `Sign In` and `Get Session`.

## 5. Notes about tRPC payloads

Requests use the tRPC HTTP shape:

```json
{
  "json": {
    "...": "input payload"
  }
}
```

Endpoint format:

- `POST /api/trpc/<router>.<procedure>`

Examples:

- `POST /api/trpc/budget.create`
- `POST /api/trpc/expense.list`

## 6. Common issues

- `UNAUTHORIZED`: session cookie missing/expired; run `Sign In` again.
- `CONFLICT` on `budget.create`: budget for `month/year` already exists; change environment `month/year` or call `budget.getOrCreateForMonth` from app UI.
- Validation errors: verify required environment variables are populated from previous requests.
