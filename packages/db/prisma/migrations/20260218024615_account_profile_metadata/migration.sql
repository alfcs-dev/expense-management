-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "institution_code" TEXT;

-- CreateTable
CREATE TABLE "account_card_profiles" (
    "account_id" TEXT NOT NULL,
    "brand" TEXT,
    "last4" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_card_profiles_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "institution_catalog" (
    "code" TEXT NOT NULL,
    "bank_code" TEXT,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_catalog_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "institution_catalog_is_active_idx" ON "institution_catalog"("is_active");

-- CreateIndex
CREATE INDEX "institution_catalog_bank_code_idx" ON "institution_catalog"("bank_code");

-- CreateIndex
CREATE INDEX "accounts_institution_code_idx" ON "accounts"("institution_code");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_institution_code_fkey" FOREIGN KEY ("institution_code") REFERENCES "institution_catalog"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_card_profiles" ADD CONSTRAINT "account_card_profiles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
