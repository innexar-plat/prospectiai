/**
 * Apply pending plan downgrades/cancellations at period end.
 * For Stripe: subscription schedule auto-applies (we just update plan in DB).
 * For MP: cancel PreApproval and move workspace to pending plan (unsubscribed).
 * For cancel-to-FREE: clears all subscription fields.
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

async function applyPendingForWorkspace(
    ws: { id: string; subscriptionId: string | null; pendingPlanId: string | null },
): Promise<boolean> {
    if (!ws.pendingPlanId) return false;

    const isFreeDowngrade = ws.pendingPlanId === 'FREE';
    const hasMpSubscription = ws.subscriptionId != null && !isStripeSubscription(ws.subscriptionId);

    // For MP subscriptions, cancel the PreApproval
    if (hasMpSubscription) {
        try {
            await cancelPreApproval(ws.subscriptionId!);
        } catch (err: unknown) {
            logger.error('Apply pending plan: cancel PreApproval failed', {
                workspaceId: ws.id,
                subscriptionId: ws.subscriptionId,
                error: err instanceof Error ? err.message : 'Unknown',
            });
            // Continue anyway — subscription might already be cancelled
        }
    }

    const plan = PLANS[ws.pendingPlanId as PlanType];

    // Use atomic update with a WHERE clause that includes pendingPlanId to prevent race conditions.
    // If another process already cleared pendingPlanId, this update will match 0 rows.
    const result = await prisma.workspace.updateMany({
        where: {
            id: ws.id,
            pendingPlanId: ws.pendingPlanId, // Optimistic lock
        },
        data: {
            plan: (ws.pendingPlanId as PlanType) ?? 'FREE',
            leadsLimit: plan?.leadsLimit ?? PLANS.FREE.leadsLimit,
            pendingPlanId: null,
            pendingPlanEffectiveAt: null,
            // Clear subscription fields when going to FREE or when MP subscription was cancelled
            ...(isFreeDowngrade || hasMpSubscription
                ? {
                    subscriptionId: null,
                    subscriptionStatus: 'canceled',
                    customerId: null,
                    currentPeriodEnd: null,
                    billingCycle: null,
                    gracePeriodEnd: null,
                }
                : {}),
        },
    });

    if (result.count === 0) {
        logger.warn('Apply pending plan: workspace already processed (race avoided)', { workspaceId: ws.id });
        return false;
    }

    logger.info('Applied pending plan at period end', { workspaceId: ws.id, newPlan: ws.pendingPlanId });
    return true;
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
        const ok = await applyPendingForWorkspace(ws);
        if (ok) applied++;
    }

    return NextResponse.json({ ok: true, applied });
}
