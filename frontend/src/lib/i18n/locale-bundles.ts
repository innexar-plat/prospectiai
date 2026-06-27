import type { SupportedLocale } from '@/lib/locale';
import { buildLocaleMessages } from '@/lib/i18n/merge';

export type MessageDict = Record<string, string>;

const cache = new Map<SupportedLocale, MessageDict>();
const inflight = new Map<SupportedLocale, Promise<MessageDict>>();

const loaders: Record<SupportedLocale, () => Promise<{ default: MessageDict }>> = {
    pt: () => import('./bundles/pt'),
    en: () => import('./bundles/en'),
    es: () => import('./bundles/es'),
};

export function getCachedLocaleBundle(locale: SupportedLocale): MessageDict | undefined {
    return cache.get(locale);
}

/** Sync bootstrap for the active locale (avoids untranslated flash on first paint). */
export function bootstrapLocale(locale: SupportedLocale): MessageDict {
    const cached = cache.get(locale);
    if (cached) return cached;
    const bundle = buildLocaleMessages(locale);
    cache.set(locale, bundle);
    return bundle;
}

export function loadLocaleBundle(locale: SupportedLocale): Promise<MessageDict> {
    const cached = cache.get(locale);
    if (cached) return Promise.resolve(cached);

    let pending = inflight.get(locale);
    if (!pending) {
        pending = loaders[locale]().then((mod) => {
            cache.set(locale, mod.default);
            inflight.delete(locale);
            return mod.default;
        });
        inflight.set(locale, pending);
    }
    return pending;
}

export function preloadLocaleBundle(locale: SupportedLocale): void {
    if (cache.has(locale)) return;
    loadLocaleBundle(locale).catch(() => {});
}
