-- Add optional visual metadata for categories
ALTER TABLE "categories"
ADD COLUMN IF NOT EXISTS "color" TEXT,
ADD COLUMN IF NOT EXISTS "icon" TEXT;
