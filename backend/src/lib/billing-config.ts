export const PLANS = {
    FREE: {
        name: 'Free',
        leadsLimit: 10,
        maxMembers: 1,
        monthly: { price_usd: 0, price_brl: 0 },
        annual: { price_usd: 0, price_brl: 0 },
    },
    TRIAL: {
        name: 'Trial',
        leadsLimit: 50,
        maxMembers: 1,
        monthly: { price_usd: 0, price_brl: 0 },
        annual: { price_usd: 0, price_brl: 0 },
    },
    BASIC: {
        name: 'Starter',
        leadsLimit: 100,
        maxMembers: 1,
        monthly: { price_usd: 19, price_brl: 99 },
        annual: { price_usd: 190, price_brl: 990 },
    },
    PRO: {
        name: 'Growth',
        leadsLimit: 400,
        maxMembers: 3,
        monthly: { price_usd: 49, price_brl: 297 },
        annual: { price_usd: 490, price_brl: 3029 },
    },
    BUSINESS: {
        name: 'Business',
        leadsLimit: 1200,
        maxMembers: 10,
        monthly: { price_usd: 99, price_brl: 797 },
        annual: { price_usd: 990, price_brl: 8135 },
    },
    SCALE: {
        name: 'Enterprise',
        leadsLimit: 5000,
        maxMembers: 50,
        monthly: { price_usd: 249, price_brl: 1997 },
        annual: { price_usd: 2490, price_brl: 20369 },
    },
} as const;

/** Number of days an invitation link remains valid after being sent. */
export const INVITE_EXPIRATION_DAYS = 7;

export type PlanType = keyof typeof PLANS;

/** Plan tier order (lower index = lower tier). Used to detect upgrade vs downgrade. */
export const PLAN_TIER_ORDER: PlanType[] = ['FREE', 'TRIAL', 'BASIC', 'PRO', 'BUSINESS', 'SCALE'];

/** Plan keys shown on pricing / checkout (excludes legacy FREE and auto TRIAL). */
export const PUBLIC_PLAN_KEYS: PlanType[] = ['BASIC', 'PRO', 'BUSINESS', 'SCALE'];

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
