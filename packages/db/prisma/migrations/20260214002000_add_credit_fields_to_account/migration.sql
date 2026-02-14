-- Add credit-specific account fields in cents.
ALTER TABLE "Account"
ADD COLUMN "creditLimit" INTEGER,
ADD COLUMN "currentDebt" INTEGER;
