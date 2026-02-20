-- Transfer profile no longer stores free-text bank name.
-- Institution must be referenced through accounts.institution_id.
ALTER TABLE "account_transfer_profiles"
DROP COLUMN IF EXISTS "bank_name";
