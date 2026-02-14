CREATE TABLE "CategoryMapping" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "pattern" TEXT NOT NULL,
  "matchType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CategoryMapping_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CategoryMapping_userId_idx" ON "CategoryMapping"("userId");
CREATE INDEX "CategoryMapping_categoryId_idx" ON "CategoryMapping"("categoryId");

ALTER TABLE "CategoryMapping"
  ADD CONSTRAINT "CategoryMapping_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CategoryMapping"
  ADD CONSTRAINT "CategoryMapping_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
