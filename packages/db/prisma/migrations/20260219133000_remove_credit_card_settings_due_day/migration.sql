-- Credit card settings now only store statement_day + grace_days.
-- due_date is calculated when a statement is created and stored on credit_card_statements.
ALTER TABLE "credit_card_settings"
DROP COLUMN IF EXISTS "due_day";
