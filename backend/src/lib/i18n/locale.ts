import type { SupportedLocale } from '@/lib/market';
import { MARKET, getMarketConfig, getRequestMarket, type Market } from '@/lib/market';

export type Locale = SupportedLocale;

const SUPPORTED: Locale[] = ['pt', 'en', 'es'];

export function isSupportedLocale(value: string | null | undefined): value is Locale {
    return value === 'pt' || value === 'en' || value === 'es';
}

export function resolveRequestLocale(acceptLanguage: string | null | undefined, market: Market = MARKET): Locale {
    if (acceptLanguage) {
        const parts = acceptLanguage.split(',').map((p) => p.trim().split(';')[0]?.toLowerCase() ?? '');
        for (const part of parts) {
            if (part.startsWith('pt')) return 'pt';
            if (part.startsWith('es')) return 'es';
            if (part.startsWith('en')) return 'en';
        }
    }
    return getMarketConfig(market).defaultLocale;
}

export function getRequestLocale(req: Request): Locale {
    const xLocale = req.headers.get('x-locale');
    if (isSupportedLocale(xLocale)) return xLocale;
    return resolveRequestLocale(req.headers.get('accept-language'), getRequestMarket(req));
}

/** Locale for AI outputs: body locale → X-Locale header → Accept-Language → market default. */
export function resolveAiRequestLocale(req: Request, bodyLocale?: string | null): Locale {
    if (bodyLocale?.trim()) {
        const base = bodyLocale.split('-')[0]!.toLowerCase();
        if (isSupportedLocale(base)) return base;
    }
    return getRequestLocale(req);
}
