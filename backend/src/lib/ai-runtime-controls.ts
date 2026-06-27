import { prisma } from '@/lib/prisma';

const HYDRATE_INTERVAL_MS = 30_000;
const CONTROL_KEY = 'default';

let lastHydratedAt = 0;
let hydrating: Promise<void> | null = null;

function setEnv(name: string, value: string | number): void {
  process.env[name] = String(value);
}

async function hydrateNow(): Promise<void> {
  type RuntimeRow = {
    analyzeRateLimitMax: number;
    analyzeRateLimitWindowSeconds: number;
    analyzeBulkheadMaxInFlight: number;
    analyzeBulkheadAcquireTimeoutMs: number;
    aiModelMaxInFlight: number;
    analyzeAiMaxOutputTokens: number;
    aiCircuitBreakerFailureThreshold: number;
    aiCircuitBreakerOpenMs: number;
    aiFallbackProvider: string;
    aiCloudflareModelsLeadAnalysis: string;
    aiCloudflareModelsViability: string;
    aiCloudflareModelsCompanyAnalysis: string;
  };

  const rows = await prisma.$queryRaw<RuntimeRow[]>`
    SELECT
      "analyzeRateLimitMax",
      "analyzeRateLimitWindowSeconds",
      "analyzeBulkheadMaxInFlight",
      "analyzeBulkheadAcquireTimeoutMs",
      "aiModelMaxInFlight",
      "analyzeAiMaxOutputTokens",
      "aiCircuitBreakerFailureThreshold",
      "aiCircuitBreakerOpenMs",
      "aiFallbackProvider",
      "aiCloudflareModelsLeadAnalysis",
      "aiCloudflareModelsViability",
      "aiCloudflareModelsCompanyAnalysis"
    FROM "AiRuntimeConfig"
    WHERE "key" = ${CONTROL_KEY}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return;

  setEnv('ANALYZE_RATE_LIMIT_MAX', row.analyzeRateLimitMax);
  setEnv('ANALYZE_RATE_LIMIT_WINDOW_SECONDS', row.analyzeRateLimitWindowSeconds);
  setEnv('ANALYZE_BULKHEAD_MAX_IN_FLIGHT', row.analyzeBulkheadMaxInFlight);
  setEnv('ANALYZE_BULKHEAD_ACQUIRE_TIMEOUT_MS', row.analyzeBulkheadAcquireTimeoutMs);
  setEnv('AI_MODEL_MAX_IN_FLIGHT', row.aiModelMaxInFlight);
  setEnv('ANALYZE_AI_MAX_OUTPUT_TOKENS', row.analyzeAiMaxOutputTokens);
  setEnv('AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD', row.aiCircuitBreakerFailureThreshold);
  setEnv('AI_CIRCUIT_BREAKER_OPEN_MS', row.aiCircuitBreakerOpenMs);
  setEnv('AI_FALLBACK_PROVIDER', row.aiFallbackProvider);
  setEnv('AI_CLOUDFLARE_MODELS_LEAD_ANALYSIS', row.aiCloudflareModelsLeadAnalysis);
  setEnv('AI_CLOUDFLARE_MODELS_VIABILITY', row.aiCloudflareModelsViability);
  setEnv('AI_CLOUDFLARE_MODELS_COMPANY_ANALYSIS', row.aiCloudflareModelsCompanyAnalysis);
}

export async function hydrateAiRuntimeControlsFromSql(): Promise<void> {
  const now = Date.now();
  if (now - lastHydratedAt < HYDRATE_INTERVAL_MS) return;

  if (!hydrating) {
    hydrating = hydrateNow()
      .catch(() => {
        // Best-effort hydration; defaults/env remain active on failures.
      })
      .finally(() => {
        lastHydratedAt = Date.now();
        hydrating = null;
      });
  }

  await hydrating;
}
