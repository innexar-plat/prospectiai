import { resolveMarketLeadsLimit } from './market';

export const PLANS = {
    FREE: {
        name: 'Free',
        leadsLimit: 10,
        monthly: { price_usd: 0, price_brl: 0 },
        annual: { price_usd: 0, price_brl: 0 },
    },
    TRIAL: {
        name: 'Trial',
        leadsLimit: 50,
        monthly: { price_usd: 0, price_brl: 0 },
        annual: { price_usd: 0, price_brl: 0 },
    },
    BASIC: {
        name: 'Starter',
        leadsLimit: 100,
        monthly: { price_usd: 19, price_brl: 99 },
        annual: { price_usd: 190, price_brl: 990 },
    },
    PRO: {
        name: 'Growth',
        leadsLimit: 400,
        monthly: { price_usd: 49, price_brl: 297 },
        annual: { price_usd: 490, price_brl: 3029 },
    },
    BUSINESS: {
        name: 'Business',
        leadsLimit: 1200,
        monthly: { price_usd: 99, price_brl: 797 },
        annual: { price_usd: 990, price_brl: 8135 },
    },
    SCALE: {
        name: 'Enterprise',
        leadsLimit: 5000,
        monthly: { price_usd: 249, price_brl: 1997 },
        annual: { price_usd: 2490, price_brl: 20369 },
    },
} as const;

export type PlanType = keyof typeof PLANS;

const PLAN_DISPLAY_NAME: Record<string, string> = {
    FREE: 'Free',
    TRIAL: 'Trial Grátis',
    BASIC: 'Starter',
    PRO: 'Growth',
    BUSINESS: 'Business',
    SCALE: 'Enterprise',
};

export function getPlanDisplayName(planKey: string): string {
    return PLAN_DISPLAY_NAME[planKey] ?? planKey;
}

const PLAN_TIER_ORDER: PlanType[] = ['FREE', 'TRIAL', 'BASIC', 'PRO', 'BUSINESS', 'SCALE'];

export const PUBLIC_PLAN_KEYS: PlanType[] = ['BASIC', 'PRO', 'BUSINESS', 'SCALE'];

export function getNextUpgradePlan(currentPlan: string): { key: PlanType; name: string; leadsLimit: number; priceBrl: number } | null {
    const idx = PLAN_TIER_ORDER.indexOf(currentPlan as PlanType);
    if (idx < 0 || idx >= PLAN_TIER_ORDER.length - 1) return null;
    const nextKey = PLAN_TIER_ORDER[idx + 1];
    if (!PUBLIC_PLAN_KEYS.includes(nextKey!)) {
        const starterIdx = PLAN_TIER_ORDER.indexOf('BASIC');
        if (starterIdx < 0) return null;
        const starter = PLANS.BASIC;
        return {
            key: 'BASIC',
            name: starter.name,
            leadsLimit: resolveMarketLeadsLimit('BASIC', starter.leadsLimit),
            priceBrl: starter.monthly.price_brl,
        };
    }
    const plan = PLANS[nextKey!];
    const key: PlanType = nextKey!;
    return {
        key,
        name: plan.name,
        leadsLimit: resolveMarketLeadsLimit(key, plan.leadsLimit),
        priceBrl: plan.monthly.price_brl,
    };
}

export function isTrialingUser(user: { plan?: string; trialExpired?: boolean; isTrialing?: boolean }): boolean {
    return user.plan === 'TRIAL' && user.isTrialing === true && !user.trialExpired;
}

export function isTrialExpiredUser(user: { trialExpired?: boolean }): boolean {
    return user.trialExpired === true;
}
