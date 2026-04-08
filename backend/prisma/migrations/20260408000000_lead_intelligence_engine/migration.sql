-- Lead Intelligence Engine: conversion tracking fields on LeadAnalysis
ALTER TABLE "LeadAnalysis" ADD COLUMN "closeProbability" INTEGER;
ALTER TABLE "LeadAnalysis" ADD COLUMN "estimatedDealValue" DOUBLE PRECISION;
ALTER TABLE "LeadAnalysis" ADD COLUMN "bestContactWindow" TEXT;
ALTER TABLE "LeadAnalysis" ADD COLUMN "conversionReason" TEXT;
ALTER TABLE "LeadAnalysis" ADD COLUMN "dealValue" DOUBLE PRECISION;
ALTER TABLE "LeadAnalysis" ADD COLUMN "lostReason" TEXT;
ALTER TABLE "LeadAnalysis" ADD COLUMN "contactedAt" TIMESTAMP(3);
ALTER TABLE "LeadAnalysis" ADD COLUMN "convertedAt" TIMESTAMP(3);
ALTER TABLE "LeadAnalysis" ADD COLUMN "lostAt" TIMESTAMP(3);

-- LeadEvent: full event history for every lead interaction
CREATE TYPE "LeadEventType" AS ENUM ('STATUS_CHANGE', 'SCORE_CHANGE', 'AI_ANALYSIS', 'NOTE', 'TAG_ADDED', 'TAG_REMOVED', 'CRM_SYNCED', 'CONTACTED', 'CONVERTED', 'LOST');

CREATE TABLE "LeadEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "type" "LeadEventType" NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadEvent_leadId_idx" ON "LeadEvent"("leadId");
CREATE INDEX "LeadEvent_userId_idx" ON "LeadEvent"("userId");
CREATE INDEX "LeadEvent_workspaceId_idx" ON "LeadEvent"("workspaceId");
CREATE INDEX "LeadEvent_type_idx" ON "LeadEvent"("type");
CREATE INDEX "LeadEvent_createdAt_idx" ON "LeadEvent"("createdAt");

-- PipelineBrief: cached daily AI-powered pipeline recommendations
CREATE TABLE "PipelineBrief" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "briefDate" DATE NOT NULL,
    "recommendations" JSONB NOT NULL,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineBrief_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PipelineBrief_workspaceId_briefDate_key" ON "PipelineBrief"("workspaceId", "briefDate");
CREATE INDEX "PipelineBrief_userId_idx" ON "PipelineBrief"("userId");
CREATE INDEX "PipelineBrief_workspaceId_idx" ON "PipelineBrief"("workspaceId");
