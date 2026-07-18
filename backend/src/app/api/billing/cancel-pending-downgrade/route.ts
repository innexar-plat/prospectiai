/**
 * POST /api/billing/cancel-pending-downgrade
 * Cancels a scheduled downgrade (pendingPlanId) so the user keeps their current plan.
 * For Stripe: releases the subscription schedule so auto-transition doesn't happen.
 * For MP: just clears the pending fields (cron won't apply).
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { logger } from '@/lib/logger';
import { notifyPlanDowngradeCancelled } from '@/lib/telegram-business-alerts';

export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithWorkspace = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { workspaces: { orderBy: { workspace: { createdAt: 'asc' } }, take: 1, include: { workspace: true } } },
    });

    const workspace = userWithWorkspace?.workspaces?.[0]?.workspace;
    if (!workspace) {
        return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    if (!workspace.pendingPlanId) {
        return NextResponse.json({ error: 'Nenhum downgrade agendado para cancelar.' }, { status: 400 });
    }

    const subscriptionId = workspace.subscriptionId;
    const isStripe = subscriptionId?.startsWith('sub_');

    try {
        // For Stripe: release any active subscription schedule
        if (isStripe && subscriptionId) {
            try {
                const schedules = await stripe.subscriptionSchedules.list({ limit: 10 });
                for (const schedule of schedules.data) {
                    const schedSub = schedule.subscription;
                    const schedSubId = typeof schedSub === 'string' ? schedSub : schedSub?.id;
                    if (schedSubId === subscriptionId && schedule.status === 'active') {
                        await stripe.subscriptionSchedules.release(schedule.id);
                        logger.info('Released Stripe subscription schedule', { scheduleId: schedule.id, subscriptionId });
                        break;
                    }
                }
            } catch (err) {
                logger.error('Failed to release Stripe schedule', {
                    subscriptionId,
                    error: err instanceof Error ? err.message : 'Unknown',
                });
                // Continue — clearing pending fields is the critical part
            }

            // If it was a cancel (pendingPlanId=FREE, cancel_at_period_end=true), revert that too
            if (workspace.pendingPlanId === 'FREE') {
                try {
                    await stripe.subscriptions.update(subscriptionId, {
                        cancel_at_period_end: false,
                    });
                } catch (err) {
                    logger.error('Failed to revert cancel_at_period_end', {
                        subscriptionId,
                        error: err instanceof Error ? err.message : 'Unknown',
                    });
                }
            }
        }

        await prisma.workspace.update({
            where: { id: workspace.id },
            data: {
                pendingPlanId: null,
                pendingPlanEffectiveAt: null,
            },
        });

        logger.info('Cancelled pending downgrade', {
            userId: session.user.id,
            workspaceId: workspace.id,
            cancelledPlan: workspace.pendingPlanId,
        });
        notifyPlanDowngradeCancelled({
            userId: session.user.id,
            userEmail: session.user.email,
            userName: session.user.name,
            workspaceId: workspace.id,
            fromPlan: workspace.plan,
            toPlan: workspace.pendingPlanId,
            provider: isStripe ? 'stripe' : 'mercadopago',
        });

        return NextResponse.json({
            ok: true,
            message: 'Downgrade cancelado. Seu plano atual será mantido.',
        });
    } catch (err) {
        logger.error('Cancel pending downgrade failed', {
            userId: session.user.id,
            error: err instanceof Error ? err.message : 'Unknown',
        });
        return NextResponse.json({ error: 'Failed to cancel pending downgrade' }, { status: 500 });
    }
}
