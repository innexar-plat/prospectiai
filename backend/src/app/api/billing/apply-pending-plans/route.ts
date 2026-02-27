/**
 * Apply pending plan downgrades at period end (Mercado Pago only).
 * Stripe handles schedule via Subscription Schedules; for MP we cancel the current PreApproval
 * and set the workspace to the pending plan. User can re-subscribe to the new plan via checkout.
 * Call this from a cron (e.g. daily) with header x-cron-secret matching BILLING_CRON_SECRET.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType } from '@/lib/billing-config';
import { cancelPreApproval } from '@/lib/mercadopago-subscription';
import { logger } from '@/lib/logger';

function isStripeSubscription(subscriptionId: string | null): boolean {
    return subscriptionId != null && subscriptionId.startsWith('sub_');
}

export async function POST(req: Request) {
    const cronSecret = process.env.BILLING_CRON_SECRET;
    const headerSecret = req.headers.get('x-cron-secret');
    if (cronSecret && headerSecret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const workspaces = await prisma.workspace.findMany({
        where: {
            pendingPlanId: { not: null },
            pendingPlanEffectiveAt: { lte: now },
        },
        select: {
            id: true,
            subscriptionId: true,
            pendingPlanId: true,
        },
    });

    let applied = 0;
    for (const ws of workspaces) {
        if (!ws.pendingPlanId) continue;

        const hasMpSubscription = ws.subscriptionId != null && !isStripeSubscription(ws.subscriptionId);
        if (hasMpSubscription) {
            try {
                await cancelPreApproval(ws.subscriptionId!);
            } catch (err: unknown) {
                logger.error('Apply pending plan: cancel PreApproval failed', {
                    workspaceId: ws.id,
                    subscriptionId: ws.subscriptionId,
                    error: err instanceof Error ? err.message : 'Unknown',
                });
                continue;
            }
        }

        const plan = PLANS[ws.pendingPlanId as PlanType];
        await prisma.workspace.update({
            where: { id: ws.id },
            data: {
                plan: ws.pendingPlanId as PlanType,
                leadsLimit: plan?.leadsLimit ?? PLANS.FREE.leadsLimit,
                subscriptionId: null,
                subscriptionStatus: hasMpSubscription ? 'canceled' : null,
                customerId: null,
                currentPeriodEnd: null,
                pendingPlanId: null,
                pendingPlanEffectiveAt: null,
            },
        });
        applied++;
        logger.info('Applied pending plan at period end', { workspaceId: ws.id, newPlan: ws.pendingPlanId });
    }

    return NextResponse.json({ ok: true, applied });
}
