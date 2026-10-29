-- Auto-prospecting: send through the main sender with warm-up, reply-to and display name
ALTER TABLE "AutoProspeccaoConfig" ADD COLUMN "useSystemSender" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AutoProspeccaoConfig" ADD COLUMN "systemSenderStartedAt" TIMESTAMP(3);
ALTER TABLE "AutoProspeccaoConfig" ADD COLUMN "replyToEmail" TEXT;
ALTER TABLE "AutoProspeccaoConfig" ADD COLUMN "senderName" TEXT;
