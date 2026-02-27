'use client';

import { useState } from 'react';
import { Link } from 'react-router-dom';
import LandingPage from '@/components/landing/LandingPage';
import Pricing from '@/components/dashboard/billing/Pricing';
import Header from '@/components/layout/Header';
import CookieConsent from '@/components/legal/CookieConsent';
import { useI18n } from '@/lib/i18n';

export default function PublicEntryClient({ locale: initialLocale }: { locale: string }) {
    const { t, raw, locale, setLocale } = useI18n(initialLocale);
    const [view, setView] = useState<'landing' | 'pricing'>('landing');

    const switchLanguage = (lang: string) => {
        setLocale(lang);
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <a
                href="#main-content"
                className="absolute -left-[9999px] top-4 z-[60] px-4 py-2 bg-violet-600 text-white rounded-xl font-bold focus:left-4 focus:inline-block"
            >
                {t('a11y.skipToContent')}
            </a>
            <Header
                session={null}
                locale={locale}
                onLanguageSwitch={switchLanguage}
                resultsLength={0}
                isPremiumPlan={false}
                onExport={() => { }}
                onPricingRedirect={() => setView('pricing')}
                t={t}
            />

            <main id="main-content" className="flex-1 flex flex-col" role="main">
                {view === 'pricing' ? (
                    <Pricing locale={locale} currentPlan="FREE" onBack={() => setView('landing')} userEmail="" t={t} tRaw={raw} />
                ) : (
                    <LandingPage locale={locale} onViewPlans={() => setView('pricing')} t={t} />
                )}
            </main>

            <footer className="py-6 px-8 border-t border-border" role="contentinfo">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm text-muted">
                    <span>{t('footer.copy', { year: new Date().getFullYear() })}</span>
                    <nav className="flex flex-wrap items-center justify-center gap-4" aria-label="Legal e acessibilidade">
                        <Link to="/privacy" className="text-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
                            {t('footer.privacy')}
                        </Link>
                        <Link to="/terms" className="text-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
                            {t('footer.terms')}
                        </Link>
                        <Link to="/privacy#cookies" className="text-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
                            {t('footer.cookies')}
                        </Link>
                        <span className="sr-only">{t('footer.a11y')}: navegação por teclado e leitores de tela suportados.</span>
                    </nav>
                </div>
            </footer>

            <CookieConsent t={(k) => t(k)} />
        </div>
    );
}
