-- Add account-level current balance cache and credit-card limit metadata.
ALTER TABLE "accounts"
ADD COLUMN IF NOT EXISTS "current_balance" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "credit_card_settings"
ADD COLUMN IF NOT EXISTS "credit_limit" INTEGER;
