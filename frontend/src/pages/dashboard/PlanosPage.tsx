import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { CreditCard, Zap, Crown, Rocket, Check, Loader2, Clock, ArrowUpRight, ArrowDownRight, RefreshCw, XCircle, MessageCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import type { PromoValidateResponse, SessionUser } from '@/lib/api';
import { billingApi, plansApi, type PlanFromApi } from '@/lib/api';
import { getPlanDisplayName, isTrialExpiredUser } from '@/lib/billing-config';
import { getAffiliateRef, getRepCode } from '@/lib/affiliate-ref';
import { getSupportEmail, getSupportWhatsAppUrl } from '@/lib/support';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { useI18n } from '@/lib/i18n';
import { getActiveMarket, getMarketConfig, isTrialEnabled } from '@/lib/market';
import { isCheckoutDone } from '@/lib/post-auth-redirect';

const PLAN_UI: Record<string, { icon: LucideIcon; color: string; borderColor: string; popular?: boolean; billingPrefix?: string }> = {
    FREE: { icon: Zap, color: 'text-zinc-600 dark:text-zinc-400', borderColor: 'border-zinc-500/20' },
    BASIC: { icon: CreditCard, color: 'text-blue-600 dark:text-blue-400', borderColor: 'border-blue-500/20', billingPrefix: 'billing.basic' },
    PRO: { icon: Crown, color: 'text-violet-600 dark:text-violet-400', borderColor: 'border-violet-500/30', popular: true, billingPrefix: 'billing.pro' },
    BUSINESS: { icon: Rocket, color: 'text-amber-600 dark:text-amber-400', borderColor: 'border-amber-500/20', billingPrefix: 'billing.business' },
    SCALE: { icon: Rocket, color: 'text-amber-600 dark:text-amber-400', borderColor: 'border-amber-500/20', billingPrefix: 'billing.business' },
};

const PLAN_TIER_ORDER: string[] = ['FREE', 'BASIC', 'PRO', 'BUSINESS', 'SCALE'];

type BillingCycle = 'monthly' | 'annual';
type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

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

function getPlanDisplayPrice(
    plan: PlanFromApi,
    cycle: BillingCycle,
    currency: 'BRL' | 'USD',
    promo: PromoValidateResponse | null,
): { price: number; regularPrice?: number; hasPromo: boolean } {
    const base = getPlanPrice(plan, cycle, currency);
    if (plan.key === 'BASIC' && cycle === 'monthly' && currency === 'BRL' && promo?.eligible) {
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

function buildFeatureMatrix(t: TranslateFn) {
    return [
        { feature: t('dash.planos.matrix.search'), FREE: true, BASIC: true, PRO: true, BUSINESS: true, SCALE: true },
        { feature: t('dash.planos.matrix.score'), FREE: true, BASIC: true, PRO: true, BUSINESS: true, SCALE: true },
        { feature: t('dash.planos.matrix.history'), FREE: true, BASIC: true, PRO: true, BUSINESS: true, SCALE: true },
        { feature: t('dash.planos.matrix.tags'), FREE: true, BASIC: true, PRO: true, BUSINESS: true, SCALE: true },
        { feature: t('dash.planos.matrix.export'), FREE: false, BASIC: true, PRO: true, BUSINESS: true, SCALE: true },
        { feature: t('dash.planos.matrix.activity'), FREE: false, BASIC: true, PRO: true, BUSINESS: true, SCALE: true },
        { feature: t('dash.planos.matrix.competition'), FREE: false, BASIC: false, PRO: true, BUSINESS: true, SCALE: true },
        { feature: t('dash.planos.matrix.scripts'), FREE: false, BASIC: false, PRO: true, BUSINESS: true, SCALE: true },
        { feature: t('dash.planos.matrix.whatsapp'), FREE: false, BASIC: false, PRO: true, BUSINESS: true, SCALE: true },
        { feature: t('dash.planos.matrix.market'), FREE: false, BASIC: false, PRO: false, BUSINESS: true, SCALE: true },
        { feature: t('dash.planos.matrix.viability'), FREE: false, BASIC: false, PRO: false, BUSINESS: true, SCALE: true },
        { feature: t('dash.planos.matrix.team'), FREE: false, BASIC: false, PRO: false, BUSINESS: true, SCALE: true },
    ];
}

function renderFeatureCellValue(val: boolean | string | undefined) {
    if (val === true) return <Check size={14} className="text-emerald-600 dark:text-emerald-400 mx-auto" />;
    if (val === false) return <span className="text-muted/30">—</span>;
    return <span className="text-xs font-bold text-violet-600 dark:text-violet-400 tabular-nums">{String(val ?? '—')}</span>;
}

function PlanosCurrentPlanCard({
    user,
    plans,
    usagePercent,
    onCancelPendingDowngrade,
    cancelLoading,
    t,
    locale,
}: {
    user: SessionUser;
    plans: PlanFromApi[];
    usagePercent: number;
    onCancelPendingDowngrade: () => void;
    cancelLoading: boolean;
    t: TranslateFn;
    locale: string;
}) {
    const dateLocale = getDateLocale(locale);
    const pendingPlanName = user.pendingPlanId ? plans.find((p) => p.key === user.pendingPlanId)?.name ?? getPlanDisplayName(user.pendingPlanId) : null;
    const cycleLabel = user.billingCycle === 'annual' ? t('dash.planos.annualCycle') : t('dash.planos.monthlyCycle');
    const onTrial = user.plan === 'TRIAL';
    const trialExpired = isTrialExpiredUser(user);
    const trialDaysSuffix = user.trialDaysRemaining != null
        ? t('dash.planos.trialDays', { count: user.trialDaysRemaining, plural: user.trialDaysRemaining === 1 ? '' : 's' })
        : '';
    const supportWhatsAppUrl = getSupportWhatsAppUrl();
    const supportEmail = getSupportEmail();

    return (
        <div className="rounded-3xl bg-card border border-border p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-foreground">{t('dash.planos.yourPlan')}</h2>
                    <p className="text-sm text-muted mt-1">
                        {t('dash.planos.currentPlan')}{' '}
                        <span className="text-violet-600 dark:text-violet-400 font-bold">{getPlanDisplayName(user.plan)}</span>
                        {user.plan !== 'FREE' && user.plan !== 'TRIAL' && user.billingCycle && (
                            <span className="text-xs text-muted ml-2">({cycleLabel})</span>
                        )}
                    </p>
                    {onTrial && user.currentPeriodEnd && !trialExpired && isTrialEnabled() && (
                        <p className="text-xs text-violet-600 dark:text-violet-400 mt-1 font-medium">
                            {t('dash.planos.trialEnds', {
                                date: new Date(user.currentPeriodEnd).toLocaleDateString(dateLocale),
                                days: trialDaysSuffix,
                            })}
                        </p>
                    )}
                    {trialExpired && isTrialEnabled() && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                            {t('dash.planos.trialExpired')}
                        </p>
                    )}
                    {user.plan !== 'FREE' && user.plan !== 'TRIAL' && user.currentPeriodEnd && (
                        <p className="text-xs text-muted mt-1">
                            {t('dash.planos.renewal', { date: new Date(user.currentPeriodEnd).toLocaleDateString(dateLocale) })}
                        </p>
                    )}
                    {user.pendingPlanId && user.pendingPlanEffectiveAt && pendingPlanName && (
                        <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                {t('dash.planos.pendingChange', {
                                    action: user.pendingPlanId === 'FREE' ? t('dash.planos.cancelScheduled') : t('dash.planos.downgradeScheduled'),
                                    plan: pendingPlanName,
                                    date: new Date(user.pendingPlanEffectiveAt).toLocaleDateString(dateLocale),
                                })}
                            </p>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="mt-2 text-xs"
                                disabled={cancelLoading}
                                onClick={onCancelPendingDowngrade}
                                icon={cancelLoading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                            >
                                {t('dash.planos.keepPlan')}
                            </Button>
                        </div>
                    )}
                    {user.plan !== 'FREE' && user.plan !== 'TRIAL' && !user.pendingPlanId && (
                        <p className="text-xs text-muted mt-3">
                            {t('dash.planos.cancelSupport')}{' '}
                            <a
                                href={supportWhatsAppUrl ?? `mailto:${supportEmail}`}
                                target={supportWhatsAppUrl ? '_blank' : undefined}
                                rel={supportWhatsAppUrl ? 'noopener noreferrer' : undefined}
                                className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 underline underline-offset-2 inline-flex items-center gap-1"
                            >
                                {supportWhatsAppUrl && <MessageCircle size={12} />}
                                {t('dash.planos.contactSupport')}
                            </a>.
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-surface border border-border">
                    <Zap size={20} className="text-violet-600 dark:text-violet-400" />
                    <div>
                        <div className="text-lg font-bold text-foreground tabular-nums">{user.leadsUsed} / {user.leadsLimit}</div>
                        <div className="text-[10px] text-muted uppercase tracking-wider">{t('dash.planos.creditsUsed')}</div>
                    </div>
                </div>
            </div>
            <div className="mt-4">
                <div className="flex justify-between text-xs text-muted mb-2">
                    <span>{t('dash.planos.creditUsage')}</span>
                    <span className="tabular-nums">{usagePercent}%</span>
                </div>
                <div className="w-full h-3 bg-surface rounded-full overflow-hidden border border-border">
                    <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                            width: `${usagePercent}%`,
                            background: usagePercent > 80 ? 'linear-gradient(90deg, #ef4444, #f97316)' : 'linear-gradient(90deg, #8b5cf6, #6366f1)',
                        }}
                    />
                </div>
            </div>
        </div>
    );
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

function PlanCardActionButton({
    planKey,
    loadingPlan,
    isDowngrade,
    onUpgrade,
    t,
}: {
    planKey: string;
    loadingPlan: string | null;
    isDowngrade: (key: string) => boolean;
    onUpgrade: (key: string) => void;
    t: TranslateFn;
}) {
    const loading = loadingPlan === planKey;
    const downgrade = isDowngrade(planKey);
    let icon: React.ReactNode;
    if (loading) icon = <Loader2 size={14} className="animate-spin" />;
    else if (downgrade) icon = <ArrowDownRight size={14} />;
    else icon = <ArrowUpRight size={14} />;
    let label: string;
    if (loading) label = t('dash.planos.processing');
    else if (downgrade) label = t('dash.planos.downgrade');
    else label = t('dash.planos.subscribe');
    return (
        <Button
            variant={downgrade ? 'secondary' : 'primary'}
            size="sm"
            className="w-full rounded-xl font-bold"
            disabled={loading}
            onClick={() => onUpgrade(planKey)}
            icon={icon}
        >
            {label}
        </Button>
    );
}

function renderPlanCardFooter(
    isCurrent: boolean,
    isCycleChangeOnly: boolean,
    planKey: string,
    loadingPlan: string | null,
    isDowngrade: (key: string) => boolean,
    onUpgrade: (key: string) => void,
    t: TranslateFn,
): ReactNode {
    if (isCurrent) {
        return <div className="text-center text-xs font-bold text-violet-600 dark:text-violet-400 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20">{t('dash.planos.currentPlanBadge')}</div>;
    }
    if (planKey === 'FREE' || planKey === 'TRIAL') {
        return <div className="text-center text-xs text-muted py-2">{t('dash.planos.freePlan')}</div>;
    }
    if (isCycleChangeOnly) {
        const loading = loadingPlan === planKey;
        return (
            <Button
                variant="secondary"
                size="sm"
                className="w-full rounded-xl font-bold"
                disabled={loading}
                onClick={() => onUpgrade(planKey)}
                icon={loading ? <Loader2 size={14} className="animate-spin" /> : undefined}
            >
                {loading ? t('dash.planos.processing') : t('dash.planos.switchCycle')}
            </Button>
        );
    }
    return <PlanCardActionButton planKey={planKey} loadingPlan={loadingPlan} isDowngrade={isDowngrade} onUpgrade={onUpgrade} t={t} />;
}

function PlanosGridContent({
    plansLoading,
    plansError,
    plans,
    user,
    loadingPlan,
    isDowngrade,
    onUpgrade,
    onRetry,
    cycle,
    onCycleChange,
    currency,
    t,
    raw,
    locale,
    effectivePromo,
}: {
    plansLoading: boolean;
    plansError: string | null;
    plans: PlanFromApi[];
    user: SessionUser;
    loadingPlan: string | null;
    isDowngrade: (key: string) => boolean;
    onUpgrade: (key: string) => void;
    onRetry: () => void;
    cycle: BillingCycle;
    onCycleChange: (c: BillingCycle) => void;
    currency: 'BRL' | 'USD';
    t: TranslateFn;
    raw: (prefix: string) => string[];
    locale: string;
    effectivePromo: PromoValidateResponse | null;
}) {
    const numberLocale = getDateLocale(locale);

    if (plansLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 size={32} className="text-violet-600 dark:text-violet-400 animate-spin" />
            </div>
        );
    }
    if (plansError) {
        return (
            <div className="rounded-3xl bg-card border border-border p-8 text-center">
                <p className="text-muted mb-4">{plansError}</p>
                <Button variant="secondary" size="sm" onClick={onRetry} icon={<RefreshCw size={14} />}>
                    {t('dash.planos.retry')}
                </Button>
            </div>
        );
    }
    if (plans.length === 0) {
        return (
            <div className="rounded-3xl bg-card border border-border p-8 text-center text-muted">
                {t('dash.planos.noPlans')}
            </div>
        );
    }
    return (
        <>
            <BillingCycleToggle cycle={cycle} onChange={onCycleChange} t={t} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {plans.map((plan) => {
                    const isSamePlan = plan.key === user.plan;
                    const isCurrent = isSamePlan && cycle === (user.billingCycle ?? 'monthly');
                    const isCycleChangeOnly = isSamePlan && !isCurrent && plan.key !== 'FREE' && plan.key !== 'TRIAL';
                    const ui = PLAN_UI[plan.key] ?? { icon: Zap, color: 'text-muted', borderColor: 'border-border' };
                    const Icon = ui.icon;
                    const creditsLabel = t('dash.planos.creditsPerMonth', { count: plan.leadsLimit.toLocaleString(numberLocale) });
                    const billingFeatures = ui.billingPrefix ? raw(`${ui.billingPrefix}.features`) : [];
                    const features = [...billingFeatures, creditsLabel];
                    const cardBgClass = ui.popular ? 'bg-gradient-to-b from-violet-900/30 to-card border-violet-500/40 shadow-lg shadow-violet-500/10' : `bg-card ${ui.borderColor}`;
                    const ringClass = isCurrent ? 'ring-2 ring-violet-500' : '';
                    const priceInfo = getPlanDisplayPrice(plan, cycle, currency, effectivePromo);
                    const price = priceInfo.price;
                    const annualPrice = getPlanPrice(plan, 'annual', currency);
                    const monthlyEquivalent = cycle === 'annual' && annualPrice > 0 ? annualPrice / 12 : null;
                    return (
                        <div key={plan.key} className={`rounded-3xl border p-6 flex flex-col gap-4 transition-all relative ${cardBgClass} ${ringClass}`}>
                            {priceInfo.hasPromo && (
                                <span className="absolute -top-3 right-4 px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                                    {t('dash.planos.promoBadge')}
                                </span>
                            )}
                            {ui.popular && (
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-violet-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">{t('dash.planos.popular')}</span>
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
                                    <span className="text-2xl font-black text-foreground">{formatPlanPrice(price, currency)}</span>
                                    <span className="text-xs text-muted">{cycle === 'annual' ? t('dash.planos.perYear') : t('dash.planos.perMonth')}</span>
                                </div>
                                {priceInfo.hasPromo && (
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                        {t('dash.planos.starterPromoFootnote', { months: effectivePromo?.months ?? 6 })}
                                    </p>
                                )}
                                {monthlyEquivalent != null && monthlyEquivalent > 0 && (
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                        {t('dash.planos.equivMonthly', { price: formatPlanPrice(Math.round(monthlyEquivalent), currency) })}
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
                            {renderPlanCardFooter(isCurrent, isCycleChangeOnly, plan.key, loadingPlan, isDowngrade, onUpgrade, t)}
                        </div>
                    );
                })}
            </div>
        </>
    );
}

export default function PlanosPage() {
    const { t, raw, locale } = useI18n();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const market = getActiveMarket();
    const [resolvedCurrency, setResolvedCurrency] = useState<'BRL' | 'USD'>(getMarketConfig(market).currency);
    const currency = resolvedCurrency;
    const checkoutLocale = getMarketConfig(market).defaultLocale;
    const { user, refreshUser } = useOutletContext<{ user: SessionUser; refreshUser?: () => void }>();
    const { addToast } = useToast();
    const [plans, setPlans] = useState<PlanFromApi[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);
    const [plansError, setPlansError] = useState<string | null>(null);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [billingCycle, setBillingCycle] = useState<BillingCycle>(user.billingCycle ?? 'monthly');
    const [promoState, setPromoState] = useState<PromoValidateResponse | null>(null);
    const promoParam = searchParams.get('promo');
    const promoToken = searchParams.get('token');

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

    const featureMatrix = useMemo(() => buildFeatureMatrix(t), [t]);
    const numberLocale = getDateLocale(locale);

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
        loadPlans();
    }, [loadPlans]);

    useEffect(() => {
        if (currency === 'USD') return;
        if (!promoParam && !promoToken) return;
        billingApi
            .validatePromo({ promo: promoParam ?? undefined, token: promoToken ?? undefined })
            .then(setPromoState)
            .catch(() => setPromoState(null));
    }, [promoParam, promoToken, currency]);

    useEffect(() => {
        if (user.requiresOnboarding && !isCheckoutDone()) {
            navigate('/checkout', { replace: true });
        }
    }, [user.requiresOnboarding, navigate]);

    const usagePercent = user.leadsLimit > 0
        ? Math.min(100, Math.round((user.leadsUsed / user.leadsLimit) * 100))
        : 0;

    const planTierIndex = (planKey: string) => {
        const i = PLAN_TIER_ORDER.indexOf(planKey);
        return i >= 0 ? i : -1;
    };
    const isDowngrade = (targetKey: string) => planTierIndex(targetKey) < planTierIndex(user.plan);

    const handleUpgrade = async (planId: string) => {
        if (planId === 'FREE' || planId === 'TRIAL') return;
        const isCycleChangeOnly = planId === user.plan && billingCycle !== (user.billingCycle ?? 'monthly');
        if (planId === user.plan && !isCycleChangeOnly) return;
        setLoadingPlan(planId);
        try {
            const affiliateCode = getAffiliateRef();
            const repCode = getRepCode();
            const usePromo = planId === 'BASIC' && effectivePromo?.eligible && billingCycle === 'monthly';
            const res = await billingApi.checkout({
                planId: usePromo ? effectivePromo.checkoutPlanId : planId,
                interval: billingCycle,
                locale: checkoutLocale,
                scheduleAtPeriodEnd: isDowngrade(planId),
                ...(affiliateCode && { affiliateCode }),
                ...(repCode && { repCode }),
                ...(usePromo && promoParam && { promoCode: promoParam }),
                ...(usePromo && promoToken && { promoToken }),
                ...(usePromo && !promoParam && !promoToken && { promoCode: 'starter-6m' }),
            });
            if (res.scheduled && res.url === null) {
                addToast('success', res.message);
                refreshUser?.();
                return;
            }
            if (res.url) {
                window.location.href = res.url;
            }
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : t('dash.planos.checkoutError'));
        } finally {
            setLoadingPlan(null);
        }
    };

    const handleCancelPendingDowngrade = useCallback(async () => {
        setCancelLoading(true);
        try {
            const res = await billingApi.cancelPendingDowngrade();
            addToast('success', res.message);
            refreshUser?.();
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : t('dash.planos.cancelError'));
        } finally {
            setCancelLoading(false);
        }
    }, [addToast, refreshUser, t]);

    const paymentNoteKey = currency === 'USD' ? 'dash.planos.paymentNoteUs' : 'dash.planos.paymentNoteBr';

    return (
        <>
            <HeaderDashboard title={t('dash.planos.title')} subtitle={t('dash.planos.subtitle')} breadcrumb={t('dash.planos.breadcrumb')} />
            <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-8">

                <PlanosCurrentPlanCard
                    user={user}
                    plans={plans}
                    usagePercent={usagePercent}
                    onCancelPendingDowngrade={handleCancelPendingDowngrade}
                    cancelLoading={cancelLoading}
                    t={t}
                    locale={locale}
                />

                <div>
                    <h3 className="text-lg font-bold text-foreground mb-6 text-center">{t('dash.planos.available')}</h3>
                    {effectivePromo?.eligible && (
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold text-center mb-4">
                            {t('dash.planos.starterPromoBanner', {
                                price: formatPlanPrice(effectivePromo.priceMonthlyBrl, 'BRL'),
                                regular: formatPlanPrice(effectivePromo.regularPriceMonthlyBrl, 'BRL'),
                                months: effectivePromo.months,
                            })}
                        </p>
                    )}
                    <PlanosGridContent
                        plansLoading={plansLoading}
                        plansError={plansError}
                        plans={plans}
                        user={user}
                        loadingPlan={loadingPlan}
                        isDowngrade={isDowngrade}
                        onUpgrade={handleUpgrade}
                        onRetry={loadPlans}
                        cycle={billingCycle}
                        onCycleChange={setBillingCycle}
                        currency={currency}
                        t={t}
                        raw={raw}
                        locale={locale}
                        effectivePromo={effectivePromo}
                    />
                </div>

                <div className="rounded-3xl bg-card border border-border overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h3 className="text-lg font-bold text-foreground">{t('dash.planos.comparison')}</h3>
                    </div>
                    {plans.length === 0 ? (
                        <div className="p-8 text-center text-muted text-sm">{t('dash.planos.loadComparison')}</div>
                    ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="py-3 px-5 text-left text-[10px] font-bold text-muted uppercase tracking-wider">{t('dash.planos.featureCol')}</th>
                                    {plans.map((plan) => (
                                        <th key={plan.key} className="py-3 px-4 text-center text-[10px] font-bold text-muted uppercase tracking-wider">
                                            {plan.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {featureMatrix.map((row) => (
                                    <tr key={`row-${row.feature}`} className="border-b border-border/30 hover:bg-surface/30">
                                        <td className="py-2.5 px-5 text-xs text-foreground">{row.feature}</td>
                                        {plans.map((plan) => {
                                            const val = row[plan.key as keyof typeof row];
                                            return (
                                                <td key={plan.key} className="py-2.5 px-4 text-center">
                                                    {renderFeatureCellValue(val as boolean | string | undefined)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                <tr className="border-b border-border/30 hover:bg-surface/30">
                                    <td className="py-2.5 px-5 text-xs text-foreground">{t('dash.planos.monthlyCredits')}</td>
                                    {plans.map((plan) => (
                                        <td key={plan.key} className="py-2.5 px-4 text-center">
                                            <span className="text-xs font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                                                {plan.leadsLimit.toLocaleString(numberLocale)}
                                            </span>
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    )}
                </div>

                <div className="rounded-3xl bg-card border border-border p-6">
                    <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                        <Clock size={18} className="text-muted" /> {t('dash.planos.paymentHistory')}
                    </h3>
                    <div className="text-center py-8 text-muted">
                        <p className="text-sm">{t('dash.planos.noPayments')}</p>
                        <p className="text-xs mt-1">{t('dash.planos.noPaymentsHint')}</p>
                        <p className="text-xs mt-3 text-muted/80">{t(paymentNoteKey)}</p>
                    </div>
                </div>
            </div>
        </>
    );
}
