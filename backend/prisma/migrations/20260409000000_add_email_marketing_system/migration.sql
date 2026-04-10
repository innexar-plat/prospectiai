-- CreateEnum
CREATE TYPE "EmailTemplateType" AS ENUM ('PROMOTION', 'WEEKLY_REPORT', 'FEATURE_ANNOUNCEMENT', 'REENGAGEMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EmailTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailCampaignAudience" AS ENUM ('ALL', 'FREE', 'PAID', 'TRIAL', 'CHURNED', 'INACTIVE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EmailSendStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "EmailSendType" AS ENUM ('TRANSACTIONAL', 'CAMPAIGN', 'WEEKLY_REPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EmailUnsubscribeCategory" AS ENUM ('ALL', 'MARKETING', 'WEEKLY_REPORT', 'PROMOTIONS');

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "EmailTemplateType" NOT NULL DEFAULT 'CUSTOM',
    "status" "EmailTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "body" JSONB NOT NULL,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "accentColor" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "audience" "EmailCampaignAudience" NOT NULL DEFAULT 'ALL',
    "audienceFilter" JSONB,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "EmailCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSendLog" (
    "id" TEXT NOT NULL,
    "type" "EmailSendType" NOT NULL DEFAULT 'TRANSACTIONAL',
    "campaignId" TEXT,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'SENT',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSendLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailUnsubscribe" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "category" "EmailUnsubscribeCategory" NOT NULL DEFAULT 'ALL',
    "token" TEXT NOT NULL,
    "unsubscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailUnsubscribe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReportConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "customTitle" TEXT,
    "customHighlight" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "footerPromo" TEXT,
    "sendDay" INTEGER NOT NULL DEFAULT 1,
    "sendHour" INTEGER NOT NULL DEFAULT 9,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReportConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_slug_key" ON "EmailTemplate"("slug");
CREATE INDEX "EmailTemplate_type_idx" ON "EmailTemplate"("type");
CREATE INDEX "EmailTemplate_status_idx" ON "EmailTemplate"("status");

-- CreateIndex
CREATE INDEX "EmailCampaign_status_idx" ON "EmailCampaign"("status");
CREATE INDEX "EmailCampaign_scheduledAt_idx" ON "EmailCampaign"("scheduledAt");
CREATE INDEX "EmailCampaign_templateId_idx" ON "EmailCampaign"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailCampaignRecipient_campaignId_userId_key" ON "EmailCampaignRecipient"("campaignId", "userId");
CREATE INDEX "EmailCampaignRecipient_campaignId_status_idx" ON "EmailCampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE INDEX "EmailSendLog_type_idx" ON "EmailSendLog"("type");
CREATE INDEX "EmailSendLog_campaignId_idx" ON "EmailSendLog"("campaignId");
CREATE INDEX "EmailSendLog_userId_idx" ON "EmailSendLog"("userId");
CREATE INDEX "EmailSendLog_email_idx" ON "EmailSendLog"("email");
CREATE INDEX "EmailSendLog_createdAt_idx" ON "EmailSendLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailUnsubscribe_token_key" ON "EmailUnsubscribe"("token");
CREATE UNIQUE INDEX "EmailUnsubscribe_email_category_key" ON "EmailUnsubscribe"("email", "category");
CREATE INDEX "EmailUnsubscribe_email_idx" ON "EmailUnsubscribe"("email");
CREATE INDEX "EmailUnsubscribe_userId_idx" ON "EmailUnsubscribe"("userId");

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignRecipient" ADD CONSTRAINT "EmailCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
