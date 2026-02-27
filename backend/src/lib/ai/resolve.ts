/**
 * Resolves AI config by role: DB first, then env fallback (GEMINI_API_KEY).
 */
import { createGeminiAdapter } from './adapters/gemini';
import { createOpenAIAdapter } from './adapters/openai';
import { createCloudflareAdapter } from './adapters/cloudflare';
import type { AiRole, AiProviderType, CompletionOptions, CompletionResult, IAIAdapter, ResolvedAiConfig } from './types';

const DEFAULT_MODEL_BY_ROLE: Record<AiRole, string> = {
    lead_analysis: 'gemini-flash-latest',
    viability: 'gemini-2.5-flash',
    company_analysis: 'gemini-2.5-flash',
};

/**
 * Returns resolved config and adapter for the given role.
 * Uses DB (AiProviderConfig no painel admin) first; se não houver config para o role,
 * viability usa o mesmo config de lead_analysis (mesmo provedor/modelo da busca).
 * Senão fallback env (GEMINI_API_KEY).
 */
export async function resolveAiForRole(role: AiRole): Promise<{ config: ResolvedAiConfig; adapter: IAIAdapter }> {
    let fromDb = await getAiConfigFromDb(role);
    if (!fromDb && (role === 'viability' || role === 'company_analysis')) {
        fromDb = await getAiConfigFromDb(role === 'company_analysis' ? 'viability' : 'lead_analysis');
    }
    if (fromDb) {
        const adapter = createAdapter(fromDb.provider, fromDb.model, fromDb.apiKey, fromDb.accountId);
        return { config: { provider: fromDb.provider, model: fromDb.model, apiKey: fromDb.apiKey }, adapter };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error(`No AI config for role "${role}" and GEMINI_API_KEY not set`);
    const model = DEFAULT_MODEL_BY_ROLE[role];
    const adapter = createGeminiAdapter(apiKey, model);
    return {
        config: { provider: 'GEMINI', model, apiKey },
        adapter,
    };
}

/**
 * Single entry point for completion: resolve by role and run.
 */
export async function generateCompletionForRole(
    role: AiRole,
    options: CompletionOptions
): Promise<CompletionResult> {
    const { adapter } = await resolveAiForRole(role);
    return adapter.generateCompletion(options);
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

function createAdapter(
    provider: AiProviderType,
    model: string,
    apiKey: string,
    accountId?: string
): IAIAdapter {
    switch (provider) {
        case 'GEMINI':
            return createGeminiAdapter(apiKey, model);
        case 'OPENAI':
            return createOpenAIAdapter(apiKey, model);
        case 'CLOUDFLARE':
            return createCloudflareAdapter(apiKey, model, accountId);
        default:
            throw new Error(`Unknown AI provider: ${provider}`);
    }
}
