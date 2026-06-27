-- Track BR trial reactivation promo email sends per workspace (avoid duplicate campaigns).
ALTER TABLE "Workspace" ADD COLUMN "reactivationPromoSentAt" TIMESTAMP(3);
