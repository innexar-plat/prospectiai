/**
 * Apply pending plan downgrades/cancellations at period end.
 * Same logic as the "pending" step of /api/cron/billing-lifecycle (kept for existing schedulers).
 * Requires x-cron-secret (or Bearer) matching BILLING_CRON_SECRET or CRON_SECRET.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyPendingPlanChange } from '@/lib/billing-lifecycle';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
    const secret = process.env.BILLING_CRON_SECRET || process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.headers.get('x-cron-secret');
    if (!secret || token !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const workspaces = await prisma.workspace.findMany({
        where: {
            pendingPlanId: { not: null },
            pendingPlanEffectiveAt: { lte: now },
        },
        select: {
            id: true, plan: true, market: true, subscriptionId: true, pendingPlanId: true, currentPeriodEnd: true,
            billingCycle: true, promoPaymentsRemaining: true, promoRegularAmountBrl: true,
        },
    });

    let applied = 0;
    for (const ws of workspaces) {
        try {
            if (await applyPendingPlanChange(ws, now)) {
                applied++;
                logger.info('Applied pending plan at period end', { workspaceId: ws.id, newPlan: ws.pendingPlanId });
            }
        } catch (err) {
            logger.error('Apply pending plan failed', { workspaceId: ws.id, error: err instanceof Error ? err.message : 'Unknown' });
        }
    }

    return NextResponse.json({ ok: true, applied });
}
