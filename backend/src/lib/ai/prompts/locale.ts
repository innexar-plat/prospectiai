import type { Locale } from '@/lib/i18n/locale';
import { normalizeAnalyzeLocale } from '@/lib/i18n/analysis-error-messages';

export type AiPromptLocale = Locale;

export function isEnglishAiLocale(locale: string): boolean {
    return normalizeAnalyzeLocale(locale) === 'en';
}

export function isSpanishAiLocale(locale: string): boolean {
    return normalizeAnalyzeLocale(locale) === 'es';
}

/** Strong language rule appended to intelligence-module prompts. */
export function getAiLanguageRule(locale: string): string {
    const lang = normalizeAnalyzeLocale(locale);
    if (lang === 'en') {
        return 'CRITICAL: Respond ONLY in English. All JSON string values must be in English.';
    }
    if (lang === 'es') {
        return 'CRÍTICO: Responda SOLO en Español. Todos los valores string del JSON deben estar en Español.';
    }
    return 'CRÍTICO: Responda APENAS em Português. Todos os valores string do JSON devem estar em Português.';
}

export function reviewsCountLabel(locale: string): string {
    const lang = normalizeAnalyzeLocale(locale);
    if (lang === 'en') return 'reviews';
    if (lang === 'es') return 'reseñas';
    return 'avaliações';
}

export function notInformedLabel(locale: string): string {
    const lang = normalizeAnalyzeLocale(locale);
    if (lang === 'en') return 'not provided';
    if (lang === 'es') return 'no informado';
    return 'não informado';
}
