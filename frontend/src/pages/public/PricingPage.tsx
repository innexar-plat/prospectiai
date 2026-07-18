'use client';

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import Header from '@/components/layout/Header';
import CookieConsent from '@/components/legal/CookieConsent';
import SeoMeta from '@/components/layout/SeoMeta';
import BreadcrumbJsonLd from '@/components/layout/BreadcrumbJsonLd';
import { useI18n } from '@/lib/i18n';
import { PLANS, PUBLIC_PLAN_KEYS, type PlanType } from '@/lib/billing-config';
import { getActiveMarket, getMarketConfig, US_STARTER_CREDITS } from '@/lib/market';
import { Button } from '@/components/ui/Button';

function getDisplayCredits(planKey: PlanType): number {
    if (getActiveMarket() === 'US' && planKey === 'BASIC') return US_STARTER_CREDITS;
    return PLANS[planKey].leadsLimit;
}

function formatPrice(planKey: PlanType, cycle: 'monthly' | 'annual'): { amount: string; currency: string } {
    const config = getMarketConfig(getActiveMarket());
    const plan = PLANS[planKey];
    const prices = plan[cycle];
    if (config.currency === 'USD') {
        const usdMap: Record<string, number> = { BASIC: 19, PRO: 49, BUSINESS: 99, SCALE: 249 };
        let usd = usdMap[planKey] ?? prices.price_usd;
        if (cycle === 'annual') usd = Math.round(usd * 10);
        return { amount: `$${usd}`, currency: 'USD' };
    }
    const brl = cycle === 'monthly' ? prices.price_brl : prices.price_brl * 10;
    return { amount: `R$ ${brl.toLocaleString('pt-BR')}`, currency: 'BRL' };
}

export default function PricingPage({ locale: initialLocale }: { locale: string }) {
    const { t, locale, setLocale } = useI18n();
    const navigate = useNavigate();

    useEffect(() => {
        if (initialLocale) setLocale(initialLocale);
    }, [initialLocale, setLocale]);

    const goSignup = () => navigate('/auth/signup');

    const market = getActiveMarket();
    const seoTitle = market === 'US'
        ? t('billing.title')
        : 'Preços | Precision — Planos de Prospecção B2B';
    const seoDesc = market === 'US'
        ? 'Precision pricing: Starter plan at $19/mo with 50 credits. AI prospecting, lead scoring, and team workspaces.'
        : 'Planos acessíveis para prospecção B2B com IA. A partir de R$ 49/mês com 50 créditos. Score IA, exportação para CRM e workspace de equipe.';

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <SeoMeta
                title={seoTitle}
                description={seoDesc}
                path={`/${locale === 'pt' ? '' : locale + '/'}pricing`}
            />
            <BreadcrumbJsonLd items={[
                { name: 'Início', path: '/' },
                { name: seoTitle, path: `/${locale === 'pt' ? '' : locale + '/'}pricing` },
            ]} />
            <Header
                session={null}
                locale={locale}
                onLanguageSwitch={setLocale}
                resultsLength={0}
                isPremiumPlan={false}
                onExport={() => {}}
                onPricingRedirect={goSignup}
                t={t}
            />
            <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12 sm:py-16">
                <div className="text-center mb-10">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-4">
                        {t('pricing.starterBadge')} — {formatPrice('BASIC', 'monthly').amount} · {getDisplayCredits('BASIC')} {t('pricing.creditsMonth')}
                    </span>
                    <h1 className="text-3xl sm:text-4xl font-black text-foreground">{t('billing.title')}</h1>
                    <p className="text-muted mt-3 max-w-2xl mx-auto">{t('pricing.subtitle')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-12">
                    {PUBLIC_PLAN_KEYS.map((key) => {
                        const plan = PLANS[key];
                        const monthly = formatPrice(key, 'monthly');
                        const popular = key === 'PRO';
                        return (
                            <div
                                key={key}
                                className={`rounded-3xl border p-6 flex flex-col bg-card ${popular ? 'border-violet-500/40 ring-2 ring-violet-500/20' : 'border-border'}`}
                            >
                                {popular && (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400 mb-2">
                                        {t('billing.popular')}
                                    </span>
                                )}
                                <h2 className="text-lg font-bold text-foreground">{plan.name}</h2>
                                <p className="text-3xl font-black text-foreground mt-2">
                                    {monthly.amount}
                                    <span className="text-sm font-medium text-muted">/{t('billing.perMonth')}</span>
                                </p>
                                <p className="text-xs text-muted mt-1">{getDisplayCredits(key)} {t('pricing.creditsMonth')}</p>
                                <ul className="mt-4 space-y-2 flex-1 text-sm text-muted">
                                    <li className="flex items-start gap-2">
                                        <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                        {t('pricing.featureSearch')}
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                        {t('pricing.featureAi')}
                                    </li>
                                    {key !== 'BASIC' && (
                                        <li className="flex items-start gap-2">
                                            <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                            {t('pricing.featureAdvanced')}
                                        </li>
                                    )}
                                </ul>
                                <Button variant={popular ? 'primary' : 'secondary'} className="w-full mt-6" onClick={goSignup}>
                                    {t('pricing.ctaSubscribe')}
                                </Button>
                            </div>
                        );
                    })}
                </div>

                <p className="text-center text-xs text-muted">
                    {getActiveMarket() === 'US' ? t('pricing.usNote') : t('pricing.brNote')}
                </p>
                <div className="text-center mt-6">
                    <Link to="/" className="text-sm text-violet-600 dark:text-violet-400 hover:underline">
                        ← {t('pricing.backHome')}
                    </Link>
                </div>
            </main>
            <CookieConsent t={t} />
        </div>
    );
}
