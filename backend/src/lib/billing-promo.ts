import { createHmac } from 'crypto';
import { timingSafeEqual } from 'crypto';
import type { Market } from '@/lib/market';
import { PLANS, type PlanType } from '@/lib/billing-config';
import { TRIAL_EXPIRED_STATUS } from '@/lib/trial';

/** Virtual checkout plan id for BR Starter promo (maps to BASIC). */
export const STARTER_PROMO_BR_PLAN_ID = 'STARTER_PROMO_BR';

export const STARTER_PROMO_BR = {
    id: 'starter-6m',
    planId: STARTER_PROMO_BR_PLAN_ID,
    mapsToPlan: 'BASIC' as const,
    market: 'BR' as const,
    promoPriceBrl: 59,
    regularPriceBrl: 99,
    months: 6,
    aliases: ['starter-6m', 'reactivation'] as const,
};

export type StarterPromoId = typeof STARTER_PROMO_BR.id;

export type PromoCheckoutContext = {
    promoId: StarterPromoId;
    planId: PlanType;
    priceBrl: number;
    regularPriceBrl: number;
    months: number;
};

type WorkspacePromoEligibility = {
    plan?: string | null;
    subscriptionStatus?: string | null;
    starterPromoEligible?: boolean | null;
};

function promoSecret(): string {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET is not set');
    return secret;
}

export function normalizePromoCode(input: string | null | undefined): string | null {
    const trimmed = input?.trim().toLowerCase();
    return trimmed || null;
}

export function resolvePromoIdFromInput(
    promoCode?: string | null,
    planId?: string | null,
): StarterPromoId | null {
    const normalizedPlan = planId?.trim();
    if (normalizedPlan === STARTER_PROMO_BR_PLAN_ID) {
        return STARTER_PROMO_BR.id;
    }
    const code = normalizePromoCode(promoCode);
    if (!code) return null;
    if ((STARTER_PROMO_BR.aliases as readonly string[]).includes(code)) {
        return STARTER_PROMO_BR.id;
    }
    return null;
}

export function isStarterPromoEligibleWorkspace(
    workspace: WorkspacePromoEligibility,
    market: Market,
): boolean {
    if (market !== 'BR') return false;
    if (workspace.starterPromoEligible === true) return true;
    if (workspace.plan !== 'TRIAL') return false;
    if (workspace.subscriptionStatus === TRIAL_EXPIRED_STATUS) return true;
    return false;
}

/** Starter promo disabled: BR will not run promotional pricing (business decision). */
const STARTER_PROMO_DISABLED = true;

export function canApplyStarterPromo(
    workspace: WorkspacePromoEligibility,
    market: Market,
    cycle: 'monthly' | 'annual',
): boolean {
    if (STARTER_PROMO_DISABLED) return false;
    if (cycle !== 'monthly') return false;
    if (market !== 'BR') return false;
    const plan = workspace.plan ?? 'FREE';
    if (plan !== 'TRIAL' && plan !== 'FREE') return false;
    return isStarterPromoEligibleWorkspace(workspace, market);
}

export function buildPromoCheckoutContext(promoId: StarterPromoId): PromoCheckoutContext {
    if (promoId !== STARTER_PROMO_BR.id) {
        throw new Error(`Unknown promo id: ${promoId}`);
    }
    return {
        promoId,
        planId: STARTER_PROMO_BR.mapsToPlan,
        priceBrl: STARTER_PROMO_BR.promoPriceBrl,
        regularPriceBrl: STARTER_PROMO_BR.regularPriceBrl,
        months: STARTER_PROMO_BR.months,
    };
}

export function resolveCheckoutPlanId(planId: string): PlanType | null {
    if (planId === STARTER_PROMO_BR_PLAN_ID) {
        return STARTER_PROMO_BR.mapsToPlan;
    }
    if (planId in PLANS) {
        return planId as PlanType;
    }
    return null;
}

