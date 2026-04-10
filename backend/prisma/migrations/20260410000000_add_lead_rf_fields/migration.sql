-- AlterTable: add RF enrichment fields to Lead
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "companyPorte" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "companyCapitalSocial" DOUBLE PRECISION;

-- CreateIndex: add index on cnpj for fast lookups during RF enrichment
CREATE INDEX IF NOT EXISTS "Lead_cnpj_idx" ON "Lead"("cnpj");
