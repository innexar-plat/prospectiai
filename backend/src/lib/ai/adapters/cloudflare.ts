/**
 * Cloudflare Workers AI adapter.
 * Uses OpenAI-compatible endpoint: .../ai/v1/chat/completions
 * Requires CLOUDFLARE_ACCOUNT_ID in env if not passed in options.
 */
import type { CompletionOptions, IAIAdapter } from '../types';

const CLOUDFLARE_CHAT_URL = 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions';

type MessageLike = {
    content?: string | Array<{ type?: string; text?: string }> | Record<string, unknown> | null;
    reasoning_content?: string | null;
    refusal?: string | null;
    parsed?: unknown;
};

function getContentFromRaw(rawContent: MessageLike['content']): string | null {
    if (typeof rawContent === 'string') return rawContent;
    if (Array.isArray(rawContent)) {
        const textPart = rawContent.find((p) => p?.type === 'text');
        const text = textPart && typeof (textPart as { text?: string }).text === 'string' ? (textPart as { text: string }).text : null;
        return text;
    }
    // Some models (e.g. Llama 4 Scout) return content as a single object {type,text}
    if (rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent)) {
        const obj = rawContent as Record<string, unknown>;
        if (typeof obj.text === 'string') return obj.text;
        // Fallback: try JSON.stringify if it looks like data
        return JSON.stringify(obj);
    }
    return null;
}

function getContentFromMessage(message: MessageLike | undefined): string | null {
    if (!message) return null;
    const rc = message.reasoning_content;
    const ref = message.refusal;
    if (typeof rc === 'string' && rc.length > 0) return rc;
    if (typeof ref === 'string' && ref.length > 0) return ref;
    if (typeof message.parsed !== 'undefined') {
        const parsed = message.parsed;
        return typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    }
    return null;
}

function parseCloudflareContent(data: {
    choices?: Array<{ message?: MessageLike }>;
    result?: { response?: string };
}): string {
    const message = data.choices?.[0]?.message;
    const rawContent = message?.content;
    let content: string | null = getContentFromRaw(rawContent);
    if (content == null) content = getContentFromMessage(message);
    if (content == null && typeof data.result?.response === 'string') content = data.result.response;
    if (content == null) {
        const shape = {
            dataKeys: Object.keys(data),
            choicesLen: data.choices?.length ?? 0,
            messageKeys: message ? Object.keys(message) : [],
            rawContentType: rawContent === null || rawContent === undefined ? 'null' : typeof rawContent,
        };
        throw new Error(`Empty response from Cloudflare AI. Shape: ${JSON.stringify(shape)}`);
    }
    return content.trim();
}

type CloudflareResponse = {
    choices?: Array<{ message?: MessageLike }>;
    result?: { response?: string };
    usage?: { prompt_tokens?: number; completion_tokens?: number };
};

const CLOUDFLARE_TIMEOUT_MS = 90000;
const CLOUDFLARE_MAX_RETRIES = 2;

function cfSleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCloudflareCompletion(
    url: string,
    apiKey: string,
    body: Record<string, unknown>,
): Promise<{ text: string; usage?: { inputTokens: number; outputTokens: number } }> {
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt <= CLOUDFLARE_MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CLOUDFLARE_TIMEOUT_MS);
        const startMs = Date.now();
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const elapsed = Date.now() - startMs;

            // Retry on 520 (Cloudflare transient) or 5xx
            if (!res.ok && attempt < CLOUDFLARE_MAX_RETRIES && (res.status === 520 || res.status >= 500)) {
                console.error(`[CF-AI] Attempt ${attempt + 1} failed: status ${res.status} (${elapsed}ms)`);
                const backoff = 2000 * Math.pow(2, attempt);
                await cfSleep(backoff);
                continue;
            }
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Cloudflare AI error ${res.status}: ${errText}`);
            }
            const data = (await res.json()) as CloudflareResponse;
            const text = parseCloudflareContent(data);
            const usage = data.usage
                ? { inputTokens: data.usage.prompt_tokens ?? 0, outputTokens: data.usage.completion_tokens ?? 0 }
                : undefined;
            console.log(`[CF-AI] OK in ${elapsed}ms, tokens: in=${usage?.inputTokens ?? '?'} out=${usage?.outputTokens ?? '?'}`);
            return { text, usage };
        } catch (err) {
            clearTimeout(timeoutId);
            const elapsed = Date.now() - startMs;
            lastErr = err instanceof Error ? err : new Error(String(err));
            console.error(`[CF-AI] Attempt ${attempt + 1} error after ${elapsed}ms: ${lastErr.message}`);
            if (attempt < CLOUDFLARE_MAX_RETRIES) {
                const backoff = 2000 * Math.pow(2, attempt);
                await cfSleep(backoff);
                continue;
            }
            throw lastErr;
        }
    }

    throw lastErr ?? new Error('Cloudflare AI request failed');
}

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
            if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
            messages.push({ role: 'user', content: options.prompt });
            const body = {
                model,
                messages,
                max_tokens: options.maxOutputTokens ?? 8192,
                ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
            };
            return runCloudflareCompletion(url, apiKey, body);
        },
    };
}
