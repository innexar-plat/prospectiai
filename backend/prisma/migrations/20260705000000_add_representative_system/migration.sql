-- CreateEnum
CREATE TYPE "RepLevel" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "RepStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RepCommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RepCommissionSource" AS ENUM ('DIRECT_CLIENT', 'AFFILIATE_OVERRIDE');

-- CreateEnum
CREATE TYPE "PayoutType" AS ENUM ('PIX', 'BANK_TRANSFER');

-- AlterEnum (adicionar ao Affiliate existente)
ALTER TYPE "AffiliateCommissionStatus" ADD VALUE IF NOT EXISTS 'APPROVED';

-- AlterTable: Adicionar representativeId no Affiliate
ALTER TABLE "Affiliate" ADD COLUMN "representativeId" TEXT;

-- CreateTable: Representative
CREATE TABLE "Representative" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "document" TEXT,
    "level" "RepLevel" NOT NULL DEFAULT 'BRONZE',
    "directCommissionPct" DECIMAL(65,30) NOT NULL DEFAULT 20,
    "affiliateOverridePct" DECIMAL(65,30) NOT NULL DEFAULT 5,
    "commissionHoldDays" INTEGER NOT NULL DEFAULT 30,
    "creditLimit" INTEGER NOT NULL DEFAULT 500,
    "payoutType" "PayoutType",
    "payoutPayload" TEXT,
    "minPayoutCents" INTEGER NOT NULL DEFAULT 10000,
    "monthlyGoalCents" INTEGER,
    "region" TEXT,
    "contractUrl" TEXT,
    "notes" TEXT,
    "status" "RepStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastActivityAt" TIMESTAMP(3),
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Representative_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RepClient
CREATE TABLE "RepClient" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "planId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LEAD',
    "valueCents" INTEGER,
    "signedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RepCommission
CREATE TABLE "RepCommission" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "source" "RepCommissionSource" NOT NULL DEFAULT 'DIRECT_CLIENT',
    "repClientId" TEXT,
    "affiliateId" TEXT,
    "affiliateCommissionId" TEXT,
    "orderId" TEXT,
    "subscriptionId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "commissionPercent" DECIMAL(65,30) NOT NULL,
    "status" "RepCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "holdUntil" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidByAdminId" TEXT,
    "paymentProofUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RepGoal
CREATE TABLE "RepGoal" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "targetCents" INTEGER NOT NULL,
    "achievedCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RepLevelConfig
CREATE TABLE "RepLevelConfig" (
    "id" TEXT NOT NULL,
    "level" "RepLevel" NOT NULL,
    "directCommissionPct" DECIMAL(65,30) NOT NULL DEFAULT 20,
    "affiliateOverridePct" DECIMAL(65,30) NOT NULL DEFAULT 5,
    "creditLimit" INTEGER NOT NULL DEFAULT 500,
    "minPayoutCents" INTEGER NOT NULL DEFAULT 10000,
    "monthlyGoalCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepLevelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes: Representative
CREATE UNIQUE INDEX "Representative_userId_key" ON "Representative"("userId");
CREATE UNIQUE INDEX "Representative_workspaceId_key" ON "Representative"("workspaceId");
CREATE UNIQUE INDEX "Representative_email_key" ON "Representative"("email");
CREATE INDEX "Representative_status_idx" ON "Representative"("status");
CREATE INDEX "Representative_level_idx" ON "Representative"("level");

-- CreateIndexes: RepClient
CREATE INDEX "RepClient_representativeId_idx" ON "RepClient"("representativeId");
CREATE INDEX "RepClient_status_idx" ON "RepClient"("status");

-- CreateIndexes: RepCommission
CREATE INDEX "RepCommission_representativeId_idx" ON "RepCommission"("representativeId");
CREATE INDEX "RepCommission_status_idx" ON "RepCommission"("status");
CREATE INDEX "RepCommission_holdUntil_idx" ON "RepCommission"("holdUntil");

-- CreateIndexes: RepGoal
CREATE UNIQUE INDEX "RepGoal_representativeId_month_year_key" ON "RepGoal"("representativeId", "month", "year");

-- CreateIndexes: RepLevelConfig
CREATE UNIQUE INDEX "RepLevelConfig_level_key" ON "RepLevelConfig"("level");

-- CreateIndexes: Affiliate (novo)
CREATE INDEX "Affiliate_representativeId_idx" ON "Affiliate"("representativeId");

-- AddForeignKeys: Representative
ALTER TABLE "Representative" ADD CONSTRAINT "Representative_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Representative" ADD CONSTRAINT "Representative_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKeys: RepClient
ALTER TABLE "RepClient" ADD CONSTRAINT "RepClient_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKeys: RepCommission
ALTER TABLE "RepCommission" ADD CONSTRAINT "RepCommission_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepCommission" ADD CONSTRAINT "RepCommission_repClientId_fkey" FOREIGN KEY ("repClientId") REFERENCES "RepClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKeys: RepGoal
ALTER TABLE "RepGoal" ADD CONSTRAINT "RepGoal_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKeys: Affiliate
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert default RepLevelConfig rows
INSERT INTO "RepLevelConfig" ("id", "level", "directCommissionPct", "affiliateOverridePct", "creditLimit", "minPayoutCents", "monthlyGoalCents", "createdAt", "updatedAt") VALUES
    (gen_random_uuid()::text, 'BRONZE', 15, 3, 500, 10000, 500000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'SILVER', 20, 5, 1000, 10000, 1000000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'GOLD', 25, 7, 2000, 10000, 2000000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'PLATINUM', 30, 10, 5000, 5000, 4000000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
