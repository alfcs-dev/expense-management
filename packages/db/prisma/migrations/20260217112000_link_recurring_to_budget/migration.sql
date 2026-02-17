-- Add budget reference to recurring templates
ALTER TABLE "RecurringExpense"
  ADD COLUMN "budgetId" TEXT;

-- Ensure users with recurring templates always have at least one budget
INSERT INTO "Budget" (
  "id",
  "userId",
  "name",
  "startDate",
  "endDate",
  "isDefault",
  "currency",
  "budgetLimit",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('auto-', md5(random()::text || clock_timestamp()::text || u."userId")) AS "id",
  u."userId",
  'Auto Budget' AS "name",
  date_trunc('month', now())::timestamp AS "startDate",
  (date_trunc('month', now()) + INTERVAL '1 month' - INTERVAL '1 millisecond')::timestamp AS "endDate",
  true AS "isDefault",
  'MXN'::"Currency" AS "currency",
  0 AS "budgetLimit",
  now() AS "createdAt",
  now() AS "updatedAt"
FROM (
  SELECT DISTINCT "userId"
  FROM "RecurringExpense"
) u
LEFT JOIN "Budget" b
  ON b."userId" = u."userId"
WHERE b."id" IS NULL;

-- Backfill existing recurring templates to default budget (fallback first budget)
WITH chosen_budget AS (
  SELECT
    r."id" AS "recurringId",
    COALESCE(
      (
        SELECT b1."id"
        FROM "Budget" b1
        WHERE b1."userId" = r."userId"
          AND b1."isDefault" = true
        ORDER BY b1."createdAt" ASC
        LIMIT 1
      ),
      (
        SELECT b2."id"
        FROM "Budget" b2
        WHERE b2."userId" = r."userId"
        ORDER BY b2."createdAt" ASC
        LIMIT 1
      )
    ) AS "budgetId"
  FROM "RecurringExpense" r
)
UPDATE "RecurringExpense" r
SET "budgetId" = c."budgetId"
FROM chosen_budget c
WHERE r."id" = c."recurringId";

ALTER TABLE "RecurringExpense"
  ALTER COLUMN "budgetId" SET NOT NULL;

ALTER TABLE "RecurringExpense"
  ADD CONSTRAINT "RecurringExpense_budgetId_fkey"
  FOREIGN KEY ("budgetId") REFERENCES "Budget"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "RecurringExpense_budgetId_idx" ON "RecurringExpense"("budgetId");
