-- DropIndex (idempotent for shadow DB)
DROP INDEX IF EXISTS "InstitutionCatalog_bankCode_isActive_idx";

-- DropIndex (idempotent for shadow DB)
DROP INDEX IF EXISTS "InstitutionCatalog_name_idx";

-- AlterTable (idempotent for shadow DB / branch ordering)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Budget'
      AND column_name = 'currency'
  ) THEN
    ALTER TABLE "Budget" ALTER COLUMN "currency" DROP DEFAULT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Budget'
      AND column_name = 'budgetLimit'
  ) THEN
    ALTER TABLE "Budget" ALTER COLUMN "budgetLimit" DROP DEFAULT;
  END IF;
END $$;
