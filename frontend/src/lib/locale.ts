import { getActiveMarket, getMarketConfig } from '@/lib/market';

export type SupportedLocale = 'pt' | 'en' | 'es';

/** @deprecated Use getLocaleStorageKey() — kept for backward-compatible test imports */
export const LOCALE_STORAGE_KEY = 'prospector-locale';
const SUPPORTED: SupportedLocale[] = ['pt', 'en', 'es'];

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
    return value === 'pt' || value === 'en' || value === 'es';
}

/** Per-market locale preference (BR vs US do not share the same stored language). */
export function getLocaleStorageKey(market = getActiveMarket()): string {
    return `prospector-locale-${market.toLowerCase()}`;
}

function readStoredLocale(): SupportedLocale | null {
    try {
        const marketKey = getLocaleStorageKey();
        const fromMarket = localStorage.getItem(marketKey);
        if (isSupportedLocale(fromMarket)) return fromMarket;

        // Legacy key: only honor on BR market (avoid PT leaking into US domain)
        if (getActiveMarket() === 'BR') {
            const legacy = localStorage.getItem(LOCALE_STORAGE_KEY);
            if (isSupportedLocale(legacy)) {
                localStorage.setItem(marketKey, legacy);
                return legacy;
            }
        }
    } catch { /* private browsing */ }
    return null;
}

/** Browser + stored preference + market default. */
export function detectLocale(pathLocale?: string, stored?: string | null): SupportedLocale {
    if (pathLocale && isSupportedLocale(pathLocale)) return pathLocale;
    if (stored && isSupportedLocale(stored)) return stored;

    const fromStorage = readStoredLocale();
    if (fromStorage) return fromStorage;

    return getMarketConfig().defaultLocale;
}

/** Normalize BCP-47 tags (e.g. pt-BR, en-US) to supported analyze/UI locale. */
export function normalizeAnalyzeLocale(value: string | null | undefined): SupportedLocale {
    if (!value) return getMarketConfig().defaultLocale;
    const base = value.split('-')[0].toLowerCase();
    if (isSupportedLocale(base)) return base;
    return getMarketConfig().defaultLocale;
}

export function persistLocale(locale: SupportedLocale): void {
    try {
        const key = getLocaleStorageKey();
        localStorage.setItem(key, locale);
        if (getActiveMarket() === 'BR') {
            localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        }
    } catch { /* ignore */ }
}

export { SUPPORTED };
