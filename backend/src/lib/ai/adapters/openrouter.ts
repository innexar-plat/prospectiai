/**
 * OpenRouter adapter constants.
 * Uses OpenAI-compatible endpoint: https://openrouter.ai/api/v1/chat/completions
 * Auth: Authorization: Bearer $OPENROUTER_API_KEY
 */
import type { AiRole } from '../types';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/** Free-tier models (suffix :free). See https://openrouter.ai/models?max_price=0 */
export const DEFAULT_OPENROUTER_MODEL_POOL_BY_ROLE: Record<AiRole, string[]> = {
    lead_analysis: [
        'liquid/lfm-2.5-1.2b-instruct:free',
        'meta-llama/llama-3.3-70b-instruct:free',
    ],
    viability: [
        'liquid/lfm-2.5-1.2b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
    ],
    company_analysis: [
        'liquid/lfm-2.5-1.2b-instruct:free',
        'google/gemma-4-26b-a4b-it:free',
    ],
};

export const OPENROUTER_ENV_MODEL_KEYS: Record<AiRole, string> = {
    lead_analysis: 'AI_OPENROUTER_MODELS_LEAD_ANALYSIS',
    viability: 'AI_OPENROUTER_MODELS_VIABILITY',
    company_analysis: 'AI_OPENROUTER_MODELS_COMPANY_ANALYSIS',
};
