-- Persist AI/analyze runtime controls in SQL
CREATE TABLE "AiRuntimeConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "analyzeRateLimitMax" INTEGER NOT NULL DEFAULT 15,
    "analyzeRateLimitWindowSeconds" INTEGER NOT NULL DEFAULT 60,
    "analyzeBulkheadMaxInFlight" INTEGER NOT NULL DEFAULT 12,
    "analyzeBulkheadAcquireTimeoutMs" INTEGER NOT NULL DEFAULT 12000,
    "aiModelMaxInFlight" INTEGER NOT NULL DEFAULT 4,
    "analyzeAiMaxOutputTokens" INTEGER NOT NULL DEFAULT 16384,
    "aiCircuitBreakerFailureThreshold" INTEGER NOT NULL DEFAULT 3,
    "aiCircuitBreakerOpenMs" INTEGER NOT NULL DEFAULT 30000,
    "aiFallbackProvider" TEXT NOT NULL DEFAULT 'GEMINI',
    "aiCloudflareModelsLeadAnalysis" TEXT NOT NULL DEFAULT '',
    "aiCloudflareModelsViability" TEXT NOT NULL DEFAULT '',
    "aiCloudflareModelsCompanyAnalysis" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRuntimeConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiRuntimeConfig_key_key" ON "AiRuntimeConfig"("key");
