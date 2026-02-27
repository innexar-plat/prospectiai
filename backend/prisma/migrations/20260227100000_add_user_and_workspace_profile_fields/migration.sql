-- Add personal profile fields to User
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "address" TEXT;
ALTER TABLE "User" ADD COLUMN "linkedInUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "websiteUrl" TEXT;

-- Add extended profile fields to Workspace
ALTER TABLE "Workspace" ADD COLUMN "address" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "linkedInUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "websiteUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "logoUrl" TEXT;
