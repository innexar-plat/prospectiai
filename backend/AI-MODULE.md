# AI Module — Architecture & Provider Configuration

## Overview

The AI module uses **Vercel AI SDK v6** as a unified abstraction layer for multiple LLM providers.
This replaces the previous manual adapter pattern (removed in April 2026).

## Supported Providers

| Provider | Backend Key | SDK Package | Base URL |
|----------|------------|-------------|----------|
| Google Gemini | `GEMINI` | `@ai-sdk/google` | Google API |
| OpenAI | `OPENAI` | `@ai-sdk/openai` | OpenAI API |
| Cloudflare Workers AI | `CLOUDFLARE` | `@ai-sdk/openai-compatible` | Cloudflare AI Gateway |
| Groq | `GROQ` | `@ai-sdk/openai-compatible` | `api.groq.com` |
| DeepSeek | `DEEPSEEK` | `@ai-sdk/openai-compatible` | `api.deepseek.com` |
| Anthropic | `ANTHROPIC` | `@ai-sdk/openai-compatible` | `api.anthropic.com` |

## File Structure

```
src/lib/ai/
├── index.ts              # Public API (exports resolve + types)
├── resolve.ts            # Provider resolution + generateText wrapper
├── types.ts              # Core types (AiProviderType, ResolvedAiConfig, etc.)
├── schemas.ts            # Zod schemas for structured AI output
├── encrypt.ts            # API key encryption/decryption
└── prompts/
    ├── analyze-types.ts  # Types for lead analysis (LeadAnalysis, BusinessData)
    ├── labels.ts         # Bilingual label constants (EN/PT)
    └── builder.ts        # Prompt construction functions

src/lib/gemini.ts         # Lead analysis orchestration (analyzeLead entry point)
```

## Key Functions

### `resolveAiForRole(role: AiRole)`
Resolves provider config for a given role. Priority: DB config → `GEMINI_API_KEY` env var.

### `generateCompletionForRole(role, options)`
Generates a text completion using a **candidate pool** per role.

Runtime behavior (2026-04):
- Multi-candidate routing from enabled DB configs (`AiProviderConfig`) + env fallback (`GEMINI_API_KEY`).
- Per-model concurrency bulkhead (`provider:model`) to avoid overloading one model.
- Circuit breaker per model (opens temporarily after repeated failures).
- Automatic fallback to next healthy candidate.
- 90-second timeout per provider attempt.

### `createLanguageModel(config: ResolvedAiConfig)`
Creates an AI SDK `LanguageModel` instance from a resolved config. Used internally and by the admin test endpoint.

## Configuration (Admin Panel)

Providers are configured per role in the Admin panel (`/admin` → AI Config).

Each config includes:
- **Role**: `lead_analysis`, `viability`, `company_analysis`
- **Provider**: One of the 6 supported providers
- **Model**: Provider-specific model identifier
- **API Key**: Encrypted at rest (AES-256-GCM)
- **Cloudflare Account ID**: Required only for `CLOUDFLARE` provider

### Default Fallback

When no DB config exists, the system uses env fallback candidates.

- Default provider: `GEMINI` with `GEMINI_API_KEY` + `gemini-2.5-flash`.
- Optional provider: `CLOUDFLARE` with `AI_FALLBACK_PROVIDER=CLOUDFLARE`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_AI_API_TOKEN`.
- Cloudflare can use a model pool per role (comma-separated), with fast/smart fallback order:
  - `AI_CLOUDFLARE_MODELS_LEAD_ANALYSIS`
  - `AI_CLOUDFLARE_MODELS_VIABILITY`
  - `AI_CLOUDFLARE_MODELS_COMPANY_ANALYSIS`

## Scalability Controls (Env)

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_MODEL_MAX_IN_FLIGHT` | `4` | Max concurrent in-flight requests per `provider:model`. |
| `AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD` | `3` | Consecutive failures before opening circuit for a model. |
| `AI_CIRCUIT_BREAKER_OPEN_MS` | `30000` | Circuit open duration before retrying model. |
| `AI_ALWAYS_INCLUDE_ENV_FALLBACK` | `false` | When `true`, append env fallback (`GEMINI_API_KEY` or `AI_FALLBACK_PROVIDER`) to DB candidates so quota/rate-limit failures on primary providers trigger automatic fallback. |
| `AI_FALLBACK_PROVIDER` | `GEMINI` | Env fallback provider when DB configs exist or as sole fallback (`GEMINI` or `CLOUDFLARE`). |
| `ANALYZE_RESULT_CACHE_TTL_SECONDS` | `86400` | TTL for analyze result cache in Redis. |
| `ANALYZE_AI_MAX_OUTPUT_TOKENS` | `16384` | Max output tokens per analyze AI call (reduce for low-cost stress tests). |

## Analyze Cache & Fallback Flow

`runAnalyzePreChecks` and `runAnalyze` now use Redis result cache first:

1. Resolve `placeId`.
2. Check Redis key `analyze:result:{userId}:{placeId}`.
3. If cache miss, check DB cached analysis (`leadAnalysis`).
4. If found in DB, map and repopulate Redis cache.
5. If no cached result, run AI completion via multi-model router.
6. Persist output and write Redis cache.

Result: faster repeated requests, reduced token spend, better user experience under provider instability.

## Observability

`GET /api/health` includes:

- `analyzeBulkhead` (route-level concurrency guard)
- `aiModelBulkhead` (per-model in-flight and rejected counters)

## Database Schema

```prisma
enum AiConfigProvider {
  GEMINI
  OPENAI
  CLOUDFLARE
  GROQ
  DEEPSEEK
  ANTHROPIC
}

enum AiConfigRole {
  LEAD_ANALYSIS
  VIABILITY
  COMPANY_ANALYSIS
}
```

## Adding a New Provider

1. Add the provider key to `AiConfigProvider` enum in `prisma/schema.prisma`
2. Create a Prisma migration
3. Add a `case` in `createLanguageModel()` in `src/lib/ai/resolve.ts`
4. Add the provider to `AiProviderType` in `src/lib/ai/types.ts`
5. Add the provider option in `admin/src/pages/AiConfigPage.tsx` (`PROVIDERS` array)
6. Add the provider type in `admin/src/lib/api.ts` (`AiConfigProvider` type)

## Tests

```bash
# AI module tests
npx jest ai-resolve ai-prompts-builder ai-schemas gemini admin-ai-config

# All backend tests
npx jest
```
