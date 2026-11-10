-- First-touch attribution and "how did you hear about us" (nullable, no backfill).
ALTER TABLE "User" ADD COLUMN "signupSource" JSONB;
ALTER TABLE "User" ADD COLUMN "heardFrom" TEXT;
