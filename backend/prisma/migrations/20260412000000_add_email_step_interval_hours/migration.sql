-- AlterTable
ALTER TABLE "AutoProspeccaoConfig" ADD COLUMN IF NOT EXISTS "emailStepIntervalHours" INTEGER NOT NULL DEFAULT 48;
