CREATE TABLE "InstitutionCatalog" (
  "code" TEXT NOT NULL,
  "bankCode" TEXT,
  "name" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InstitutionCatalog_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "InstitutionCatalog_bankCode_isActive_idx" ON "InstitutionCatalog"("bankCode", "isActive");
CREATE INDEX "InstitutionCatalog_name_idx" ON "InstitutionCatalog"("name");
