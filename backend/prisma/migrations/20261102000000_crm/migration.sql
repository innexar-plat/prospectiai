-- CRM: pipelines, stages, deals and activities per workspace
CREATE TYPE "CrmStageKind" AS ENUM ('OPEN', 'WON', 'LOST');
CREATE TYPE "CrmActivityType" AS ENUM ('NOTE', 'CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'TASK', 'STAGE_CHANGE');

CREATE TABLE "CrmPipeline" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmPipeline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmStage" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "probability" INTEGER NOT NULL DEFAULT 10,
    "kind" "CrmStageKind" NOT NULL DEFAULT 'OPEN',
    "color" TEXT NOT NULL DEFAULT 'violet',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmDeal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedCloseAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "leadAnalysisId" TEXT,
    "companyName" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lostReason" TEXT,
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmDeal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "type" "CrmActivityType" NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "dueAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmPipeline_workspaceId_idx" ON "CrmPipeline"("workspaceId");
CREATE INDEX "CrmStage_pipelineId_position_idx" ON "CrmStage"("pipelineId", "position");
CREATE INDEX "CrmDeal_workspaceId_pipelineId_stageId_idx" ON "CrmDeal"("workspaceId", "pipelineId", "stageId");
CREATE INDEX "CrmDeal_workspaceId_ownerUserId_idx" ON "CrmDeal"("workspaceId", "ownerUserId");
CREATE INDEX "CrmDeal_leadAnalysisId_idx" ON "CrmDeal"("leadAnalysisId");
CREATE INDEX "CrmActivity_dealId_createdAt_idx" ON "CrmActivity"("dealId", "createdAt");
CREATE INDEX "CrmActivity_workspaceId_dueAt_idx" ON "CrmActivity"("workspaceId", "dueAt");

ALTER TABLE "CrmPipeline" ADD CONSTRAINT "CrmPipeline_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmStage" ADD CONSTRAINT "CrmStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "CrmPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "CrmPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "CrmStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
