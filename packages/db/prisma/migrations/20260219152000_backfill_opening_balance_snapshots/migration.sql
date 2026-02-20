-- Backfill opening balance snapshot for any account that has none yet.
INSERT INTO "account_balance_snapshots" (
  "id",
  "user_id",
  "account_id",
  "as_of_date",
  "balance",
  "source",
  "notes",
  "created_at"
)
SELECT
  gen_random_uuid()::text AS "id",
  a."user_id",
  a."id" AS "account_id",
  a."created_at" AS "as_of_date",
  a."current_balance" AS "balance",
  'manual'::"SnapshotSource" AS "source",
  'opening_balance_backfill' AS "notes",
  NOW() AS "created_at"
FROM "accounts" a
WHERE NOT EXISTS (
  SELECT 1
  FROM "account_balance_snapshots" s
  WHERE s."account_id" = a."id"
);
