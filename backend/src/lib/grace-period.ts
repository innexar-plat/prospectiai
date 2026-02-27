import { prisma } from '@/lib/prisma';
import { PLANS } from '@/lib/billing-config';

const PAST_DUE_STATUS = 'past_due';

/**
 * If the workspace is in grace period (past_due) and gracePeriodEnd has passed,
 * pause service: set plan to FREE, clear subscription fields and gracePeriodEnd.
 * Returns the workspace after possibly applying the pause (so caller can use fresh data).
 */
export async function applyGracePeriodExpiryIfNeeded(workspaceId: string): Promise<void> {
    const now = new Date();
    const w = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, subscriptionStatus: true, gracePeriodEnd: true },
    });
    if (!w || !w.gracePeriodEnd || w.subscriptionStatus !== PAST_DUE_STATUS) return;
    if (w.gracePeriodEnd >= now) return;

    await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
            plan: 'FREE',
            subscriptionStatus: 'canceled',
            leadsLimit: PLANS.FREE.leadsLimit,
            gracePeriodEnd: null,
            subscriptionId: null,
            customerId: null,
            currentPeriodEnd: null,
        },
    });
}

/**
 * Find all workspaces with gracePeriodEnd in the past and subscriptionStatus past_due,
 * pause them (FREE plan, clear subscription). Returns count of workspaces updated.
 * Intended for cron/scheduled job.
 */
export async function runGracePeriodExpiryJob(): Promise<number> {
    const now = new Date();
    const expired = await prisma.workspace.findMany({
        where: {
            subscriptionStatus: PAST_DUE_STATUS,
            gracePeriodEnd: { lt: now },
        },
        select: { id: true },
    });

    for (const { id } of expired) {
        await prisma.workspace.update({
            where: { id },
            data: {
                plan: 'FREE',
                subscriptionStatus: 'canceled',
                leadsLimit: PLANS.FREE.leadsLimit,
                gracePeriodEnd: null,
                subscriptionId: null,
                customerId: null,
                currentPeriodEnd: null,
            },
        });
    }
    return expired.length;
}
