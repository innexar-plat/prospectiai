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
        annual: { price_usd: 5089, price_brl: 25469 }, // ~15% discount
    },
} as const;

export type PlanType = keyof typeof PLANS;

/** Plan tier order (lower index = lower tier). Used to detect upgrade vs downgrade. */
export const PLAN_TIER_ORDER: PlanType[] = ['FREE', 'BASIC', 'PRO', 'BUSINESS', 'SCALE'];

export function isDowngrade(currentPlan: PlanType, targetPlan: PlanType): boolean {
    const currentIdx = PLAN_TIER_ORDER.indexOf(currentPlan);
    const targetIdx = PLAN_TIER_ORDER.indexOf(targetPlan);
    if (currentIdx < 0 || targetIdx < 0) return false;
    return targetIdx < currentIdx;
}

/** True when moving from a lower tier to a higher tier (e.g. BASIC → PRO). */
export function isUpgrade(currentPlan: PlanType, targetPlan: PlanType): boolean {
    const currentIdx = PLAN_TIER_ORDER.indexOf(currentPlan);
    const targetIdx = PLAN_TIER_ORDER.indexOf(targetPlan);
    if (currentIdx < 0 || targetIdx < 0) return false;
    return targetIdx > currentIdx;
}

export type BillingCycle = 'monthly' | 'annual';

export type PlanWithPrices = (typeof PLANS)[PlanType];

export function getPlanPrices(plan: PlanWithPrices, cycle: BillingCycle): { price_brl: number; price_usd: number } {
    return plan[cycle];
}
