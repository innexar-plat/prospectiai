import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { getPlanMrrForWorkspace } from '@/lib/admin-market-stats';
import { addDays, isMpOneTimeId, isMpPreapprovalId, isStripeSubscriptionId } from '@/lib/billing-period';

const PAID_PLANS = ['BASIC', 'PRO', 'BUSINESS', 'SCALE'] as const;

function providerOf(subscriptionId: string | null): 'card_mp' | 'pix' | 'stripe' | 'manual' {
    if (isStripeSubscriptionId(subscriptionId)) return 'stripe';
    if (isMpOneTimeId(subscriptionId)) return 'pix';
    if (isMpPreapprovalId(subscriptionId)) return 'card_mp';
    return 'manual';
}

/**
 * GET /api/admin/billing — subscriptions (paid + manual grants), revenue from the payment
 * ledger and the follow-up queues (expiring, past due, open PIX, scheduled changes).
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const now = new Date();
    const [workspaces, planConfigs, payments, revenueRows] = await Promise.all([
        prisma.workspace.findMany({
            where: {
                OR: [
                    { plan: { in: [...PAID_PLANS] } },
                    { renewalPaymentExpiresAt: { gt: now } },
                    { subscriptionStatus: 'past_due' },
                ],
            },
            select: {
                id: true, name: true, market: true, plan: true, subscriptionId: true, subscriptionStatus: true,
                billingCycle: true, currentPeriodEnd: true, creditsResetAt: true, leadsUsed: true, leadsLimit: true,
                pendingPlanId: true, pendingPlanEffectiveAt: true, gracePeriodEnd: true, cnpj: true,
                renewalPaymentId: true, renewalPaymentUrl: true, renewalPaymentExpiresAt: true, promoPaymentsRemaining: true,
                members: { where: { role: 'OWNER' }, take: 1, select: { user: { select: { email: true, name: true } } } },
            },
            orderBy: { currentPeriodEnd: 'asc' },
        }),
        prisma.planConfig.findMany({ select: { key: true, priceMonthlyBrl: true, priceAnnualBrl: true, priceMonthlyUsd: true, priceAnnualUsd: true } }),
        prisma.billingPayment.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
        prisma.$queryRaw<Array<{ month: string; currency: string; cents: bigint; n: bigint }>>`
            SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month, currency,
                   SUM("amountCents") AS cents, COUNT(*) AS n
            FROM "BillingPayment" WHERE status = 'APPROVED' AND "createdAt" >= now() - interval '12 months'
            GROUP BY 1, 2 ORDER BY 1`,
    ]);
    const planConfigByKey = new Map(planConfigs.map((p) => [p.key, p]));

    const in7d = addDays(now, 7);
    const rows = workspaces.map((w) => {
        const provider = providerOf(w.subscriptionId);
        const mrr = provider === 'manual' ? null : getPlanMrrForWorkspace(
            { plan: w.plan, subscriptionId: w.subscriptionId, subscriptionStatus: w.subscriptionStatus, leadsLimit: w.leadsLimit, billingCycle: w.billingCycle, cnpj: w.cnpj },
            planConfigByKey,
        );
        return {
            id: w.id,
            name: w.name,
            ownerEmail: w.members[0]?.user.email ?? null,
            ownerName: w.members[0]?.user.name ?? null,
            market: w.market,
            plan: w.plan,
            provider,
            status: w.subscriptionStatus,
            billingCycle: w.billingCycle,
            currentPeriodEnd: w.currentPeriodEnd,
            creditsResetAt: w.creditsResetAt,
            leadsUsed: w.leadsUsed,
            leadsLimit: w.leadsLimit,
            pendingPlanId: w.pendingPlanId,
            pendingPlanEffectiveAt: w.pendingPlanEffectiveAt,
            gracePeriodEnd: w.gracePeriodEnd,
            openPix: w.renewalPaymentExpiresAt && w.renewalPaymentExpiresAt > now
                ? { paymentId: w.renewalPaymentId, url: w.renewalPaymentUrl, expiresAt: w.renewalPaymentExpiresAt }
                : null,
            promoPaymentsRemaining: w.promoPaymentsRemaining,
            mrr: mrr?.mrr ?? 0,
            currency: mrr?.market === 'US' ? 'USD' : 'BRL',
        };
    });

    const paying = rows.filter((r) => r.provider !== 'manual' && r.plan !== 'FREE' && r.status === 'active');
    const sumMrr = (cur: string) => Math.round(paying.filter((r) => r.currency === cur).reduce((a, r) => a + r.mrr, 0) * 100) / 100;
    const since30 = addDays(now, -30);
    const revenue30d = await prisma.billingPayment.groupBy({
        by: ['currency'],
        where: { status: 'APPROVED', createdAt: { gte: since30 } },
        _sum: { amountCents: true },
        _count: true,
    });

    const summary = {
        mrrBrl: sumMrr('BRL'),
        mrrUsd: sumMrr('USD'),
        paying: paying.length,
        byProvider: {
            card_mp: paying.filter((r) => r.provider === 'card_mp').length,
            pix: paying.filter((r) => r.provider === 'pix').length,
            stripe: paying.filter((r) => r.provider === 'stripe').length,
        },
        manualGrants: rows.filter((r) => r.provider === 'manual' && r.plan !== 'FREE').length,
        expiring7d: rows.filter((r) => r.provider !== 'manual' && r.currentPeriodEnd && r.currentPeriodEnd >= now && r.currentPeriodEnd <= in7d).length,
        pastDue: rows.filter((r) => r.status === 'past_due').length,
        openPix: rows.filter((r) => r.openPix).length,
        scheduledChanges: rows.filter((r) => r.pendingPlanId).length,
        revenue30d: revenue30d.map((r) => ({ currency: r.currency, amount: (r._sum.amountCents ?? 0) / 100, payments: r._count })),
    };

    logAdminAction(session, 'admin.billing.list').catch(() => {});
    return NextResponse.json({
        summary,
        subscriptions: rows,
        payments: payments.map((p) => ({ ...p, amount: p.amountCents / 100 })),
        revenueByMonth: revenueRows.map((r) => ({ month: r.month, currency: r.currency, amount: Number(r.cents) / 100, payments: Number(r.n) })),
    });
}
