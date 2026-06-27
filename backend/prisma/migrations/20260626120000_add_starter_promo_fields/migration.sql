-- BR Starter promo eligibility and tracking on workspace
ALTER TABLE "Workspace" ADD COLUMN "starterPromoEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN "starterPromoCode" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "promoPaymentsRemaining" INTEGER;
ALTER TABLE "Workspace" ADD COLUMN "promoRegularAmountBrl" INTEGER;
