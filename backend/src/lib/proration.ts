/**
 * Pro-rata calculation for plan upgrades (cheaper → more expensive).
 * Used when charging only the difference for the remainder of the current billing period.
 */

import { PLANS, PlanType, getPlanPrices, type BillingCycle } from '@/lib/billing-config';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

export interface ProratedAmount {
    amountBrl: number;
    amountUsd: number;
    /** Fraction of period remaining (0..1). */
    remainingRatio: number;
}

/**
 * Computes the prorated amount to charge when upgrading from currentPlan to targetPlan
 * for the remainder of the current period. Same cycle only (monthly↔monthly, annual↔annual).
 * Returns null if proration does not apply (e.g. no period end, past end, or different cycle).
 */
export function computeProratedUpgradeAmount(params: {
    currentPlan: PlanType;
    targetPlan: PlanType;
    cycle: BillingCycle;
    currentPeriodEnd: Date | null;
}): ProratedAmount | null {
    const { currentPlan, targetPlan, cycle, currentPeriodEnd } = params;
    if (!currentPeriodEnd) return null;
    const now = new Date();
    if (currentPeriodEnd <= now) return null;

    const periodDays = cycle === 'annual' ? DAYS_PER_YEAR : DAYS_PER_MONTH;
    const periodMs = periodDays * MS_PER_DAY;
    const remainingMs = currentPeriodEnd.getTime() - now.getTime();
    const remainingRatio = Math.min(1, Math.max(0, remainingMs / periodMs));
    if (remainingRatio <= 0) return null;

    const currentPrices = getPlanPrices(PLANS[currentPlan], cycle);
    const targetPrices = getPlanPrices(PLANS[targetPlan], cycle);
    const amountBrl = Math.max(0, Math.round(remainingRatio * (targetPrices.price_brl - currentPrices.price_brl)));
    const amountUsd = Math.max(0, remainingRatio * (targetPrices.price_usd - currentPrices.price_usd));

    return { amountBrl, amountUsd, remainingRatio };
}
