/**
 * AI abstraction layer — types and interfaces.
 *
 * After migration to Vercel AI SDK, the IAIAdapter interface is kept for
 * backward compat but the primary entry point is `generateCompletionForRole()`
 * which uses AI SDK's `generateText` under the hood.
 */

export type AiRole = 'lead_analysis' | 'viability' | 'company_analysis';

export type AiProviderType = 'GEMINI' | 'OPENAI' | 'CLOUDFLARE' | 'GROQ' | 'DEEPSEEK' | 'ANTHROPIC';

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

/** @deprecated Use AI SDK `generateText` / `generateObject` via resolve. */
export interface IAIAdapter {
    generateCompletion(options: CompletionOptions): Promise<CompletionResult>;
}

export interface ResolvedAiConfig {
    provider: AiProviderType;
    model: string;
    apiKey: string;
    accountId?: string;
}
