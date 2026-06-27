-- AlterTable: add autoProspeccaoEnabled to Workspace
ALTER TABLE "Workspace" ADD COLUMN "autoProspeccaoEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: add autoProspeccaoEnabled to WorkspaceMember
ALTER TABLE "WorkspaceMember" ADD COLUMN "autoProspeccaoEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum: ProspectedLeadStatus
CREATE TYPE "ProspectedLeadStatus" AS ENUM ('NEW', 'ANALYZING', 'SCORED', 'COLD', 'WARM', 'HOT', 'EMAILING', 'CRM_SENT', 'ENGAGED', 'CONVERTED', 'BOUNCED', 'OPTED_OUT');

-- CreateEnum: AutoProspTemplateType
CREATE TYPE "AutoProspTemplateType" AS ENUM ('HOT_COLD_INTRO', 'HOT_FOLLOW_NO_OPEN', 'HOT_FOLLOW_OPENED', 'HOT_LAST_ATTEMPT', 'WARM_WEEK1_EDUCATION', 'WARM_WEEK2_VALUE', 'WARM_WEEK3_SOCIAL', 'WARM_WEEK4_OFFER', 'CUSTOM');

-- CreateEnum: AutoProspRunStatus
CREATE TYPE "AutoProspRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable: AutoProspeccaoConfig
CREATE TABLE "AutoProspeccaoConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "scheduleDays" JSONB NOT NULL DEFAULT '[1,2,3,4,5]',
    "scheduleTimeStart" TEXT NOT NULL DEFAULT '08:00',
    "scheduleTimeEnd" TEXT NOT NULL DEFAULT '20:00',
    "searchIntervalHours" INTEGER NOT NULL DEFAULT 24,
    "analyzeDelayMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxLeadsPerRun" INTEGER NOT NULL DEFAULT 50,
    "maxEmailsPerDay" INTEGER NOT NULL DEFAULT 200,
    "maxCrmPushPerDay" INTEGER NOT NULL DEFAULT 100,
    "hotScoreMin" INTEGER NOT NULL DEFAULT 70,
    "warmScoreMin" INTEGER NOT NULL DEFAULT 40,
    "crmAutoSend" BOOLEAN NOT NULL DEFAULT false,
    "crmProvider" TEXT,
    "crmOwnerUserId" TEXT,
    "emailAutoSend" BOOLEAN NOT NULL DEFAULT true,
    "defaultSequenceId" TEXT,
    "blockedCnpjs" JSONB NOT NULL DEFAULT '[]',
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoProspeccaoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SearchProfile
CREATE TABLE "SearchProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "cnae" TEXT,
    "cnaeList" JSONB,
    "uf" JSONB,
    "municipio" TEXT,
    "porte" JSONB,
    "hasEmail" BOOLEAN,
    "hasPhone" BOOLEAN,
    "minCapital" DOUBLE PRECISION,
    "openedAfter" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "totalFound" INTEGER NOT NULL DEFAULT 0,
    "totalHot" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProspectedLead
CREATE TABLE "ProspectedLead" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "searchProfileId" TEXT NOT NULL,
    "cnpj" VARCHAR(14) NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "email" TEXT,
    "ddd" TEXT,
    "telefone" TEXT,
    "cnaePrincipal" TEXT,
    "uf" TEXT,
    "municipio" TEXT,
    "porte" TEXT,
    "score" INTEGER,
    "status" "ProspectedLeadStatus" NOT NULL DEFAULT 'NEW',
    "aiAnalysisSummary" TEXT,
    "aiScoreFactors" JSONB,
    "crmProvider" TEXT,
    "crmId" TEXT,
    "crmPushedAt" TIMESTAMP(3),
    "emailSequenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectedLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProspectedLeadEmailEvent
CREATE TABLE "ProspectedLeadEmailEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "templateId" TEXT,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),

    CONSTRAINT "ProspectedLeadEmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AutoProspeccaoTemplate
