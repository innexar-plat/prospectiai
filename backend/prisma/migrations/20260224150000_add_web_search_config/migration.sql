-- CreateEnum
CREATE TYPE "WebSearchProvider" AS ENUM ('SERPER', 'TAVILY');

-- CreateTable
CREATE TABLE "WebSearchConfig" (
    "id" TEXT NOT NULL,
    "role" "AiConfigRole" NOT NULL,
    "provider" "WebSearchProvider" NOT NULL,
    "apiKeyEncrypted" TEXT,
    "maxResults" INTEGER NOT NULL DEFAULT 5,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebSearchConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebSearchConfig_role_key" ON "WebSearchConfig"("role");

-- CreateIndex
CREATE INDEX "WebSearchConfig_enabled_idx" ON "WebSearchConfig"("enabled");
