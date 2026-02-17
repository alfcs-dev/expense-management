-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('none', 'estimated', 'confirmed');

-- AlterTable Budget
ALTER TABLE "Budget"
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "endDate" TIMESTAMP(3),
  ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'MXN',
  ADD COLUMN "budgetLimit" INTEGER NOT NULL DEFAULT 0;

UPDATE "Budget"
SET "name" = COALESCE(
  NULLIF(TRIM("name"), ''),
  CONCAT("year", '-', LPAD("month"::text, 2, '0'))
);

UPDATE "Budget"
SET "startDate" = make_date("year", "month", 1)::timestamp,
    "endDate" = (make_date("year", "month", 1) + INTERVAL '1 month' - INTERVAL '1 day')::timestamp
WHERE "startDate" IS NULL OR "endDate" IS NULL;

ALTER TABLE "Budget"
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "startDate" SET NOT NULL,
  ALTER COLUMN "endDate" SET NOT NULL;

DROP INDEX IF EXISTS "Budget_userId_month_year_key";

ALTER TABLE "Budget"
  DROP COLUMN "month",
  DROP COLUMN "year";

CREATE INDEX "Budget_userId_startDate_endDate_idx" ON "Budget"("userId", "startDate", "endDate");
CREATE INDEX "Budget_userId_isDefault_idx" ON "Budget"("userId", "isDefault");
CREATE UNIQUE INDEX "Budget_single_default_per_user_idx"
ON "Budget"("userId")
WHERE "isDefault" = true;

WITH ranked AS (
  SELECT
    id,
    "userId",
    ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "startDate" ASC, "createdAt" ASC) AS rank_in_user
  FROM "Budget"
)
UPDATE "Budget" b
SET "isDefault" = true
FROM ranked r
WHERE b.id = r.id
  AND r.rank_in_user = 1;

-- AlterTable Expense
ALTER TABLE "Expense"
  ADD COLUMN "amountInBudgetCurrency" INTEGER,
  ADD COLUMN "conversionStatus" "ConversionStatus" NOT NULL DEFAULT 'none';

UPDATE "Expense"
SET "amountInBudgetCurrency" = "amount",
    "conversionStatus" = 'confirmed'
FROM "Budget"
WHERE "Expense"."budgetId" = "Budget"."id"
  AND "Expense"."currency" = "Budget"."currency";

UPDATE "Expense"
SET "conversionStatus" = 'estimated'
WHERE "amountInBudgetCurrency" IS NULL;
