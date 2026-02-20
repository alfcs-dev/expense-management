CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE "accounts" DROP CONSTRAINT "accounts_institution_code_fkey";
DROP INDEX "accounts_institution_code_idx";
DROP INDEX "institution_catalog_bank_code_idx";

ALTER TABLE "accounts" ADD COLUMN "institution_id" UUID;
ALTER TABLE "institution_catalog" ADD COLUMN "id" UUID;

UPDATE "institution_catalog"
SET "id" = gen_random_uuid()
WHERE "id" IS NULL;

UPDATE "accounts" AS "a"
SET "institution_id" = "i"."id"
FROM "institution_catalog" AS "i"
WHERE "a"."institution_code" = "i"."code";

ALTER TABLE "institution_catalog"
  DROP CONSTRAINT "institution_catalog_pkey",
  ALTER COLUMN "code" DROP NOT NULL,
  ALTER COLUMN "id" SET NOT NULL,
  ADD CONSTRAINT "institution_catalog_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "institution_catalog_code_key" ON "institution_catalog"("code");
CREATE UNIQUE INDEX "institution_catalog_bank_code_key" ON "institution_catalog"("bank_code");
CREATE INDEX "accounts_institution_id_idx" ON "accounts"("institution_id");

ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_institution_id_fkey"
  FOREIGN KEY ("institution_id")
  REFERENCES "institution_catalog"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "accounts" DROP COLUMN "institution_code";
