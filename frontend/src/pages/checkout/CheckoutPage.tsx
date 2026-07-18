import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    CreditCard,
    Zap,
    Crown,
    Rocket,
    Check,
    Loader2,
    ArrowUpRight,
    RefreshCw,
    LogOut,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { authApi, billingApi, plansApi, type PlanFromApi, type PromoValidateResponse, type SessionUser } from '@/lib/api';
import { getAffiliateRef, getRepCode } from '@/lib/affiliate-ref';
import { useI18n } from '@/lib/i18n';
import { getActiveMarket, getMarketConfig } from '@/lib/market';
import { isCheckoutDone, markCheckoutDone } from '@/lib/post-auth-redirect';

const FREE_PLAN_CREDITS = 10;

type BillingCycle = 'monthly' | 'annual';
type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const PLAN_UI: Record<string, { icon: LucideIcon; color: string; borderColor: string; popular?: boolean; billingPrefix?: string }> = {
    FREE: { icon: Zap, color: 'text-zinc-600 dark:text-zinc-400', borderColor: 'border-zinc-500/20' },
    BASIC: { icon: CreditCard, color: 'text-blue-600 dark:text-blue-400', borderColor: 'border-blue-500/20', billingPrefix: 'billing.basic' },
    PRO: { icon: Crown, color: 'text-violet-600 dark:text-violet-400', borderColor: 'border-violet-500/30', popular: true, billingPrefix: 'billing.pro' },
    BUSINESS: { icon: Rocket, color: 'text-amber-600 dark:text-amber-400', borderColor: 'border-amber-500/20', billingPrefix: 'billing.business' },
    SCALE: { icon: Rocket, color: 'text-amber-600 dark:text-amber-400', borderColor: 'border-amber-500/20', billingPrefix: 'billing.business' },
};

function getDateLocale(locale: string): string {
    if (locale === 'pt') return 'pt-BR';
    if (locale === 'es') return 'es-ES';
    return 'en-US';
}

