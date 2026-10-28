-- Monthly credit cycle + recurring PIX renewal charge
ALTER TABLE "Workspace" ADD COLUMN "creditsResetAt" TIMESTAMP(3);
ALTER TABLE "Workspace" ADD COLUMN "renewalPaymentId" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "renewalPaymentUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "renewalPaymentQrCode" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "renewalPaymentExpiresAt" TIMESTAMP(3);

-- Persist the full AI lead analysis (message variants, quick actions, key metrics, review analysis)
ALTER TABLE "LeadAnalysis" ADD COLUMN "extras" JSONB;
