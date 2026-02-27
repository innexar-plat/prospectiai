-- CreateEnum
CREATE TYPE "AiConfigRole" AS ENUM ('LEAD_ANALYSIS', 'VIABILITY');

-- CreateEnum
CREATE TYPE "AiConfigProvider" AS ENUM ('GEMINI', 'OPENAI', 'CLOUDFLARE');

-- CreateTable
CREATE TABLE "AiProviderConfig" (
    "id" TEXT NOT NULL,
    "role" "AiConfigRole" NOT NULL,
    "provider" "AiConfigProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT,
    "cloudflareAccountId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiProviderConfig_role_idx" ON "AiProviderConfig"("role");

-- CreateIndex
CREATE INDEX "AiProviderConfig_enabled_idx" ON "AiProviderConfig"("enabled");
