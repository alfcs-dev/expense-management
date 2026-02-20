-- Phase 3 core E2E: transaction paid status + bill occurrences
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BillOccurrenceStatus') THEN
    CREATE TYPE "BillOccurrenceStatus" AS ENUM ('pending', 'paid', 'skipped', 'overdue');
  END IF;
END
$$;

ALTER TABLE "transactions"
ADD COLUMN IF NOT EXISTS "is_paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "transactions_user_id_is_paid_date_idx"
ON "transactions"("user_id", "is_paid", "date");

CREATE TABLE IF NOT EXISTS "bill_occurrences" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "bill_id" TEXT NOT NULL,
  "period_month" TEXT NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL,
  "expected_amount" INTEGER NOT NULL,
  "status" "BillOccurrenceStatus" NOT NULL DEFAULT 'pending',
  "paid_at" TIMESTAMP(3),
  "transaction_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bill_occurrences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bill_occurrences_bill_id_period_month_key"
ON "bill_occurrences"("bill_id", "period_month");

CREATE INDEX IF NOT EXISTS "bill_occurrences_user_id_period_month_idx"
ON "bill_occurrences"("user_id", "period_month");

CREATE INDEX IF NOT EXISTS "bill_occurrences_user_id_status_due_date_idx"
ON "bill_occurrences"("user_id", "status", "due_date");

CREATE INDEX IF NOT EXISTS "bill_occurrences_transaction_id_idx"
ON "bill_occurrences"("transaction_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bill_occurrences_user_id_fkey'
  ) THEN
    ALTER TABLE "bill_occurrences"
      ADD CONSTRAINT "bill_occurrences_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bill_occurrences_bill_id_fkey'
  ) THEN
    ALTER TABLE "bill_occurrences"
      ADD CONSTRAINT "bill_occurrences_bill_id_fkey"
      FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bill_occurrences_transaction_id_fkey'
  ) THEN
    ALTER TABLE "bill_occurrences"
      ADD CONSTRAINT "bill_occurrences_transaction_id_fkey"
      FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
