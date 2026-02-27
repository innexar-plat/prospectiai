/**
 * HTTP fetch with timeout and optional retry on 429/5xx.
 * Evita requisições travadas e trata rate limit/erros transitórios.
 */

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_BACKOFF_MS = 1000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchWithRetryOptions {
    timeoutMs?: number;
    maxRetries?: number;
    initialBackoffMs?: number;
    /** Retry when response status is in this set (e.g. 429, 503). */
    retryStatuses?: (status: number) => boolean;
}

const defaultRetryStatuses = (status: number): boolean =>
    status === 429 || (status >= 500 && status < 600);

/**
 * Fetch with timeout (AbortController). Optional retry with exponential backoff on 429/5xx.
 */
export async function fetchWithRetry(
    url: string,
    init: RequestInit,
    options: FetchWithRetryOptions = {}
): Promise<Response> {
    const {
        timeoutMs = DEFAULT_TIMEOUT_MS,
        maxRetries = DEFAULT_MAX_RETRIES,
        initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
        retryStatuses = defaultRetryStatuses,
    } = options;

    let lastRes: Response | null = null;
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const mergedInit: RequestInit = {
            ...init,
            signal: controller.signal,
        };

        try {
            const res = await fetch(url, mergedInit);
            clearTimeout(timeoutId);
            lastRes = res;
            if (attempt < maxRetries && retryStatuses(res.status)) {
                const backoff = initialBackoffMs * Math.pow(2, attempt);
                await sleep(backoff);
                continue;
            }
            return res;
        } catch (err) {
            clearTimeout(timeoutId);
            lastErr = err instanceof Error ? err : new Error(String(err));
            if (attempt < maxRetries) {
                const backoff = initialBackoffMs * Math.pow(2, attempt);
                await sleep(backoff);
                continue;
            }
            throw lastErr;
        }
    }

    if (lastRes) return lastRes;
    throw lastErr ?? new Error('fetchWithRetry failed');
}
