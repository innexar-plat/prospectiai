import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { detectLocale, persistLocale, getLocaleStorageKey, isSupportedLocale, type SupportedLocale } from '@/lib/locale';
import { getMarketConfig } from '@/lib/market';
import { createTranslator } from '@/lib/i18n/translate';
import {
    bootstrapLocale,
    loadLocaleBundle,
    preloadLocaleBundle,
} from '@/lib/i18n/locale-bundles';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

interface I18nContextValue {
    t: TranslateFn;
    raw: (prefix: string) => string[];
    locale: SupportedLocale;
    setLocale: (lang: string) => void;
    ready: boolean;
    preloadLocale: (lang: SupportedLocale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const ALL_LOCALES: SupportedLocale[] = ['pt', 'en', 'es'];

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<SupportedLocale>(() => detectLocale());
    const [messages, setMessages] = useState(() => bootstrapLocale(detectLocale()));
    const [ready, setReady] = useState(true);

    useEffect(() => {
        const cached = bootstrapLocale(locale);
        setMessages(cached);
        setReady(true);
        loadLocaleBundle(locale).then((bundle) => {
            setMessages(bundle);
        });
    }, [locale]);

    useEffect(() => {
        fetch('/api/config/public')
            .then((r) => r.json())
            .then((cfg) => {
                const stored = localStorage.getItem(getLocaleStorageKey());
                if (stored) return;
                const marketDefault = cfg.defaultLocale ?? getMarketConfig().defaultLocale;
                if (isSupportedLocale(marketDefault) && marketDefault !== locale) {
                    setLocaleState(marketDefault);
                    persistLocale(marketDefault);
                }
            })
            .catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const defaultLocale = getMarketConfig().defaultLocale;
        ALL_LOCALES.filter((l) => l !== defaultLocale).forEach(preloadLocaleBundle);
    }, []);

    const setLocale = useCallback((lang: string) => {
        const next = detectLocale(lang);
        setLocaleState(next);
        persistLocale(next);
    }, []);

    const preloadLocale = useCallback((lang: SupportedLocale) => {
        preloadLocaleBundle(lang);
    }, []);

    const { t, raw } = useMemo(() => createTranslator(messages), [messages]);

    const value = useMemo<I18nContextValue>(
        () => ({ t, raw, locale, setLocale, ready, preloadLocale }),
        [t, raw, locale, setLocale, ready, preloadLocale],
    );

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nContextValue {
    const ctx = useContext(I18nContext);
    if (!ctx) {
        throw new Error('useI18n must be used within I18nProvider');
    }
    return ctx;
}
