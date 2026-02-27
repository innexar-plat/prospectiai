-- AlterTable: Downgrade scheduled for end of period — plan to apply at pendingPlanEffectiveAt
ALTER TABLE "Workspace" ADD COLUMN "pendingPlanId" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "pendingPlanEffectiveAt" TIMESTAMP(3);
