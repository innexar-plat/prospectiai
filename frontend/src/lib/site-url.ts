import { getActiveMarket } from '@/lib/market';

const BR_ORIGIN = 'https://precisionia.com.br';
const US_ORIGIN = 'https://precisionai.innexar.app';

const ALLOWED_ORIGINS = new Set([BR_ORIGIN, US_ORIGIN]);

/** Canonical origin for a market (SSR/build fallback). */
export function getMarketOrigin(market = getActiveMarket()): string {
    return market === 'US' ? US_ORIGIN : BR_ORIGIN;
}

/** Current app origin (browser) or market default. */
export function getAppOrigin(): string {
    if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin;
    }
    return getMarketOrigin();
}

/**
 * Keep redirects/links on the current market domain.
 * Absolute URLs on the sibling market origin are rewritten to the current origin.
 */
export function assertMarketHostname(url: string): string {
    if (!url.startsWith('http')) return url;
    try {
        const parsed = new URL(url);
        if (!ALLOWED_ORIGINS.has(parsed.origin)) return url;
        const current =
            typeof window !== 'undefined' && window.location?.origin
                ? window.location.origin
                : getMarketOrigin();
        if (parsed.origin === current) return url;
        return `${current}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return url;
    }
}
