-- CreateTable
CREATE TABLE "NotificationChannelConfig" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationChannelConfig_pkey" PRIMARY KEY ("key")
);

-- Seed default channels (optional; can be done in app on first GET)
INSERT INTO "NotificationChannelConfig" ("key", "name", "appEnabled", "emailEnabled", "createdAt", "updatedAt")
VALUES
  ('lead_analysis_ready', 'Análise de lead pronta', true, true, NOW(), NOW()),
  ('team_invite', 'Convite para workspace', true, true, NOW(), NOW()),
  ('admin_broadcast', 'Broadcast admin', true, false, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;
