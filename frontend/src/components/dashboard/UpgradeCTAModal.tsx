import { createPortal } from 'react-dom';
import { Rocket, ArrowRight, Zap, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getNextUpgradePlan, getPlanDisplayName } from '@/lib/billing-config';
import { useI18n } from '@/lib/i18n';
import { getActiveMarket, getMarketConfig, US_STARTER_CREDITS, US_STARTER_PRICE_USD, resolveMarketLeadsLimit } from '@/lib/market';
import type { StarterPromoInfo } from '@/lib/api';

interface UpgradeCTAModalProps {
    currentPlan: string;
    leadsUsed: number;
    leadsLimit: number;
    starterPromo?: StarterPromoInfo | null;
    onClose: () => void;
}

export function UpgradeCTAModal({ currentPlan, leadsUsed, leadsLimit, starterPromo, onClose }: UpgradeCTAModalProps) {
    const { t } = useI18n();
    const next = getNextUpgradePlan(currentPlan);
    const isTrial = currentPlan === 'TRIAL';
    if (!next && !isTrial) return null;

    const market = getActiveMarket();
    const currency = getMarketConfig(market).currency;
    const starterCredits = market === 'US' ? US_STARTER_CREDITS : 100;
    const starterPrice = market === 'US' ? US_STARTER_PRICE_USD : 99;
    const target = next ?? {
        key: 'BASIC' as const,
        name: 'Starter',
        leadsLimit: resolveMarketLeadsLimit('BASIC', starterCredits),
        priceBrl: starterPrice,
    };
    const numberLocale = currency === 'USD' ? 'en-US' : 'pt-BR';

    const formatPrice = (v: number) => {
        if (v === 0) return currency === 'USD' ? '$0' : 'R$ 0';
        if (currency === 'USD') {
            const usdMap: Record<string, number> = { BASIC: 19, PRO: 49, BUSINESS: 99, SCALE: 249 };
            const usd = usdMap[target.key] ?? v;
            return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
        }
        return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
    };

    const multiplier = Math.round(target.leadsLimit / (leadsLimit || 1));
    const promoActive = currency === 'BRL' && target.key === 'BASIC' && starterPromo?.eligible === true;

    return createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 10001 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upgrade-cta-title"
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative rounded-2xl border border-violet-500/30 bg-card shadow-2xl shadow-violet-500/10 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-5 text-white relative">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/20 transition-colors"
                        aria-label={t('upgrade.close')}
                    >
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                            <Zap size={22} className="text-white" />
                        </div>
                        <div>
                            <h2 id="upgrade-cta-title" className="text-lg font-bold">
                                {isTrial ? t('upgrade.titleTrial') : t('upgrade.titleCredits')}
                            </h2>
                            <p className="text-sm text-white/80">{t('upgrade.creditsUsed', { used: leadsUsed, limit: leadsLimit })}</p>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <p className="text-sm text-muted">
                        {isTrial ? (
                            leadsUsed >= leadsLimit ? t('upgrade.trialExhausted') : t('upgrade.trialNeedPlan')
                        ) : (
                            t('upgrade.planExhausted', { plan: getPlanDisplayName(currentPlan) })
                        )}
                    </p>

                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-violet-600/20 flex items-center justify-center">
                                <Rocket size={18} className="text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                                <p className="font-bold text-foreground">{t('upgrade.planLabel', { name: target.name })}</p>
                                <p className="text-xs text-muted">{t('upgrade.creditsPerMonth', { count: target.leadsLimit.toLocaleString(numberLocale) })}</p>
                            </div>
                            <div className="ml-auto text-right">
                                {promoActive && starterPromo ? (
                                    <>
                                        <p className="text-[11px] text-muted line-through">{formatPrice(starterPromo.regularPriceMonthlyBrl)}</p>
                                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatPrice(starterPromo.priceMonthlyBrl)}</p>
                                        <p className="text-[10px] text-muted">{t('upgrade.perMonth')}</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-lg font-black text-violet-600 dark:text-violet-400">{formatPrice(target.priceBrl)}</p>
                                        <p className="text-[10px] text-muted">{t('upgrade.perMonth')}</p>
                                    </>
                                )}
                            </div>
                        </div>
                        {promoActive && starterPromo && (
                            <p className="mb-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                {t('dash.planos.starterPromoBanner', {
                                    price: formatPrice(starterPromo.priceMonthlyBrl),
                                    regular: formatPrice(starterPromo.regularPriceMonthlyBrl),
                                    months: starterPromo.months,
                                })}
                            </p>
                        )}
                        <ul className="text-xs text-muted space-y-1.5">
                            <li className="flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                                {t('upgrade.benefit1', { multiplier })}
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                                {t('upgrade.benefit2')}
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                                {t('upgrade.benefit3')}
                            </li>
                        </ul>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted hover:text-foreground hover:bg-surface transition-colors"
                        >
                            {t('upgrade.later')}
                        </button>
                        <Link
                            to="/dashboard/planos"
                            onClick={onClose}
                            className="flex-[2] px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold text-center transition-colors flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25"
                        >
                            {t('upgrade.cta')}
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
