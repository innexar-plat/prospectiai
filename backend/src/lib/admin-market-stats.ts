/**
 * Admin market stats — classifies users/workspaces as BR vs US and aggregates revenue.
 *
 * Classification criteria (per user's primary OWNER workspace, oldest first):
 * 1. Stripe subscription (`subscriptionId` starts with `sub_`) → US (Stripe checkout, USD).
 * 2. Active paid plan without Stripe id → BR (Mercado Pago).
 * 3. TRIAL plan or trial-related subscriptionStatus → BR (trial only enabled in BR market).
 * 4. Workspace CNPJ present → BR.
 * 5. FREE + leadsLimit 0 + inactive subscription → US (US registration: no trial, zero credits).
 * 6. Default → BR (legacy BR free users and unmatched signups on BR stack).
 *
 * Users without an OWNER workspace → unknown.
 *
 * Revenue:
 * - mrr: monthly-equivalent from active paid workspaces (PlanConfig prices, market-specific currency).
 * - total: sum of approved/paid AffiliateCommission amounts (real payment records in DB).
 */

import { prisma } from '@/lib/prisma';
import { type BillingCycle, type PlanType } from '@/lib/billing-config';
import { getMarketPlanPrices } from '@/lib/billing-prices';
import type { Market } from '@/lib/market';

export type MarketBucket = 'BR' | 'US' | 'unknown';

export interface MarketCount {
    BR: number;
    US: number;
    unknown: number;
}

export interface MarketRevenue {
    total: number;
    mrr: number;
    currency: 'BRL' | 'USD';
    paidWorkspaces: number;
}

export interface MarketStatsResult {
    usersByMarket: MarketCount;
    revenueByMarket: {
        BR: MarketRevenue;
        US: MarketRevenue;
    };
}

type WorkspaceMarketInput = {
    plan: string;
    subscriptionId: string | null;
    subscriptionStatus: string | null;
    leadsLimit: number;
    billingCycle: string | null;
    cnpj: string | null;
};

const PAID_PLANS: PlanType[] = ['BASIC', 'PRO', 'BUSINESS', 'SCALE'];
const ACTIVE_STATUSES = new Set(['active', 'trialing']);

function isStripeSubscription(subscriptionId: string | null | undefined): boolean {
    return subscriptionId != null && subscriptionId.startsWith('sub_');
}

/** Classify a workspace into BR, US, or unknown. */
export function classifyWorkspaceMarket(workspace: WorkspaceMarketInput): MarketBucket {
    if (isStripeSubscription(workspace.subscriptionId)) {
        return 'US';
    }

    const isPaidPlan = PAID_PLANS.includes(workspace.plan as PlanType);
    const isActivePaid =
        isPaidPlan && workspace.subscriptionStatus != null && ACTIVE_STATUSES.has(workspace.subscriptionStatus);

    if (isActivePaid) {
        return 'BR';
    }

    if (workspace.plan === 'TRIAL') {
        return 'BR';
    }

    const status = workspace.subscriptionStatus ?? '';
    if (status === 'trialing' || status === 'trial_expired') {
        return 'BR';
    }

    if (workspace.cnpj != null && workspace.cnpj.trim() !== '') {
        return 'BR';
    }

    if (
        workspace.plan === 'FREE' &&
        workspace.leadsLimit <= 0 &&
        (workspace.subscriptionStatus == null || workspace.subscriptionStatus === 'inactive')
    ) {
        return 'US';
    }

    return 'BR';
}

function planPriceFromConfig(
    planKey: PlanType,
    cycle: BillingCycle,
    market: Market,
    planConfigRow: { priceMonthlyBrl: number; priceAnnualBrl: number; priceMonthlyUsd: number; priceAnnualUsd: number } | undefined,
): number {
    if (planConfigRow) {
        if (market === 'US') {
            return cycle === 'annual' ? planConfigRow.priceAnnualUsd : planConfigRow.priceMonthlyUsd;
        }
        return cycle === 'annual' ? planConfigRow.priceAnnualBrl : planConfigRow.priceMonthlyBrl;
    }
    return getMarketPlanPrices(planKey, cycle, market).primary;
}

function toMonthlyEquivalent(amount: number, cycle: BillingCycle): number {
    return cycle === 'annual' ? amount / 12 : amount;
}