CREATE TABLE "AutoProspeccaoTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AutoProspTemplateType" NOT NULL,
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "variables" JSONB,
    "targetCnae" TEXT,
    "targetSegment" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "workspaceId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoProspeccaoTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AutoProspeccaoRun
CREATE TABLE "AutoProspeccaoRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "searchProfileId" TEXT,
    "triggeredBy" TEXT NOT NULL,
    "status" "AutoProspRunStatus" NOT NULL DEFAULT 'RUNNING',
    "leadsFound" INTEGER NOT NULL DEFAULT 0,
    "leadsAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "leadsHot" INTEGER NOT NULL DEFAULT 0,
    "leadsWarm" INTEGER NOT NULL DEFAULT 0,
    "leadsCold" INTEGER NOT NULL DEFAULT 0,
    "leadsDedupSkip" INTEGER NOT NULL DEFAULT 0,
    "crmPushed" INTEGER NOT NULL DEFAULT 0,
    "emailsQueued" INTEGER NOT NULL DEFAULT 0,
    "errorLog" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AutoProspeccaoRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutoProspeccaoConfig_workspaceId_key" ON "AutoProspeccaoConfig"("workspaceId");
CREATE INDEX "AutoProspeccaoConfig_workspaceId_idx" ON "AutoProspeccaoConfig"("workspaceId");
CREATE INDEX "SearchProfile_workspaceId_isActive_idx" ON "SearchProfile"("workspaceId", "isActive");
CREATE INDEX "SearchProfile_isSystem_idx" ON "SearchProfile"("isSystem");
CREATE INDEX "SearchProfile_nextRunAt_idx" ON "SearchProfile"("nextRunAt");
CREATE UNIQUE INDEX "ProspectedLead_workspaceId_cnpj_key" ON "ProspectedLead"("workspaceId", "cnpj");
CREATE INDEX "ProspectedLead_workspaceId_status_idx" ON "ProspectedLead"("workspaceId", "status");
CREATE INDEX "ProspectedLead_workspaceId_score_idx" ON "ProspectedLead"("workspaceId", "score" DESC);
CREATE INDEX "ProspectedLead_searchProfileId_idx" ON "ProspectedLead"("searchProfileId");
CREATE INDEX "ProspectedLead_createdAt_idx" ON "ProspectedLead"("createdAt" DESC);
CREATE INDEX "ProspectedLeadEmailEvent_leadId_idx" ON "ProspectedLeadEmailEvent"("leadId");
CREATE INDEX "ProspectedLeadEmailEvent_leadId_step_idx" ON "ProspectedLeadEmailEvent"("leadId", "step");
CREATE INDEX "AutoProspeccaoTemplate_type_idx" ON "AutoProspeccaoTemplate"("type");
CREATE INDEX "AutoProspeccaoTemplate_isSystem_idx" ON "AutoProspeccaoTemplate"("isSystem");
CREATE INDEX "AutoProspeccaoTemplate_workspaceId_idx" ON "AutoProspeccaoTemplate"("workspaceId");
CREATE INDEX "AutoProspeccaoRun_workspaceId_startedAt_idx" ON "AutoProspeccaoRun"("workspaceId", "startedAt" DESC);
CREATE INDEX "AutoProspeccaoRun_status_idx" ON "AutoProspeccaoRun"("status");

-- AddForeignKey
ALTER TABLE "AutoProspeccaoConfig" ADD CONSTRAINT "AutoProspeccaoConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProspectedLead" ADD CONSTRAINT "ProspectedLead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProspectedLead" ADD CONSTRAINT "ProspectedLead_searchProfileId_fkey" FOREIGN KEY ("searchProfileId") REFERENCES "SearchProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProspectedLeadEmailEvent" ADD CONSTRAINT "ProspectedLeadEmailEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "ProspectedLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutoProspeccaoRun" ADD CONSTRAINT "AutoProspeccaoRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutoProspeccaoRun" ADD CONSTRAINT "AutoProspeccaoRun_searchProfileId_fkey" FOREIGN KEY ("searchProfileId") REFERENCES "SearchProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