export function buildMpExternalReference(params: {
    userId: string;
    planId: PlanType;
    cycle: 'monthly' | 'annual';
    affiliateCode?: string;
    promoId?: StarterPromoId;
    repCode?: string;
}): string {
    const affiliate = params.affiliateCode ?? '';
    const rep = params.repCode ?? '';
    const repPart = rep ? `rep:${rep}` : '';
    if (params.promoId) {
        const parts = [params.userId, params.planId, params.cycle];
        if (affiliate && rep) {
            parts.push(affiliate, repPart);
        } else if (affiliate) {
            parts.push(affiliate);
        } else if (rep) {
            parts.push(repPart);
        }
        parts.push('promo', params.promoId);
        return parts.join(':');
    }
    const parts = [params.userId, params.planId, params.cycle];
    if (affiliate && rep) {
        parts.push(affiliate, repPart);
    } else if (affiliate) {
        parts.push(affiliate);
    } else if (rep) {
        parts.push(repPart);
    }
    return parts.join(':');
}

export function parseMpExternalReference(extRef: string): {
    userId: string;
    planId: PlanType;
    cycle: 'monthly' | 'annual';
    affiliateCode?: string;
    promoId?: StarterPromoId;
    repCode?: string;
} | null {
    const parts = extRef.split(':');
    if (parts.length < 3) return null;
    const userId = parts[0];
    const planId = parts[1] as PlanType;
    const cycle = (parts[2] || 'monthly') as 'monthly' | 'annual';
    const promoIdx = parts.indexOf('promo');
    let affiliateCode: string | undefined;
    let promoId: StarterPromoId | undefined;
    let repCode: string | undefined;
    if (promoIdx >= 0) {
        const promoValue = parts[promoIdx + 1];
        if (promoValue === STARTER_PROMO_BR.id) {
            promoId = STARTER_PROMO_BR.id;
        }
        for (let i = 3; i < promoIdx; i++) {
            const p = parts[i];
            if (p === 'rep') {
                repCode = parts[i + 1] || undefined;
                i++;
            } else if (p && p !== 'promo') {
                affiliateCode = p;
            }
        }
    } else {
        for (let i = 3; i < parts.length; i++) {
            const p = parts[i];
            if (p === 'rep') {
                repCode = parts[i + 1] || undefined;
                i++;
            } else if (p) {
                affiliateCode = p;
            }
        }
    }
    if (!userId || !(planId in PLANS)) return null;
    return { userId, planId, cycle, affiliateCode, promoId, repCode };
}

/** Signed promo token for email links: `promoId.userId.expUnix.sig` */
export function createPromoToken(userId: string, promoId: StarterPromoId, expiresInDays = 30): string {
    const exp = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
    const payload = `${promoId}.${userId}.${exp}`;
    const sig = createHmac('sha256', promoSecret()).update(payload).digest('hex').slice(0, 32);
    return `${payload}.${sig}`;
}

export function verifyPromoToken(
    token: string,
    userId: string,
): { valid: boolean; promoId?: StarterPromoId; reason?: string } {
    const parts = token.split('.');
    if (parts.length !== 4) {
        return { valid: false, reason: 'invalid_format' };
    }
    const [promoId, tokenUserId, expStr, sig] = parts;
    if (tokenUserId !== userId) {
        return { valid: false, reason: 'user_mismatch' };
    }
    if (promoId !== STARTER_PROMO_BR.id) {
        return { valid: false, reason: 'unknown_promo' };
    }
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
        return { valid: false, reason: 'expired' };
    }
    const payload = `${parts[0]!}.${parts[1]!}.${parts[2]!}`;
    const expected = createHmac('sha256', promoSecret()).update(payload).digest('hex').slice(0, 32);
    try {
        const valid = timingSafeEqual(new Uint8Array(Buffer.from(parts[3]!)), new Uint8Array(Buffer.from(expected)));
        return valid ? { valid: true, promoId: STARTER_PROMO_BR.id } : { valid: false, reason: 'bad_signature' };
    } catch {
        return { valid: false, reason: 'bad_signature' };
    }
}

export function getStarterPromoPublicInfo(eligible: boolean) {
    return {
        id: STARTER_PROMO_BR.id,
        planId: STARTER_PROMO_BR_PLAN_ID,
        planKey: STARTER_PROMO_BR.mapsToPlan,
        priceMonthlyBrl: STARTER_PROMO_BR.promoPriceBrl,
        regularPriceMonthlyBrl: STARTER_PROMO_BR.regularPriceBrl,
        months: STARTER_PROMO_BR.months,
        eligible,
    };
}
