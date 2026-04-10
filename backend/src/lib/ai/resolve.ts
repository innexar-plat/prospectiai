/**
 * AI provider resolution: DB-first, env fallback.
 *
 * Uses Vercel AI SDK (`ai` package) for unified provider interface.
 * All providers go through `generateText()` — no more manual adapters.
 */
import { generateText, type LanguageModelV1 } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { AiRole, AiProviderType, CompletionOptions, CompletionResult, ResolvedAiConfig } from './types';

const DEFAULT_MODEL_BY_ROLE: Record<AiRole, string> = {
    lead_analysis: 'gemini-2.5-flash',
    viability: 'gemini-2.5-flash',
    company_analysis: 'gemini-2.5-flash',
};

/** Maps a resolved config to an AI SDK LanguageModel instance. */
export function createLanguageModel(config: ResolvedAiConfig): LanguageModelV1 {
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
        default:
            throw new Error(`Unknown AI provider: ${config.provider}`);
    }
}

/**
 * Returns resolved config for the given role.
 * Priority: DB (AiProviderConfig) → env (GEMINI_API_KEY).
 */
export async function resolveAiForRole(role: AiRole): Promise<{ config: ResolvedAiConfig; model: LanguageModelV1 }> {
    let fromDb = await getAiConfigFromDb(role);
    if (!fromDb && (role === 'viability' || role === 'company_analysis')) {
        fromDb = await getAiConfigFromDb(role === 'company_analysis' ? 'viability' : 'lead_analysis');
    }
    if (fromDb) {
        const config: ResolvedAiConfig = {
            provider: fromDb.provider,
            model: fromDb.model,
            apiKey: fromDb.apiKey,
            accountId: fromDb.accountId,
        };
        return { config, model: createLanguageModel(config) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error(`No AI config for role "${role}" and GEMINI_API_KEY not set`);
    const modelName = DEFAULT_MODEL_BY_ROLE[role];
    const config: ResolvedAiConfig = { provider: 'GEMINI', model: modelName, apiKey };
    return { config, model: createLanguageModel(config) };
}

/**
 * Single entry point: resolve provider by role and generate completion.
 * Falls back to Gemini (env) if primary provider fails.
 */
export async function generateCompletionForRole(
    role: AiRole,
    options: CompletionOptions
): Promise<CompletionResult> {
    const { model, config } = await resolveAiForRole(role);

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.prompt });

    try {
        const result = await generateText({
            model,
            messages,
            maxTokens: options.maxTokens ?? 16384,
            abortSignal: AbortSignal.timeout(90_000),
        });
        return {
            text: result.text,
            usage: result.usage
                ? { inputTokens: result.usage.promptTokens, outputTokens: result.usage.completionTokens }
                : undefined,
        };
    } catch (primaryErr) {
        const geminiKey = process.env.GEMINI_API_KEY;
        if (config.provider !== 'GEMINI' && geminiKey) {
            const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
            console.warn(`[AI-Fallback] ${config.provider} failed (${msg}), falling back to Gemini`);
            const fallbackConfig: ResolvedAiConfig = {
                provider: 'GEMINI',
                model: DEFAULT_MODEL_BY_ROLE[role],
                apiKey: geminiKey,
            };
            const fallbackModel = createLanguageModel(fallbackConfig);
            const result = await generateText({
                model: fallbackModel,
                messages,
                maxTokens: options.maxTokens ?? 16384,
                abortSignal: AbortSignal.timeout(90_000),
            });
            return {
                text: result.text,
                usage: result.usage
                    ? { inputTokens: result.usage.promptTokens, outputTokens: result.usage.completionTokens }
                    : undefined,
            };
        }
        throw primaryErr;
    }
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

async function getAiConfigFromDb(role: AiRole): Promise<DbConfig | null> {
    try {
        const { prisma } = await import('@/lib/prisma');
        const { decryptApiKey } = await import('@/lib/ai/encrypt');
        const prismaRole = ROLE_TO_PRISMA[role];
        const row = await prisma.aiProviderConfig.findFirst({
            where: { role: prismaRole, enabled: true },
            orderBy: { updatedAt: 'desc' },
        });
        if (!row || !row.apiKeyEncrypted) return null;
        const apiKey = decryptApiKey(row.apiKeyEncrypted);
        return {
            provider: row.provider as AiProviderType,
            model: row.model,
            apiKey,
            accountId: row.cloudflareAccountId ?? undefined,
        };
    } catch {
        return null;
    }
}
