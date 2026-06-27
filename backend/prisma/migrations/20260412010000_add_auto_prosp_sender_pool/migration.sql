-- CreateTable AutoProspSenderPool
CREATE TABLE "AutoProspSenderPool" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dailyLimit" INTEGER NOT NULL DEFAULT 200,
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "sentTodayResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "resendApiKeyEncrypted" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPasswordEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutoProspSenderPool_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AutoProspSenderPool_workspaceId_isActive_idx" ON "AutoProspSenderPool"("workspaceId", "isActive");
ALTER TABLE "AutoProspSenderPool" ADD CONSTRAINT "AutoProspSenderPool_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
