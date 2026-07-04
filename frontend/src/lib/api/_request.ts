import type { SupportedLocale } from '@/lib/locale';
import { detectLocale } from '@/lib/locale';
import { getActiveMarket } from '@/lib/market';

const BASE = '/api';
let authRedirectInProgress = false;

export function buildApiHeaders(localeOverride?: SupportedLocale): Record<string, string> {
    const locale = localeOverride ?? detectLocale();
    return {
        'X-Prospector-Market': getActiveMarket(),
        'X-Locale': locale,
    };
}

function shouldSkipUnauthorizedRedirect(path: string): boolean {
    return path.startsWith('/auth/register')
        || path.startsWith('/auth/forgot-password')
        || path.startsWith('/auth/reset-password')
        || path.startsWith('/auth/resend-verification')
        || path.startsWith('/auth/verify-email')
        || path.startsWith('/auth/csrf')
        || path.startsWith('/auth/callback');
}

function handleUnauthorized(path: string): void {
    const win = globalThis.window;
    if (!win) return;
    if (authRedirectInProgress) return;
    if (shouldSkipUnauthorizedRedirect(path)) return;

    const pathname = win.location.pathname || '';
    if (pathname.startsWith('/auth/')) return;

    authRedirectInProgress = true;
    const callbackUrl = `${pathname}${win.location.search || ''}${win.location.hash || ''}` || '/dashboard';
    const target = `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    win.location.replace(target);
}

export function __resetAuthRedirectForTests(): void {
    authRedirectInProgress = false;
}

/** Simple exponential-backoff retry for fetch requests. Retries on 5xx and network errors. */
export async function requestWithRetry<T>(path: string, options: RequestInit = {}, maxRetries = 2): Promise<T> {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(`${BASE}${path}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...buildApiHeaders(),
                    ...options.headers,
                },
                ...options,
            });
            // Retry on 503/502/520 (transient)
            if (!res.ok && attempt < maxRetries && (res.status === 503 || res.status === 502 || res.status === 520)) {
                await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
                continue;
            }
            if (!res.ok) {
                if (res.status === 401) {
                    handleUnauthorized(path);
                }
                const err = await res.json().catch(() => ({ error: res.statusText }));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            return res.json();
        } catch (err) {
            lastErr = err instanceof Error ? err : new Error(String(err));
            if (attempt < maxRetries) {
                await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
                continue;
            }
        }
    }
    throw lastErr ?? new Error('Request failed');
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...buildApiHeaders(),
            ...options.headers,
        },
        ...options,
    });

    if (!res.ok) {
        if (res.status === 401) {
            handleUnauthorized(path);
        }
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
}
