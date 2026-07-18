/**
 * POST /api/billing/cancel-subscription
 * Cancels the user's active subscription and downgrades to FREE at period end.
 * For Stripe: cancels subscription via Stripe API (cancel_at_period_end).
 * For MP: schedules cancellation as pendingPlan = FREE at currentPeriodEnd.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLANS } from '@/lib/billing-config';
import { stripe } from '@/lib/stripe';
import { cancelPreApproval } from '@/lib/mercadopago-subscription';
import { logger } from '@/lib/logger';
import { notifyPlanDowngradeScheduled } from '@/lib/telegram-business-alerts';

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

    if (workspace.plan === 'FREE') {
        return NextResponse.json({ error: 'Already on free plan' }, { status: 400 });
    }

    const subscriptionId = workspace.subscriptionId;
    const isStripe = subscriptionId?.startsWith('sub_');

    try {
        if (isStripe && subscriptionId) {
            // Cancel at period end so user keeps access until current period expires
            await stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: true,
            });

            // Schedule the downgrade to FREE at period end
            const effectiveAt = workspace.currentPeriodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await prisma.workspace.update({
                where: { id: workspace.id },
                data: {
                    pendingPlanId: 'FREE',
                    pendingPlanEffectiveAt: effectiveAt,
                },
            });

            logger.info('Stripe subscription cancel_at_period_end set', {
                userId: session.user.id,
                workspaceId: workspace.id,
                subscriptionId,
                effectiveAt,
            });
            notifyPlanDowngradeScheduled({
                userId: session.user.id,
                userEmail: session.user.email,
                userName: session.user.name,
                workspaceId: workspace.id,
                fromPlan: workspace.plan,
                toPlan: 'FREE',
                billingCycle: workspace.billingCycle,
                provider: 'stripe',
                subscriptionId,
                effectiveAt: new Date(effectiveAt).toISOString(),
            });

            return NextResponse.json({
                ok: true,
                message: `Sua assinatura será cancelada em ${new Date(effectiveAt).toLocaleDateString('pt-BR')}. Você continuará com acesso ao plano atual até essa data.`,
                pendingPlanId: 'FREE',
                pendingPlanEffectiveAt: new Date(effectiveAt).toISOString(),
            });
        }

        if (subscriptionId && !isStripe) {
            // Mercado Pago: cancel PreApproval immediately, schedule plan change
            try {
                await cancelPreApproval(subscriptionId);
            } catch (err) {
                logger.error('MP cancelPreApproval failed during cancel-subscription', {
                    subscriptionId,
                    error: err instanceof Error ? err.message : 'Unknown',
                });
                // Continue anyway — the subscription might already be cancelled
            }

            const effectiveAt = workspace.currentPeriodEnd ?? new Date();
            const isImmediate = !workspace.currentPeriodEnd || workspace.currentPeriodEnd <= new Date();

            if (isImmediate) {
                // No active period — cancel immediately
                await prisma.workspace.update({
                    where: { id: workspace.id },
                    data: {
                        plan: 'FREE',
                        leadsLimit: PLANS.FREE.leadsLimit,
                        subscriptionId: null,
                        subscriptionStatus: 'canceled',
                        customerId: null,
                        currentPeriodEnd: null,
                        billingCycle: null,
                        gracePeriodEnd: null,
                        pendingPlanId: null,
                        pendingPlanEffectiveAt: null,
                    },
                });

                return NextResponse.json({
                    ok: true,
                    message: 'Sua assinatura foi cancelada. Você está agora no plano Free.',
                    pendingPlanId: null,
                });
            }

            // Has remaining period — schedule downgrade
            await prisma.workspace.update({
                where: { id: workspace.id },
                data: {
                    subscriptionStatus: 'canceled',
                    pendingPlanId: 'FREE',
                    pendingPlanEffectiveAt: effectiveAt,
                },
            });

            logger.info('MP subscription cancelled, downgrade to FREE scheduled', {
                userId: session.user.id,
                workspaceId: workspace.id,
                effectiveAt,
            });
            notifyPlanDowngradeScheduled({
                userId: session.user.id,
                userEmail: session.user.email,
                userName: session.user.name,
                workspaceId: workspace.id,
                fromPlan: workspace.plan,
                toPlan: 'FREE',
                billingCycle: workspace.billingCycle,
                provider: 'mercadopago',
                subscriptionId,
                effectiveAt: new Date(effectiveAt).toISOString(),
            });

            return NextResponse.json({
                ok: true,
                message: `Sua assinatura foi cancelada. Seu plano será alterado para Free em ${new Date(effectiveAt).toLocaleDateString('pt-BR')}.`,
                pendingPlanId: 'FREE',
                pendingPlanEffectiveAt: new Date(effectiveAt).toISOString(),
            });
        }

        // No subscription ID — just reset to FREE immediately
        await prisma.workspace.update({
            where: { id: workspace.id },
            data: {
                plan: 'FREE',
                leadsLimit: PLANS.FREE.leadsLimit,
                subscriptionId: null,
                subscriptionStatus: null,
                customerId: null,
                currentPeriodEnd: null,
                billingCycle: null,
                gracePeriodEnd: null,
                pendingPlanId: null,
                pendingPlanEffectiveAt: null,
            },
        });

        return NextResponse.json({
            ok: true,
            message: 'Seu plano foi alterado para Free.',
            pendingPlanId: null,
        });
    } catch (err) {
        logger.error('Cancel subscription failed', {
            userId: session.user.id,
            error: err instanceof Error ? err.message : 'Unknown',
        });
        return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
    }
}
