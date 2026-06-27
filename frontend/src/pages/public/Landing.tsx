'use client';

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LandingPage from '@/components/landing/LandingPage';
import LandingConversion from '@/components/landing/LandingConversion';
import Header from '@/components/layout/Header';
import CookieConsent from '@/components/legal/CookieConsent';
import { useI18n } from '@/lib/i18n';
import { captureRefFromUrl } from '@/lib/affiliate-ref';
import { getActiveMarket } from '@/lib/market';

export default function PublicEntryClient({ locale: initialLocale }: { locale: string }) {
    const { t, locale, setLocale } = useI18n();
    const navigate = useNavigate();

    useEffect(() => {
        if (initialLocale) setLocale(initialLocale);
    }, [initialLocale, setLocale]);

    useEffect(() => {
        captureRefFromUrl();
    }, []);

    const switchLanguage = (lang: string) => {
        setLocale(lang);
    };

    /** Planos/Assinar na landing levam ao cadastro; upgrade real fica em /dashboard/planos (após login). */
    const goToSignup = () => navigate('/auth/signup');
    const goToPricing = () => navigate(locale === 'pt' ? '/pt/pricing' : locale === 'es' ? '/es/pricing' : '/en/pricing');

    const isUsMarket = getActiveMarket() === 'US';

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
                onPricingRedirect={goToPricing}
                t={t}
            />

            <main id="main-content" className="flex-1 flex flex-col" role="main">
                {isUsMarket ? (
                    <LandingConversion locale={locale} t={t} onSignup={goToSignup} onPricing={goToPricing} />
                ) : (
                    <LandingPage locale={locale} onViewPlans={goToPricing} t={t} />
                )}
            </main>

            <footer className="py-6 px-8 border-t border-border" role="contentinfo">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm text-muted">
                    <span>{t('footer.copy', { year: new Date().getFullYear() })}</span>
                    <nav className="flex flex-wrap items-center justify-center gap-4" aria-label={t('footer.navAriaLabel')}>
                        {!isUsMarket && (
                            <>
                                <Link to="/mapa-do-site" className="text-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
                                    Mapa do site
                                </Link>
                                <Link to="/blog" className="text-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
                                    Blog
                                </Link>
                                <Link to="/integracoes/rdstation" className="text-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
                                    Integracao RD Station
                                </Link>
                                <Link to="/integracoes/agendor" className="text-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
                                    Integracao Agendor
                                </Link>
                                <Link to="/integracoes/hubspot" className="text-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
                                    Integracao HubSpot
                                </Link>
                            </>
                        )}
                        <Link to="/privacy" className="text-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
                            {t('footer.privacy')}
                        </Link>
                        <Link to="/terms" className="text-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
                            {t('footer.terms')}
                        </Link>
                        <Link to="/privacy#cookies" className="text-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
                            {t('footer.cookies')}
                        </Link>
                        <span className="sr-only">{t('footer.a11y')}: {t('footer.a11yHint')}</span>
                    </nav>
                </div>
            </footer>

            <CookieConsent t={(k) => t(k)} />
        </div>
    );
}
