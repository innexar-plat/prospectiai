import type { SupportedLocale } from '@/lib/locale';
import { DASHBOARD_MESSAGES } from '@/lib/i18n/dashboard-messages';
import { COMMON_MESSAGES } from '@/lib/i18n/common-messages';
import { PAGES_MESSAGES } from '@/lib/i18n/pages-messages';
import { SUPPORT_MESSAGES } from '@/lib/i18n/support-messages';
import { LANDING_MESSAGES } from '@/lib/i18n/landing-messages';
import { CONV_MESSAGES } from '@/lib/i18n/conv-messages';
import { LOG_MESSAGES } from '@/lib/i18n/log-messages';
import { LEGAL_MESSAGES } from '@/lib/i18n/legal-messages';
import { CHECKOUT_MESSAGES } from '@/lib/i18n/checkout-messages';

/** Merge all message modules for a single locale (one bundle per language). */
export function buildLocaleMessages(locale: SupportedLocale): Record<string, string> {
    const landing = locale === 'es'
        ? { ...LANDING_MESSAGES.en, ...LANDING_MESSAGES.es }
        : LANDING_MESSAGES[locale];

    return {
        ...DASHBOARD_MESSAGES[locale],
        ...COMMON_MESSAGES[locale],
        ...PAGES_MESSAGES[locale],
        ...SUPPORT_MESSAGES[locale],
        ...landing,
        ...CONV_MESSAGES[locale],
        ...LOG_MESSAGES[locale],
        ...LEGAL_MESSAGES[locale],
        ...CHECKOUT_MESSAGES[locale],
    };
}
