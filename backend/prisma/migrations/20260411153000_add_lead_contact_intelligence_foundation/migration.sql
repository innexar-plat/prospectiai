-- Contact Intelligence foundation

-- Enums
CREATE TYPE "LeadContactType" AS ENUM ('PHONE', 'EMAIL', 'WEBSITE');
CREATE TYPE "LeadContactSource" AS ENUM ('GOOGLE', 'RECEITA', 'WEBSITE_SCRAPER', 'WEB_SEARCH', 'MANUAL');
CREATE TYPE "LeadContactRoleHint" AS ENUM ('OWNER', 'COMMERCIAL', 'CENTRAL', 'ACCOUNTANT', 'UNKNOWN');

-- Lead snapshot fields for fast reads and backward compatibility
ALTER TABLE "Lead"
  ADD COLUMN "recommendedPhone" TEXT,
  ADD COLUMN "recommendedEmail" TEXT,
  ADD COLUMN "recommendedWebsite" TEXT,
  ADD COLUMN "contactsHealthScore" INTEGER;

-- Contact records per source/value
CREATE TABLE "LeadContact" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "type" "LeadContactType" NOT NULL,
  "source" "LeadContactSource" NOT NULL,
  "roleHint" "LeadContactRoleHint" NOT NULL DEFAULT 'UNKNOWN',
  "valueRaw" TEXT NOT NULL,
  "valueNormalized" TEXT NOT NULL,
  "confidenceScore" INTEGER,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "evidence" JSONB,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadContact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadContact_leadId_type_valueNormalized_source_key"
  ON "LeadContact"("leadId", "type", "valueNormalized", "source");

CREATE INDEX "LeadContact_leadId_idx" ON "LeadContact"("leadId");
CREATE INDEX "LeadContact_type_idx" ON "LeadContact"("type");
CREATE INDEX "LeadContact_valueNormalized_idx" ON "LeadContact"("valueNormalized");
CREATE INDEX "LeadContact_source_idx" ON "LeadContact"("source");

ALTER TABLE "LeadContact"
  ADD CONSTRAINT "LeadContact_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