function formatPlanPrice(value: number, currency: 'BRL' | 'USD'): string {
    if (value === 0) return currency === 'USD' ? '$0' : 'R$ 0';
    if (currency === 'USD') {
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getPlanPrice(plan: PlanFromApi, cycle: BillingCycle, currency: 'BRL' | 'USD'): number {
    if (currency === 'USD') {
        return cycle === 'annual' ? (plan.priceAnnualUsd ?? 0) : (plan.priceMonthlyUsd ?? 0);
    }
    return cycle === 'annual' ? plan.priceAnnualBrl : plan.priceMonthlyBrl;
}

function BillingCycleToggle({ cycle, onChange, t }: { cycle: BillingCycle; onChange: (c: BillingCycle) => void; t: TranslateFn }) {
    const isAnnual = cycle === 'annual';
    return (
        <div className="flex items-center justify-center gap-3 mb-6">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-foreground' : 'text-muted'}`}>{t('billing.monthlyLabel')}</span>
            <button
                type="button"
                onClick={() => onChange(isAnnual ? 'monthly' : 'annual')}
                className="relative inline-flex h-7 w-14 items-center rounded-full transition-colors bg-surface border border-border hover:border-violet-500/40"
                aria-label={t('dash.planos.toggleBilling')}
            >
                <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-violet-500 transition-transform ${isAnnual ? 'translate-x-8' : 'translate-x-1'}`}
                />
            </button>
            <span className={`text-sm font-medium ${isAnnual ? 'text-foreground' : 'text-muted'}`}>
                {t('billing.annualLabel')}
                <span className="ml-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">{t('billing.offLabel')}</span>
            </span>
        </div>
    );
}

function getPlanDisplayPrice(
    plan: PlanFromApi,
    cycle: BillingCycle,
    currency: 'BRL' | 'USD',
    promo: PromoValidateResponse | null,
): { price: number; regularPrice?: number; hasPromo: boolean } {
    const base = getPlanPrice(plan, cycle, currency);
    if (
        plan.key === 'BASIC'
        && cycle === 'monthly'
        && currency === 'BRL'
        && promo?.eligible
    ) {
        return {
            price: promo.priceMonthlyBrl,
            regularPrice: promo.regularPriceMonthlyBrl,
            hasPromo: true,
        };
    }
    if (plan.promo?.eligible && plan.key === 'BASIC' && cycle === 'monthly' && currency === 'BRL') {
        return {
            price: plan.promo.priceMonthlyBrl,
            regularPrice: plan.promo.regularPriceMonthlyBrl,
            hasPromo: true,
        };
    }
    return { price: base, hasPromo: false };
}

export default function CheckoutPage({ user }: { user: SessionUser }) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { t, raw, locale, setLocale } = useI18n();
    const { addToast } = useToast();
    const market = getActiveMarket();
    const [resolvedCurrency, setResolvedCurrency] = useState<'BRL' | 'USD'>(getMarketConfig(market).currency);
    const currency = resolvedCurrency;
    const checkoutLocale = getMarketConfig(market).defaultLocale;
    const [plans, setPlans] = useState<PlanFromApi[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);
    const [plansError, setPlansError] = useState<string | null>(null);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
    const [promoState, setPromoState] = useState<PromoValidateResponse | null>(null);
    const [ready, setReady] = useState(false);
    const promoParam = searchParams.get('promo');
    const promoToken = searchParams.get('token');
    const numberLocale = getDateLocale(locale);
    const isUs = currency === 'USD';

    const effectivePromo = useMemo(() => {
        if (currency === 'USD') return null;
        if (promoState?.eligible) return promoState;
        if (user.starterPromoEligible && user.starterPromo?.eligible) {
            return {
                eligible: true,
                promo: user.starterPromo,
                planKey: 'BASIC',
                priceMonthlyBrl: user.starterPromo.priceMonthlyBrl,
                regularPriceMonthlyBrl: user.starterPromo.regularPriceMonthlyBrl,
                months: user.starterPromo.months,
                checkoutPlanId: user.starterPromo.planId,
            } satisfies PromoValidateResponse;
        }
        return null;
    }, [currency, promoState, user.starterPromo, user.starterPromoEligible]);

    useEffect(() => {
        const expectedLocale = market === 'BR' ? 'pt' : 'en';
        if (locale !== expectedLocale) {
            setLocale(expectedLocale);
        }
    }, [locale, setLocale, market]);

    useEffect(() => {
        if (!user.requiresOnboarding) {
            navigate('/dashboard', { replace: true });
            return;
        }
        if (isCheckoutDone()) {
            navigate('/onboarding', { replace: true });
            return;
        }
        setReady(true);
    }, [user, navigate]);

    useEffect(() => {
        if (!ready || isUs) return;
        if (!promoParam && !promoToken) return;
        billingApi
            .validatePromo({ promo: promoParam ?? undefined, token: promoToken ?? undefined })
            .then(setPromoState)
            .catch(() => setPromoState(null));
    }, [ready, promoParam, promoToken, isUs]);

    const loadPlans = useCallback(() => {
        setPlansError(null);
        setPlansLoading(true);
        plansApi
            .list()
            .then((data) => {
                setPlans(data);
                const apiCurrency = data.find((p) => p.currency)?.currency;
                if (apiCurrency) setResolvedCurrency(apiCurrency);
            })
            .catch((err: unknown) => {
                setPlansError(err instanceof Error ? err.message : t('dash.planos.loadError'));
            })
            .finally(() => setPlansLoading(false));
    }, [t]);

    useEffect(() => {
        if (ready) loadPlans();
    }, [ready, loadPlans]);

    const handleStartFree = () => {
        markCheckoutDone();
        navigate('/onboarding', { replace: true });
    };

    const handleLogout = async () => {
        try {
            await authApi.signOut();
        } catch {
            // Ignore — clear local state and leave anyway
        }
        localStorage.removeItem('prospector-session');
        sessionStorage.clear();
        window.location.replace('/auth/signin');
    };

    const handleSubscribe = async (planId: string) => {
        if (planId === 'FREE' || planId === 'TRIAL') return;
        setLoadingPlan(planId);
        try {
            const affiliateCode = getAffiliateRef();
            const repCode = getRepCode();
            const usePromo = planId === 'BASIC' && effectivePromo?.eligible && billingCycle === 'monthly';
            const res = await billingApi.checkout({
                planId: usePromo ? effectivePromo.checkoutPlanId : planId,
                interval: billingCycle,
                locale: checkoutLocale,
                ...(affiliateCode && { affiliateCode }),
                ...(repCode && { repCode }),
                ...(usePromo && promoParam && { promoCode: promoParam }),
                ...(usePromo && promoToken && { promoToken }),
                ...(usePromo && !promoParam && !promoToken && { promoCode: 'starter-6m' }),
            });
            if (res.url) {
                window.location.href = res.url;
            }
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : t('page.checkout.checkoutError'));
        } finally {
            setLoadingPlan(null);
        }
    };

    const payablePlans = plans.filter((p) => p.key !== 'FREE' && p.key !== 'TRIAL');

    if (!ready) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-muted">{t('auth.loading')}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center p-6 sm:p-10 bg-background">
            <div className="w-full max-w-5xl">
                <div className="relative flex justify-center mb-8">
                    <Logo height={48} />
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface border border-border transition-colors"
                        title={t('dash.logout')}
                    >
                        <LogOut size={15} />
                        <span className="hidden sm:inline">{t('dash.logout')}</span>
                    </button>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2">{t('page.checkout.title')}</h1>
                    <p className="text-muted text-sm max-w-lg mx-auto">
                        {t(isUs ? 'page.checkout.subtitleUs' : 'page.checkout.subtitle')}
                    </p>
                    {effectivePromo?.eligible && (
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold mt-3">
                            {t('dash.planos.starterPromoBanner', {
                                price: formatPlanPrice(effectivePromo.priceMonthlyBrl, 'BRL'),
                                regular: formatPlanPrice(effectivePromo.regularPriceMonthlyBrl, 'BRL'),
                                months: effectivePromo.months,
                            })}
                        </p>
                    )}
                    <p className="text-xs text-muted/80 mt-2">
                        {t(isUs ? 'page.checkout.securePaymentUs' : 'page.checkout.securePayment')}
                    </p>
                </div>

                <div className="mb-6 text-center">
                    <h2 className="text-lg font-bold text-foreground">{t('page.checkout.choosePlan')}</h2>
                </div>

                {plansLoading && (
                    <div className="flex justify-center py-12">
                        <Loader2 size={32} className="text-violet-600 dark:text-violet-400 animate-spin" />
                    </div>
                )}

                {plansError && (
                    <div className="rounded-3xl bg-card border border-border p-8 text-center">
                        <p className="text-muted mb-4">{plansError}</p>
                        <Button variant="secondary" size="sm" onClick={loadPlans} icon={<RefreshCw size={14} />}>
                            {t('dash.planos.retry')}
                        </Button>
                    </div>
                )}

                {!plansLoading && !plansError && payablePlans.length > 0 && (
                    <>
                        <BillingCycleToggle cycle={billingCycle} onChange={setBillingCycle} t={t} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {payablePlans.map((plan) => {
                                const ui = PLAN_UI[plan.key] ?? { icon: Zap, color: 'text-muted', borderColor: 'border-border' };
                                const Icon = ui.icon;
                                const creditsLabel = t('dash.planos.creditsPerMonth', {
                                    count: plan.leadsLimit.toLocaleString(numberLocale),
                                });
                                const billingFeatures = ui.billingPrefix ? raw(`${ui.billingPrefix}.features`) : [];
                                const features = [...billingFeatures, creditsLabel];
                                const cardBgClass = ui.popular
                                    ? 'bg-gradient-to-b from-violet-900/30 to-card border-violet-500/40 shadow-lg shadow-violet-500/10'
                                    : `bg-card ${ui.borderColor}`;
                                const priceInfo = getPlanDisplayPrice(plan, billingCycle, currency, effectivePromo);
                                const price = priceInfo.price;
                                const annualPrice = getPlanPrice(plan, 'annual', currency);
                                const monthlyEquivalent = billingCycle === 'annual' && annualPrice > 0 ? annualPrice / 12 : null;
                                const loading = loadingPlan === plan.key;

                                return (
                                    <div
                                        key={plan.key}
                                        className={`rounded-3xl border p-6 flex flex-col gap-4 transition-all relative ${cardBgClass}`}
                                    >
                                        {priceInfo.hasPromo && (
                                            <span className="absolute -top-3 right-4 px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                                                {t('dash.planos.promoBadge')}
                                            </span>
                                        )}
                                        {ui.popular && (
                                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-violet-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                                                {t('dash.planos.popular')}
                                            </span>
                                        )}
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface border border-border">
                                                <Icon size={20} className={ui.color} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-foreground">{plan.name}</div>
                                                <div className="text-xs text-muted">{creditsLabel}</div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-baseline gap-1 flex-wrap">
                                                {priceInfo.regularPrice != null && (
                                                    <span className="text-sm text-muted line-through">
                                                        {formatPlanPrice(priceInfo.regularPrice, currency)}
                                                    </span>
                                                )}
                                                <span className="text-2xl font-black text-foreground">
                                                    {formatPlanPrice(price, currency)}
                                                </span>
                                                <span className="text-xs text-muted">
                                                    {billingCycle === 'annual' ? t('dash.planos.perYear') : t('dash.planos.perMonth')}
                                                </span>
                                            </div>
                                            {priceInfo.hasPromo && (
                                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                    {t('dash.planos.starterPromoFootnote', { months: effectivePromo?.months ?? 6 })}
                                                </p>
                                            )}
                                            {monthlyEquivalent != null && monthlyEquivalent > 0 && (
                                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                    {t('dash.planos.equivMonthly', {
                                                        price: formatPlanPrice(Math.round(monthlyEquivalent), currency),
                                                    })}
                                                </p>
                                            )}
                                        </div>
                                        <ul className="text-xs text-muted space-y-2 flex-1">
                                            {features.map((f) => (
                                                <li key={`${plan.key}-feat-${f}`} className="flex items-start gap-2">
                                                    <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                                    <span>{f}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            className="w-full rounded-xl font-bold"
                                            disabled={loading}
                                            onClick={() => handleSubscribe(plan.key)}
                                            icon={
                                                loading ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <ArrowUpRight size={14} />
                                                )
                                            }
                                        >
                                            {loading ? t('dash.planos.processing') : t('dash.planos.subscribe')}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {!plansLoading && !plansError && payablePlans.length === 0 && (
                    <div className="rounded-3xl bg-card border border-border p-8 text-center text-muted">
                        {t('dash.planos.noPlans')}
                    </div>
                )}

                {!plansLoading && !plansError && payablePlans.length > 0 && (
                    <div className="mt-8 flex flex-col items-center gap-2 text-center">
                        <p className="max-w-xl text-sm text-muted italic">{t('page.checkout.socialQuote')}</p>
                        <p className="text-xs font-semibold text-foreground">{t('page.checkout.socialAuthor')}</p>
                        <p className="text-xs text-violet-600 dark:text-violet-400 font-bold mt-1">
                            <Check size={12} className="inline mr-1" aria-hidden />
                            {t('page.checkout.socialStat')}
                        </p>
                    </div>
                )}

                {!plansLoading && (
                    <div className="mt-8 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6 text-center">
                        <p className="font-bold text-foreground">{t('page.checkout.freeTitle')}</p>
                        <p className="text-sm text-muted mt-1">
                            {t('page.checkout.freeSubtitle', { count: FREE_PLAN_CREDITS })}
                        </p>
                        <button
                            type="button"
                            onClick={handleStartFree}
                            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold text-sm hover:bg-emerald-500/10 transition-colors"
                        >
                            <Zap size={15} />
                            {t('page.checkout.freeCta')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
