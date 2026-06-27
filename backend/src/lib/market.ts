/**
 * Market configuration — BR (Brazil) vs US (United States).
 * Set MARKET=US|BR in backend env; defaults to BR.
 */

import type { PlanType } from '@/lib/billing-config';
import { PLANS } from '@/lib/billing-config';
import { resolveCountryLocale } from '@/lib/country-locale';

export type Market = 'BR' | 'US';
export type SupportedLocale = 'pt' | 'en' | 'es';

export const MARKET: Market = process.env.MARKET === 'US' ? 'US' : 'BR';

const US_HOSTS = new Set([
    'precisionai.innexar.app',
    'www.precisionai.innexar.app',
]);

/** Resolve market from Host / X-Forwarded-Host (multi-domain single stack). */
export function resolveMarketFromHost(host: string | null | undefined): Market | null {
    if (!host) return null;
    const normalized = host.toLowerCase().split(':')[0]?.trim() ?? '';
    if (US_HOSTS.has(normalized)) return 'US';
    if (normalized === 'precisionia.com.br' || normalized.endsWith('.precisionia.com.br')) return 'BR';
    if (normalized === 'busca.innexar.com.br') return 'BR';
    return null;
}

const MARKET_HEADER = 'x-prospector-market';
const MARKET_COOKIE = 'prospector-market';

function parseMarketValue(value: string | null | undefined): Market | null {
    const normalized = value?.trim().toUpperCase();
    if (normalized === 'US') return 'US';
    if (normalized === 'BR') return 'BR';
    return null;
}

function parseMarketFromCookie(cookieHeader: string | null): Market | null {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${MARKET_COOKIE}=(BR|US)(?:;|$)`, 'i'));
    return parseMarketValue(match?.[1]);
}

/** Country code/label for search geocoding — body wins, else request market default. */
export function resolveSearchCountry(req: Request, bodyCountry?: string | null): string {
    const trimmed = bodyCountry?.trim();
    if (trimmed) return trimmed;
    return getMarketConfig(getRequestMarket(req)).defaultCountry;
}

/** Intelligence modules: body country wins, then user/request market. */
export function resolveAnalysisMarket(
    req: Request,
    bodyCountry?: string | null,
    userMarket?: Market | null,
): Market {
    const country = resolveSearchCountry(req, bodyCountry);
    const region = resolveCountryLocale(country).regionCode;
    if (region === 'US') return 'US';
    if (userMarket === 'US' || getRequestMarket(req) === 'US') return 'US';
    return 'BR';
}

export function getRequestMarket(req: Request): Market {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    const fromHost = resolveMarketFromHost(host);
    if (fromHost) return fromHost;

    const fromHeader = parseMarketValue(req.headers.get(MARKET_HEADER));
    if (fromHeader) return fromHeader;

    const fromCookie = parseMarketFromCookie(req.headers.get('cookie'));
    if (fromCookie) return fromCookie;

    return MARKET;
}

export interface MarketFeatures {
    trial: boolean;
    rfSearch: boolean;
    cnae: boolean;
    smartRelations: boolean;
    autoProspeccao: boolean;
    reclameAqui: boolean;
    jusBrasil: boolean;
    mercadoPago: boolean;
    crmBr: boolean;
}

export interface MarketPlanOverrides {
    leadsLimit?: Partial<Record<PlanType, number>>;
    usdPrices?: Partial<Record<Exclude<PlanType, 'FREE' | 'TRIAL'>, number>>;
}

export interface MarketConfig {
    market: Market;
    defaultLocale: SupportedLocale;
    defaultCountry: string;
    currency: 'BRL' | 'USD';
    checkoutLocale: 'pt' | 'en';
    appName: string;
    features: MarketFeatures;
    planOverrides: MarketPlanOverrides;
}

const BR_CONFIG: MarketConfig = {
    market: 'BR',
    defaultLocale: 'pt',
    defaultCountry: 'BR',
    currency: 'BRL',
    checkoutLocale: 'pt',
    appName: 'Precision IA',
    features: {
        trial: true,
        rfSearch: true,
        cnae: true,
        smartRelations: true,
        autoProspeccao: true,
        reclameAqui: true,
        jusBrasil: true,
        mercadoPago: true,
        crmBr: true,
    },
    planOverrides: {},
};

const US_CONFIG: MarketConfig = {
    market: 'US',
    defaultLocale: 'en',
    defaultCountry: 'US',
    currency: 'USD',
    checkoutLocale: 'en',
    appName: 'Precision AI',
    features: {
        trial: false,
        rfSearch: false,
        cnae: false,
        smartRelations: false,
        autoProspeccao: false,
        reclameAqui: false,
        jusBrasil: false,
        mercadoPago: false,
        crmBr: false,
    },
    planOverrides: {
        leadsLimit: { BASIC: 50 },
        usdPrices: { BASIC: 19, PRO: 49, BUSINESS: 99, SCALE: 249 },
    },
};

export function getMarketConfig(market: Market = MARKET): MarketConfig {
    return market === 'US' ? US_CONFIG : BR_CONFIG;
}

export function isMarketFeatureEnabled(
    feature: keyof MarketFeatures,
    market: Market = MARKET,
): boolean {
    return getMarketConfig(market).features[feature];
}

/** Credits/leads limit for a plan in the current market. */
export function getMarketLeadsLimit(planKey: PlanType, market: Market = MARKET): number {
    const config = getMarketConfig(market);
    return config.planOverrides.leadsLimit?.[planKey] ?? PLANS[planKey].leadsLimit;
}

export function isTrialEnabled(market: Market = MARKET): boolean {
    return getMarketConfig(market).features.trial;
}
