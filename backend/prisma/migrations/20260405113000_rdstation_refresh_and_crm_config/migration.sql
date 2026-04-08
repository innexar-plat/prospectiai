-- Ensure RD Station OAuth refresh fields exist on User for token refresh flow
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rdStationRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rdStationTokenExpiresAt" TIMESTAMP(3);

-- Admin-managed CRM OAuth app settings (RD, HubSpot, etc.)
CREATE TABLE IF NOT EXISTS "CrmIntegrationConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretEncrypted" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmIntegrationConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmIntegrationConfig_provider_key"
ON "CrmIntegrationConfig"("provider");
