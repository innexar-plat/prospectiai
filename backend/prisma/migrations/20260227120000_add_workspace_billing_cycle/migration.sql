-- Add billingCycle to Workspace for proration (monthly vs annual).
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "billingCycle" TEXT;
