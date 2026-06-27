/**
 * Frontend market config — mirrors backend MARKET env via Vite.
 */

export type Market = 'BR' | 'US';
export type SupportedLocale = 'pt' | 'en' | 'es';

export const MARKET: Market =
    (import.meta.env.VITE_MARKET as Market | undefined) === 'US' ? 'US' : 'BR';

const US_HOST_PATTERN = /(^|\.)precisionai\.innexar\.app$/i;
export const MARKET_COOKIE = 'prospector-market';

function detectMarketFromHost(hostname: string): Market | null {
    const host = hostname.toLowerCase();
    if (US_HOST_PATTERN.test(host)) return 'US';
    if (host === 'precisionia.com.br' || host.endsWith('.precisionia.com.br')) return 'BR';
    if (host === 'busca.innexar.com.br') return 'BR';
    return null;
}

function readStoredMarket(): Market | null {
    try {
        const fromCookie = document.cookie
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${MARKET_COOKIE}=`))
            ?.split('=')[1];
        if (fromCookie === 'US' || fromCookie === 'BR') return fromCookie;
    } catch { /* ignore */ }
    return null;
}

/** Persist market preference (hostname wins on next visit). */
export function persistMarket(market: Market): void {
    if (typeof document === 'undefined') return;
    try {
        const secure = globalThis.location?.protocol === 'https:' ? ';Secure' : '';
        document.cookie = `${MARKET_COOKIE}=${market};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax${secure}`;
    } catch { /* private browsing */ }
}

/** Runtime market from hostname (multi-domain deploy) or build-time VITE_MARKET. */
export function getActiveMarket(): Market {
    if (typeof window !== 'undefined') {
        const fromHost = detectMarketFromHost(window.location.hostname);
        if (fromHost) {
            persistMarket(fromHost);
            return fromHost;
        }
        const stored = readStoredMarket();
        if (stored) return stored;
    }
    return MARKET;
}

export interface MarketFeatures {
    trial: boolean;
    rfSearch: boolean;
    cnae: boolean;
    smartRelations: boolean;
    autoProspeccao: boolean;
    reclameAqui: boolean;
    mercadoPago: boolean;
    crmBr: boolean;
}

export interface MarketConfig {
    market: Market;
    defaultLocale: SupportedLocale;
    defaultCountry: string;
    currency: 'BRL' | 'USD';
    appName: string;
    features: MarketFeatures;
}

const BR_CONFIG: MarketConfig = {
    market: 'BR',
    defaultLocale: 'pt',
    defaultCountry: 'BR',
    currency: 'BRL',
    appName: 'Precision',
    features: {
        trial: true,
        rfSearch: true,
        cnae: true,
        smartRelations: true,
        autoProspeccao: true,
        reclameAqui: true,
        mercadoPago: true,
        crmBr: true,
    },
};

const US_CONFIG: MarketConfig = {
    market: 'US',
    defaultLocale: 'en',
    defaultCountry: 'US',
    currency: 'USD',
    appName: 'Precision',
    features: {
        trial: false,
        rfSearch: false,
        cnae: false,
        smartRelations: false,
        autoProspeccao: false,
        reclameAqui: false,
        mercadoPago: false,
        crmBr: false,
    },
};

export function getMarketConfig(market: Market = getActiveMarket()): MarketConfig {
    return market === 'US' ? US_CONFIG : BR_CONFIG;
}

export function isMarketFeatureEnabled(feature: keyof MarketFeatures): boolean {
    return getMarketConfig().features[feature];
}

export function isTrialEnabled(): boolean {
    return getMarketConfig().features.trial;
}

/** FREE user with no credits must subscribe before prospecting (BR and US). */
export function needsSubscription(user: { plan?: string; leadsLimit?: number }): boolean {
    return user.plan === 'FREE' && (user.leadsLimit ?? 0) <= 0;
}

export function getDefaultSearchCountry(): string {
    return getMarketConfig().defaultCountry;
}

export const US_STARTER_CREDITS = 50;
export const US_STARTER_PRICE_USD = 19;

const US_PLAN_LEADS_OVERRIDES: Partial<Record<string, number>> = {
    BASIC: US_STARTER_CREDITS,
};

/** Apply market-specific leads/credits overrides (US Starter = 50). */
export function resolveMarketLeadsLimit(planKey: string, defaultLimit: number): number {
    if (getActiveMarket() === 'US' && planKey in US_PLAN_LEADS_OVERRIDES) {
        return US_PLAN_LEADS_OVERRIDES[planKey]!;
    }
    return defaultLimit;
}
