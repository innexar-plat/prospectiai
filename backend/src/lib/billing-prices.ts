import type { Market } from '@/lib/market';
import { getMarketConfig, getMarketLeadsLimit } from '@/lib/market';
import { PLANS, type BillingCycle, type PlanType } from '@/lib/billing-config';
import { STARTER_PROMO_BR, type StarterPromoId } from '@/lib/billing-promo';

export interface PlanPriceResult {
    primary: number;
    currency: 'BRL' | 'USD';
    secondary?: number;
    secondaryCurrency?: 'BRL' | 'USD';
    leadsLimit: number;
    promo?: {
        id: StarterPromoId;
        priceBrl: number;
        regularPriceBrl: number;
        months: number;
    };
}

export function getStarterPromoPrices(market: Market = 'BR'): PlanPriceResult['promo'] | null {
    if (market !== 'BR') return null;
    return {
        id: STARTER_PROMO_BR.id,
        priceBrl: STARTER_PROMO_BR.promoPriceBrl,
        regularPriceBrl: STARTER_PROMO_BR.regularPriceBrl,
        months: STARTER_PROMO_BR.months,
    };
}

export function getMarketPlanPrices(
    planKey: PlanType,
    cycle: BillingCycle,
    market: Market = getMarketConfig().market,
    options?: { promoId?: StarterPromoId },
): PlanPriceResult {
    const plan = PLANS[planKey];
    const prices = plan[cycle];
    const config = getMarketConfig(market);
    const leadsLimit = getMarketLeadsLimit(planKey, market);

    if (market === 'US') {
        const usdOverrides = config.planOverrides.usdPrices;
        let usd: number = prices.price_usd;
        if (usdOverrides && planKey in usdOverrides) {
            usd = usdOverrides[planKey as keyof typeof usdOverrides]!;
        }
        if (cycle === 'annual') {
            usd = Math.round(usd * 10);
        }
        return { primary: usd, currency: 'USD', secondary: prices.price_brl, secondaryCurrency: 'BRL', leadsLimit };
    }

    const promo =
        options?.promoId && planKey === 'BASIC' && cycle === 'monthly'
            ? getStarterPromoPrices(market)
            : undefined;
    const primary =
        promo && options?.promoId === STARTER_PROMO_BR.id
            ? STARTER_PROMO_BR.promoPriceBrl
            : prices.price_brl;

    return {
        primary,
        currency: 'BRL',
        secondary: prices.price_usd,
        secondaryCurrency: 'USD',
        leadsLimit,
        ...(promo ? { promo } : {}),
    };
}
