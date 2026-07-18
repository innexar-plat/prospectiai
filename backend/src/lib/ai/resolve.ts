/**
 * AI provider resolution: DB-first, env fallback.
 *
 * Uses Vercel AI SDK (`ai` package) for unified provider interface.
 * All providers go through `generateText()` — no more manual adapters.
 */
import { generateText, generateObject, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { ZodType } from 'zod';
import type { AiRole, AiProviderType, CompletionOptions, CompletionResult, ResolvedAiConfig } from './types';
import { releaseModelSlot, tryAcquireModelSlot } from './model-bulkhead';
import {
    DEFAULT_OPENROUTER_MODEL_POOL_BY_ROLE,
    OPENROUTER_BASE_URL,
    OPENROUTER_ENV_MODEL_KEYS,
} from './adapters/openrouter';
import { compareProviderPriority } from './provider-priority';

const DEFAULT_MODEL_BY_ROLE: Record<AiRole, string> = {
    lead_analysis: 'gemini-2.5-flash',
    viability: 'gemini-2.5-flash',
    company_analysis: 'gemini-2.5-flash',
};

const DEFAULT_CLOUDFLARE_MODEL_POOL_BY_ROLE: Record<AiRole, string[]> = {
    lead_analysis: [
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        '@cf/meta/llama-3.1-8b-instruct',
    ],
    viability: [
        '@cf/meta/llama-3.1-8b-instruct',
        '@cf/meta/llama-3.2-3b-instruct',
    ],
    company_analysis: [
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        '@cf/meta/llama-3.1-8b-instruct',
    ],
};

type CandidateConfig = ResolvedAiConfig & {
    source: 'db' | 'env';
    rank: number;
};

type ModelHealth = {
    consecutiveFailures: number;
    openUntil: number;
};

const modelHealthState = new Map<string, ModelHealth>();

const DEFAULT_CIRCUIT_BREAKER_THRESHOLD = 3;
const DEFAULT_CIRCUIT_BREAKER_OPEN_MS = 30_000;

function getCircuitBreakerThreshold(): number {
    const parsed = Number.parseInt(process.env.AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CIRCUIT_BREAKER_THRESHOLD;
}

function getCircuitBreakerOpenMs(): number {
    const parsed = Number.parseInt(process.env.AI_CIRCUIT_BREAKER_OPEN_MS ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CIRCUIT_BREAKER_OPEN_MS;
}

function getModelKey(config: ResolvedAiConfig): string {
    return `${config.provider}:${config.model}`;
}

function getModelHealth(modelKey: string): ModelHealth {
    const found = modelHealthState.get(modelKey);
    if (found) return found;
    const created = { consecutiveFailures: 0, openUntil: 0 };
    modelHealthState.set(modelKey, created);
    return created;
}

function isModelOpen(modelKey: string): boolean {
    const state = getModelHealth(modelKey);
    return state.openUntil > Date.now();
}

function markModelSuccess(modelKey: string): void {
    const state = getModelHealth(modelKey);
    state.consecutiveFailures = 0;
    state.openUntil = 0;
}

function markModelFailure(modelKey: string): void {
    const state = getModelHealth(modelKey);
    state.consecutiveFailures += 1;
    if (state.consecutiveFailures >= getCircuitBreakerThreshold()) {
        state.openUntil = Date.now() + getCircuitBreakerOpenMs();
        state.consecutiveFailures = 0;
    }
}

function dedupeCandidates(configs: CandidateConfig[]): CandidateConfig[] {
    const deduped: CandidateConfig[] = [];
    const seen = new Set<string>();
    for (const config of configs) {
        const key = `${config.provider}:${config.model}:${config.apiKey}:${config.accountId ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(config);
    }
    return deduped;
}

function rankCandidates(configs: CandidateConfig[]): CandidateConfig[] {
    return [...configs].sort((a, b) => a.rank - b.rank);
}

function getStructuredOutputMode(provider: AiProviderType): 'json' | undefined {
    // Cloudflare's AI SDK adapters warn when responseFormat/json mode is forced.
    return provider === 'CLOUDFLARE' ? undefined : 'json';
}

function validateModelOutput(text: string, jsonMode: boolean | undefined): void {
    const trimmed = text.trim();
    if (!trimmed) {
        throw new Error('EMPTY_AI_RESPONSE');
    }
    if (!jsonMode) return;
    const looksLikeJson = trimmed.includes('{') || trimmed.includes('[');
    if (!looksLikeJson) {
        throw new Error('NON_JSON_AI_RESPONSE');
    }
}

function buildInvalidOutputError(
    reason: 'empty' | 'non_json',
    candidate: CandidateConfig,
    result: { text?: string; finishReason?: string }
): Error {
    const length = result.text?.length ?? 0;
    const finishReason = result.finishReason ?? 'unknown';
    return new Error(
        `INVALID_AI_OUTPUT_${reason.toUpperCase()} provider=${candidate.provider} model=${candidate.model} length=${length} finishReason=${finishReason}`,
    );
}

function parseCommaList(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

function getCloudflareModelPoolForRole(role: AiRole): string[] {
    const envKeyByRole: Record<AiRole, string> = {
        lead_analysis: 'AI_CLOUDFLARE_MODELS_LEAD_ANALYSIS',
        viability: 'AI_CLOUDFLARE_MODELS_VIABILITY',
        company_analysis: 'AI_CLOUDFLARE_MODELS_COMPANY_ANALYSIS',
    };

    const configured = parseCommaList(process.env[envKeyByRole[role]]);
    if (configured.length > 0) return configured;
    return DEFAULT_CLOUDFLARE_MODEL_POOL_BY_ROLE[role];
}

function getOpenRouterModelPoolForRole(role: AiRole): string[] {
    const configured = parseCommaList(process.env[OPENROUTER_ENV_MODEL_KEYS[role]]);
    if (configured.length > 0) return configured;
    return DEFAULT_OPENROUTER_MODEL_POOL_BY_ROLE[role];
}

/** Env fallback chain: CLOUDFLARE → GEMINI → OPENROUTER (each with model pool). */
function resolveEnvFallbackCandidates(role: AiRole): CandidateConfig[] {
    const candidates: CandidateConfig[] = [];
    let rank = 10_000;

    const cloudflareKey = process.env.CLOUDFLARE_AI_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
    const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (cloudflareKey && cloudflareAccountId) {
        for (const model of getCloudflareModelPoolForRole(role)) {
            candidates.push({
                provider: 'CLOUDFLARE',
                model,
                apiKey: cloudflareKey,
                accountId: cloudflareAccountId,
                source: 'env',
                rank: rank++,
            });
        }
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
        candidates.push({
            provider: 'GEMINI',
            model: DEFAULT_MODEL_BY_ROLE[role],
            apiKey: geminiKey,
            source: 'env',
            rank: rank++,
        });
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
        for (const model of getOpenRouterModelPoolForRole(role)) {
            candidates.push({
                provider: 'OPENROUTER',
                model,
                apiKey: openRouterKey,
                source: 'env',
                rank: rank++,
            });
        }
    }

    return candidates;
}

function shouldIncludeEnvFallbackWithDbProviders(): boolean {
    return String(process.env.AI_ALWAYS_INCLUDE_ENV_FALLBACK ?? '').toLowerCase() === 'true';
}

/** Maps a resolved config to an AI SDK LanguageModel instance. */
export function createLanguageModel(config: ResolvedAiConfig): LanguageModel {
    switch (config.provider) {
        case 'GEMINI': {
            const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
            return google(config.model);
        }
        case 'OPENAI': {
            const openai = createOpenAI({ apiKey: config.apiKey });
            return openai(config.model);
        }
        case 'CLOUDFLARE': {
            if (!config.accountId) {
                throw new Error('Cloudflare provider requires accountId');
            }
            const cf = createOpenAICompatible({
                name: 'cloudflare',
                baseURL: `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/v1`,
                headers: { Authorization: `Bearer ${config.apiKey}` },
            });
            return cf(config.model);
        }
        case 'GROQ': {
            const groq = createOpenAICompatible({
                name: 'groq',
                baseURL: 'https://api.groq.com/openai/v1',
                headers: { Authorization: `Bearer ${config.apiKey}` },
            });
            return groq(config.model);
        }
        case 'DEEPSEEK': {
            const ds = createOpenAICompatible({
                name: 'deepseek',
                baseURL: 'https://api.deepseek.com/v1',
                headers: { Authorization: `Bearer ${config.apiKey}` },
            });
            return ds(config.model);
        }
        case 'ANTHROPIC': {
            // Anthropic uses OpenAI-compatible endpoint via messages API
            const anthropic = createOpenAICompatible({
                name: 'anthropic',
                baseURL: 'https://api.anthropic.com/v1',
                headers: {
                    'x-api-key': config.apiKey,
                    'anthropic-version': '2023-06-01',
                },
            });
            return anthropic(config.model);
        }
        case 'OPENROUTER': {
            const openrouter = createOpenAICompatible({
                name: 'openrouter',
                baseURL: OPENROUTER_BASE_URL,
                headers: { Authorization: `Bearer ${config.apiKey}` },
            });
            return openrouter(config.model);
        }
        default:
            throw new Error(`Unknown AI provider: ${config.provider}`);
    }
}

/**
 * Returns resolved config for the given role.
 * Priority: DB (AiProviderConfig) → env (GEMINI_API_KEY).
 */
export async function resolveAiForRole(role: AiRole): Promise<{ config: ResolvedAiConfig; model: LanguageModel }> {
    const candidates = await resolveAiCandidatesForRole(role);
    if (candidates.length === 0) {
        throw new Error(`No AI config for role "${role}" and no env fallback configured`);
    }
    const first = candidates[0]!;
    const config: ResolvedAiConfig = {
        provider: first.provider,
        model: first.model,
        apiKey: first.apiKey,
        accountId: first.accountId,
    };
    return { config, model: createLanguageModel(config) };
}

export async function resolveAiCandidatesForRole(role: AiRole): Promise<CandidateConfig[]> {
    const dbConfigs = await getAiConfigsFromDb(role);
    const candidates: CandidateConfig[] = dbConfigs.map((cfg, idx) => ({ ...cfg, source: 'db', rank: idx }));

    if (dbConfigs.length === 0 || shouldIncludeEnvFallbackWithDbProviders()) {
        candidates.push(...resolveEnvFallbackCandidates(role));
    }

    return rankCandidates(dedupeCandidates(candidates));
}

/**
 * Single entry point: resolve provider by role and generate completion.
 * Falls back to Gemini (env) if primary provider fails.
 */
export async function generateCompletionForRole(
    role: AiRole,
    options: CompletionOptions
): Promise<CompletionResult> {
    const candidates = await resolveAiCandidatesForRole(role);
    if (candidates.length === 0) {
        throw new Error(`No AI config for role "${role}" and no env fallback configured`);
    }

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.prompt });

    const attempts = candidates.filter((candidate) => !isModelOpen(getModelKey(candidate)));
    const orderedAttempts = attempts.length > 0 ? attempts : candidates;

    let lastErr: unknown;
    for (const candidate of orderedAttempts) {
        const modelKey = getModelKey(candidate);
        if (!tryAcquireModelSlot(modelKey)) {
            continue;
        }

        try {
            const model = createLanguageModel(candidate);
            const result = await generateText({
                model,
                messages,
                maxOutputTokens: options.maxOutputTokens ?? 16384,
                abortSignal: AbortSignal.timeout(90_000),
            });
            const outputText = result.text ?? '';
            try {
                validateModelOutput(outputText, options.jsonMode);
            } catch (err) {
                const invalidReason = outputText.trim().length === 0 ? 'empty' : 'non_json';
                const invalidErr = buildInvalidOutputError(invalidReason, candidate, {
                    text: outputText,
                    finishReason: (result as { finishReason?: string }).finishReason,
                });
                const { logger } = await import('@/lib/logger');
                logger.warn('AI provider returned invalid output', {
                    provider: candidate.provider,
                    model: candidate.model,
                    jsonMode: Boolean(options.jsonMode),
                    outputLength: outputText.length,
                    finishReason: (result as { finishReason?: string }).finishReason ?? 'unknown',
                    error: err instanceof Error ? err.message : 'Unknown',
                });
                throw invalidErr;
            }
            markModelSuccess(modelKey);
            return {
                text: outputText,
                usage: result.usage
                    ? { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 }
                    : undefined,
                provider: candidate.provider,
                model: candidate.model,
            };
        } catch (err) {
            lastErr = err;
            markModelFailure(modelKey);
        } finally {
            releaseModelSlot(modelKey);
        }
    }

    throw lastErr instanceof Error ? lastErr : new Error('No available AI model for completion');
}

/**
 * Structured-output variant: resolve provider by role and call `generateObject`
 * with a Zod schema for automatic JSON-mode + response validation.
 * Falls back through the same candidate/circuit-breaker pipeline.
 */
export async function generateObjectForRole<T>(
    role: AiRole,
    options: Omit<CompletionOptions, 'jsonMode'> & { schema: ZodType<T> },
): Promise<CompletionResult & { object: T }> {
    const candidates = await resolveAiCandidatesForRole(role);
    if (candidates.length === 0) {
        throw new Error(`No AI config for role "${role}" and no env fallback configured`);
    }

    const attempts = candidates.filter((c) => !isModelOpen(getModelKey(c)));
    const orderedAttempts = attempts.length > 0 ? attempts : candidates;

    let lastErr: unknown;
    for (const candidate of orderedAttempts) {
        const modelKey = getModelKey(candidate);
        if (!tryAcquireModelSlot(modelKey)) continue;

        try {
            const model = createLanguageModel(candidate);
            const result = await generateObject({
                model,
                schema: options.schema,
                prompt: options.prompt,
                system: options.systemPrompt,
                mode: getStructuredOutputMode(candidate.provider),
                maxOutputTokens: options.maxOutputTokens ?? 16384,
                abortSignal: AbortSignal.timeout(90_000),
            });

            markModelSuccess(modelKey);
            return {
                text: JSON.stringify(result.object),
                object: result.object,
                usage: result.usage
                    ? { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 }
                    : undefined,
                provider: candidate.provider,
                model: candidate.model,
            };
        } catch (err) {
            lastErr = err;
            markModelFailure(modelKey);
        } finally {
            releaseModelSlot(modelKey);
        }
    }

    throw lastErr instanceof Error ? lastErr : new Error('No available AI model for structured output');
}

interface DbConfig {
    provider: AiProviderType;
    model: string;
    apiKey: string;
    accountId?: string;
}

const ROLE_TO_PRISMA: Record<AiRole, 'LEAD_ANALYSIS' | 'VIABILITY' | 'COMPANY_ANALYSIS'> = {
    lead_analysis: 'LEAD_ANALYSIS',
    viability: 'VIABILITY',
    company_analysis: 'COMPANY_ANALYSIS',
};

async function getAiConfigsFromDb(role: AiRole): Promise<DbConfig[]> {
    try {
        const { prisma } = await import('@/lib/prisma');
        const { decryptApiKey } = await import('@/lib/ai/encrypt');
        const roleCandidates: AiRole[] = [role];
        if (role === 'viability' || role === 'company_analysis') {
            roleCandidates.push(role === 'company_analysis' ? 'viability' : 'lead_analysis');
        }

        const rows = await prisma.aiProviderConfig.findMany({
            where: {
                enabled: true,
                role: { in: roleCandidates.map((item) => ROLE_TO_PRISMA[item]) },
            },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        });
        rows.sort(compareProviderPriority);

        const configs: DbConfig[] = [];
        for (const row of rows) {
            if (!row.apiKeyEncrypted) continue;
            const apiKey = decryptApiKey(row.apiKeyEncrypted);
            configs.push({
                provider: row.provider as AiProviderType,
                model: row.model,
                apiKey,
                accountId: row.cloudflareAccountId ?? undefined,
            });
        }

        return configs;
    } catch {
        return [];
    }
}

export function __resetAiRouterForTests(): void {
    modelHealthState.clear();
}