function emptyRevenue(currency: 'BRL' | 'USD'): MarketRevenue {
    return { total: 0, mrr: 0, currency, paidWorkspaces: 0 };
}

export async function getAdminMarketStats(): Promise<MarketStatsResult> {
    const [users, paidWorkspaces, planConfigs, commissionAgg] = await Promise.all([
        prisma.user.findMany({
            select: {
                id: true,
                workspaces: {
                    where: { role: 'OWNER' },
                    orderBy: { createdAt: 'asc' },
                    take: 1,
                    select: {
                        workspace: {
                            select: {
                                plan: true,
                                subscriptionId: true,
                                subscriptionStatus: true,
                                leadsLimit: true,
                                billingCycle: true,
                                cnpj: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma.workspace.findMany({
            where: {
                plan: { in: PAID_PLANS },
                subscriptionStatus: { in: ['active', 'trialing'] },
            },
            select: {
                plan: true,
                subscriptionId: true,
                subscriptionStatus: true,
                leadsLimit: true,
                billingCycle: true,
                cnpj: true,
            },
        }),
        prisma.planConfig.findMany({
            select: {
                key: true,
                priceMonthlyBrl: true,
                priceAnnualBrl: true,
                priceMonthlyUsd: true,
                priceAnnualUsd: true,
            },
        }),
        prisma.affiliateCommission.groupBy({
            by: ['currency'],
            where: { status: { in: ['APPROVED', 'PAID'] } },
            _sum: { amountCents: true },
        }),
    ]);

    const planConfigByKey = new Map(planConfigs.map((p) => [p.key, p]));

    const usersByMarket: MarketCount = { BR: 0, US: 0, unknown: 0 };
    for (const user of users) {
        const ws = user.workspaces[0]?.workspace;
        if (!ws) {
            usersByMarket.unknown += 1;
            continue;
        }
        const bucket = classifyWorkspaceMarket(ws);
        usersByMarket[bucket] += 1;
    }

    const revenueByMarket = {
        BR: emptyRevenue('BRL'),
        US: emptyRevenue('USD'),
    };

    for (const ws of paidWorkspaces) {
        const market = classifyWorkspaceMarket(ws);
        if (market === 'unknown') continue;

        const planKey = ws.plan as PlanType;
        if (!PAID_PLANS.includes(planKey)) continue;

        const cycle: BillingCycle = ws.billingCycle === 'annual' ? 'annual' : 'monthly';
        const configRow = planConfigByKey.get(planKey);
        const price = planPriceFromConfig(planKey, cycle, market, configRow);
        const mrr = toMonthlyEquivalent(price, cycle);

        const bucket = revenueByMarket[market];
        bucket.mrr += mrr;
        bucket.paidWorkspaces += 1;
    }

    for (const row of commissionAgg) {
        const cents = row._sum.amountCents ?? 0;
        const total = cents / 100;
        if (row.currency === 'USD') {
            revenueByMarket.US.total += total;
        } else {
            revenueByMarket.BR.total += total;
        }
    }

    revenueByMarket.BR.mrr = Math.round(revenueByMarket.BR.mrr * 100) / 100;
    revenueByMarket.US.mrr = Math.round(revenueByMarket.US.mrr * 100) / 100;
    revenueByMarket.BR.total = Math.round(revenueByMarket.BR.total * 100) / 100;
    revenueByMarket.US.total = Math.round(revenueByMarket.US.total * 100) / 100;

    return { usersByMarket, revenueByMarket };
}

/** @internal exported for unit tests */
export function getPlanMrrForWorkspace(
    workspace: WorkspaceMarketInput,
    planConfigByKey: Map<string, { priceMonthlyBrl: number; priceAnnualBrl: number; priceMonthlyUsd: number; priceAnnualUsd: number }>,
): { market: Market; mrr: number } | null {
    const market = classifyWorkspaceMarket(workspace);
    if (market === 'unknown') return null;
    const planKey = workspace.plan as PlanType;
    if (!PAID_PLANS.includes(planKey)) return null;
    if (!workspace.subscriptionStatus || !ACTIVE_STATUSES.has(workspace.subscriptionStatus)) return null;

    const cycle: BillingCycle = workspace.billingCycle === 'annual' ? 'annual' : 'monthly';
    const price = planPriceFromConfig(planKey, cycle, market, planConfigByKey.get(planKey));
    return { market, mrr: toMonthlyEquivalent(price, cycle) };
}
