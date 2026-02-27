/**
 * AI abstraction layer — types and interface for multiple providers.
 */

export type AiRole = 'lead_analysis' | 'viability' | 'company_analysis';

export type AiProviderType = 'GEMINI' | 'OPENAI' | 'CLOUDFLARE';

export interface CompletionOptions {
    prompt: string;
    systemPrompt?: string;
    jsonMode?: boolean;
    maxTokens?: number;
}

export interface CompletionResult {
    text: string;
    usage?: { inputTokens: number; outputTokens: number };
}

export interface IAIAdapter {
    generateCompletion(options: CompletionOptions): Promise<CompletionResult>;
}

export interface ResolvedAiConfig {
    provider: AiProviderType;
    model: string;
    apiKey: string;
}
