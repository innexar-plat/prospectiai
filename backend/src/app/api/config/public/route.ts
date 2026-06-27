import { NextResponse } from 'next/server';
import { getMarketConfig, getRequestMarket, isTrialEnabled } from '@/lib/market';
import { TRIAL_DAYS } from '@/lib/trial';
import { PUBLIC_PLAN_KEYS, type PlanType, PLANS as BILLING_PLANS } from '@/lib/billing-config';
import { getMarketPlanPrices } from '@/lib/billing-prices';
import { getRequestLocale } from '@/lib/i18n/locale';

/**
 * GET /api/config/public
 * Public runtime config for frontend (market, features, trial, pricing preview).
 */
export async function GET(req: Request) {
    const market = getRequestMarket(req);
    const config = getMarketConfig(market);
    const detectedLocale = getRequestLocale(req);
    const publicPlans = PUBLIC_PLAN_KEYS.map((key) => {
        const plan = BILLING_PLANS[key as PlanType];
        const monthly = getMarketPlanPrices(key as PlanType, 'monthly', config.market);
        const annual = getMarketPlanPrices(key as PlanType, 'annual', config.market);
        return {
            key,
            name: plan.name,
            leadsLimit: monthly.leadsLimit,
            priceMonthly: monthly.primary,
            priceAnnual: annual.primary,
            currency: monthly.currency,
        };
    });

    return NextResponse.json({
        market,
        appName: config.appName,
        defaultLocale: config.defaultLocale,
        detectedLocale,
        defaultCountry: config.defaultCountry,
        currency: config.currency,
        checkoutLocale: config.checkoutLocale,
        features: config.features,
        trial: isTrialEnabled(market)
            ? {
                enabled: true,
                days: TRIAL_DAYS,
                credits: BILLING_PLANS.TRIAL.leadsLimit,
                modules: ['MAPEAMENTO', 'INTELIGENCIA_LEADS', 'ANALISE_CONCORRENCIA', 'ACAO_COMERCIAL'],
            }
            : { enabled: false },
        starterPlan: {
            key: 'BASIC',
            priceUsd: 19,
            credits: 50,
        },
        plans: publicPlans,
        supportedLocales: ['pt', 'en', 'es'] as const,
    });
}
