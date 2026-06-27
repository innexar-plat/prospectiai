import type { AiProviderType } from './types';

/** Preferred provider order for fallback: CLOUDFLARE → GEMINI → OPENROUTER → others. */
const PROVIDER_TIER: Record<AiProviderType, number> = {
    CLOUDFLARE: 0,
    GEMINI: 1,
    OPENROUTER: 2,
    OPENAI: 3,
    GROQ: 4,
    DEEPSEEK: 5,
    ANTHROPIC: 6,
};

export function getProviderTier(provider: AiProviderType | string): number {
    const tier = PROVIDER_TIER[provider as AiProviderType];
    return tier ?? 99;
}

export function compareProviderPriority(
    a: { provider: AiProviderType | string; updatedAt?: Date },
    b: { provider: AiProviderType | string; updatedAt?: Date },
): number {
    const tierDiff = getProviderTier(a.provider) - getProviderTier(b.provider);
    if (tierDiff !== 0) return tierDiff;
    if (a.updatedAt && b.updatedAt) {
        return b.updatedAt.getTime() - a.updatedAt.getTime();
    }
    return 0;
}
