/**
 * Cloudflare Workers AI adapter.
 * Uses OpenAI-compatible endpoint: .../ai/v1/chat/completions
 * Requires CLOUDFLARE_ACCOUNT_ID in env if not passed in options.
 */
import type { CompletionOptions, IAIAdapter } from '../types';

const CLOUDFLARE_CHAT_URL = 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions';

export interface CloudflareAdapterOptions {
    apiKey: string;
    model: string;
    accountId?: string;
}

export function createCloudflareAdapter(apiKey: string, model: string, accountId?: string): IAIAdapter {
    const account = accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!account) {
        throw new Error('Cloudflare adapter requires accountId or CLOUDFLARE_ACCOUNT_ID');
    }

    const url = CLOUDFLARE_CHAT_URL.replace('{account_id}', account);

    return {
        async generateCompletion(options: CompletionOptions) {
            const messages: Array<{ role: 'user' | 'system'; content: string }> = [];
            if (options.systemPrompt) {
                messages.push({ role: 'system', content: options.systemPrompt });
            }
            messages.push({ role: 'user', content: options.prompt });

            const body = {
                model,
                messages,
                max_tokens: options.maxTokens ?? 8192,
                ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
            };

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Cloudflare AI error ${res.status}: ${errText}`);
            }

            type MessageLike = {
                content?: string | Array<{ type?: string; text?: string }> | null;
                reasoning_content?: string | null;
                refusal?: string | null;
                parsed?: unknown;
            };
            const data = (await res.json()) as {
                choices?: Array<{ message?: MessageLike }>;
                result?: { response?: string };
                usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            const message = data.choices?.[0]?.message;
            const rawContent = message?.content;
            let content: string | null = null;
            if (typeof rawContent === 'string') {
                content = rawContent;
            } else if (Array.isArray(rawContent)) {
                const textPart = rawContent.find((p) => p?.type === 'text');
                const text = textPart && typeof (textPart as { text?: string }).text === 'string' ? (textPart as { text: string }).text : null;
                content = text;
            }
            if (content == null && message) {
                const rc = message.reasoning_content;
                const ref = message.refusal;
                if (typeof rc === 'string' && rc.length > 0) content = rc;
                else if (typeof ref === 'string' && ref.length > 0) content = ref;
            }
            if (content == null && typeof (data as { result?: { response?: string } }).result?.response === 'string') {
                content = (data as { result: { response: string } }).result.response;
            }
            if (content == null && message && typeof message.parsed !== 'undefined') {
                const parsed = message.parsed;
                content = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
            }
            if (content == null) {
                const shape = {
                    dataKeys: Object.keys(data),
                    choicesLen: data.choices?.length ?? 0,
                    messageKeys: message ? Object.keys(message) : [],
                    rawContentType: rawContent === null || rawContent === undefined ? 'null' : typeof rawContent,
                };
                throw new Error(`Empty response from Cloudflare AI. Shape: ${JSON.stringify(shape)}`);
            }
            const usage = data.usage
                ? { inputTokens: data.usage.prompt_tokens ?? 0, outputTokens: data.usage.completion_tokens ?? 0 }
                : undefined;
            return { text: content.trim(), usage };
        },
    };
}
