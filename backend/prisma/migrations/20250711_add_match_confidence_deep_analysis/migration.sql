-- AlterTable: Add match confidence and deep analysis columns
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "matchConfidence" INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "matchMethod" TEXT;
ALTER TABLE "LeadAnalysis" ADD COLUMN IF NOT EXISTS "reclameAquiAnalysis" TEXT;
ALTER TABLE "LeadAnalysis" ADD COLUMN IF NOT EXISTS "jusBrasilAnalysis" TEXT;
ALTER TABLE "LeadAnalysis" ADD COLUMN IF NOT EXISTS "cnpjAnalysis" TEXT;
ALTER TABLE "LeadAnalysis" ADD COLUMN IF NOT EXISTS "reviewTrend" TEXT;
ALTER TABLE "LeadAnalysis" ADD COLUMN IF NOT EXISTS "suggestedContactTime" TEXT;
