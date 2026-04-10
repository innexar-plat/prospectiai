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
Generates a text completion using the resolved provider. Includes automatic fallback to Gemini on failure and a 90-second timeout.

### `createLanguageModel(config: ResolvedAiConfig)`
Creates an AI SDK `LanguageModelV1` instance from a resolved config. Used internally and by the admin test endpoint.

## Configuration (Admin Panel)

Providers are configured per role in the Admin panel (`/admin` → AI Config).

Each config includes:
- **Role**: `lead_analysis`, `viability`, `company_analysis`
- **Provider**: One of the 6 supported providers
- **Model**: Provider-specific model identifier
- **API Key**: Encrypted at rest (AES-256-GCM)
- **Cloudflare Account ID**: Required only for `CLOUDFLARE` provider

### Default Fallback

When no DB config exists, the system uses `GEMINI_API_KEY` environment variable with `gemini-2.5-flash`.

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
