export const PLANS = {
    FREE: {
        name: 'Free',
        leadsLimit: 5,
        monthly: { price_usd: 0, price_brl: 0 },
        annual: { price_usd: 0, price_brl: 0 },
    },
    BASIC: {
        name: 'Starter',
        leadsLimit: 100,
        monthly: { price_usd: 25, price_brl: 129 },
        annual: { price_usd: 255, price_brl: 1315 }, // ~15% discount
    },
    PRO: {
        name: 'Growth',
        leadsLimit: 400,
        monthly: { price_usd: 79, price_brl: 397 },
        annual: { price_usd: 805, price_brl: 4049 }, // ~15% discount
    },
    BUSINESS: {
        name: 'Business',
        leadsLimit: 1200,
        monthly: { price_usd: 199, price_brl: 997 },
        annual: { price_usd: 2029, price_brl: 10169 }, // ~15% discount
    },
    SCALE: {
        name: 'Enterprise',
        leadsLimit: 5000,
        monthly: { price_usd: 499, price_brl: 2497 },
        annual: { price_usd: 5089, price_brl: 25469 },
    },
} as const;

export type PlanType = keyof typeof PLANS;

/** Display names for plan keys (consistent across sidebar, dashboard, planos, perfil). */
const PLAN_DISPLAY_NAME: Record<string, string> = {
    FREE: 'Free',
    BASIC: 'Starter',
    PRO: 'Growth',
    BUSINESS: 'Business',
    SCALE: 'Enterprise',
};

export function getPlanDisplayName(planKey: string): string {
    return PLAN_DISPLAY_NAME[planKey] ?? planKey;
}
