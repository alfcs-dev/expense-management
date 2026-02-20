/*
  Warnings:

  - The values [checking] on the enum `AccountType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AccountType_new" AS ENUM ('debit', 'savings', 'investment', 'credit_card', 'credit', 'cash');
ALTER TABLE "accounts"
ALTER COLUMN "type"
TYPE "AccountType_new"
USING (
  CASE
    WHEN "type"::text = 'checking' THEN 'debit'::"AccountType_new"
    ELSE "type"::text::"AccountType_new"
  END
);
ALTER TYPE "AccountType" RENAME TO "AccountType_old";
ALTER TYPE "AccountType_new" RENAME TO "AccountType";
DROP TYPE "public"."AccountType_old";
COMMIT;
