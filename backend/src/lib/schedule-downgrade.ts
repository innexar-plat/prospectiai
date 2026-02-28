/**
 * Shared logic for scheduling a plan downgrade at period end.
 * Used by POST /api/billing/schedule-downgrade and by checkout when scheduleAtPeriodEnd is true.
 */

import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType, isDowngrade, getPlanPrices, type BillingCycle } from '@/lib/billing-config';
import { logger } from '@/lib/logger';
import type { Workspace } from '@prisma/client';

const CYCLE: BillingCycle = 'monthly';

/** Default period length in ms when workspace has no currentPeriodEnd (e.g. plan assigned manually). */
const DEFAULT_PERIOD_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isStripeSubscription(subscriptionId: string | null): boolean {
    return subscriptionId != null && subscriptionId.startsWith('sub_');
}

export interface ScheduleDowngradeResult {
    message: string;
    pendingPlanId: string;
    pendingPlanEffectiveAt: string;
}

export interface ScheduleDowngradeErrorShape {
    status: number;
    error: string;
}

/** Error thrown by performScheduleDowngrade; use .status and .error for API response. */
export class ScheduleDowngradeError extends Error implements ScheduleDowngradeErrorShape {
    constructor(
        public readonly status: number,
        message: string
    ) {
        super(message);
        this.name = 'ScheduleDowngradeError';
        Object.setPrototypeOf(this, ScheduleDowngradeError.prototype);
    }
    get error(): string {
        return this.message;
    }
}

/**
 * Validates and performs schedule-downgrade for the given workspace and target plan.
 * Updates workspace with pendingPlanId and pendingPlanEffectiveAt; for Stripe, creates/updates subscription schedule.
 */
export async function performScheduleDowngrade(
    workspace: Pick<Workspace, 'id' | 'plan' | 'subscriptionId' | 'currentPeriodEnd'>,
    targetPlanId: string
): Promise<ScheduleDowngradeResult> {
    const currentPlan = workspace.plan as PlanType;
    const targetPlan = PLANS[targetPlanId as PlanType];

    if (!targetPlan || targetPlanId === 'FREE') {
        throw new ScheduleDowngradeError(400, 'Invalid plan or use cancel flow for Free.');
    }
    if (!isDowngrade(currentPlan, targetPlanId as PlanType)) {
        throw new ScheduleDowngradeError(400, 'Schedule downgrade only applies when moving to a lower tier.');
    }
    if (currentPlan === 'FREE') {
        throw new ScheduleDowngradeError(400, 'Current plan is Free. Use checkout to subscribe.');
    }

    const subscriptionId = workspace.subscriptionId;
    const now = new Date();
    const rawPeriodEnd = workspace.currentPeriodEnd;
    const effectiveAt =
        rawPeriodEnd != null && rawPeriodEnd > now
            ? new Date(rawPeriodEnd)
            : new Date(now.getTime() + DEFAULT_PERIOD_DAYS_MS);

    if (subscriptionId != null && isStripeSubscription(subscriptionId)) {
        try {
            const raw = await stripe.subscriptions.retrieve(subscriptionId, {
                expand: ['items.data.price'],
            });
            const subscription = raw as unknown as { current_period_end: number; current_period_start: number; items: { data: Array<{ price: { id: string } }> } };

            const currentPeriodEndUnix = subscription.current_period_end;
            const item = subscription.items.data[0];
            if (!item?.price) {
                throw new ScheduleDowngradeError(400, 'Subscription has no price item');
            }

            const scheduleCreate = await stripe.subscriptionSchedules.create({
                from_subscription: subscriptionId,
            });

            const newPriceCents = Math.round(getPlanPrices(targetPlan, CYCLE).price_usd * 100);
            const phase2Items = [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `ProspectorAI ${targetPlan.name} Plan (monthly)`,
                            description: `Subscription for ${targetPlan.leadsLimit} leads searches per month.`,
                        },
                        unit_amount: newPriceCents,
                        recurring: { interval: 'month' },
                    },
                    quantity: 1,
                },
            ];
            await stripe.subscriptionSchedules.update(scheduleCreate.id, {
                end_behavior: 'release',
                phases: [
                    {
                        start_date: subscription.current_period_start,
                        end_date: currentPeriodEndUnix,
                        items: [{ price: item.price.id, quantity: 1 }],
                        metadata: { planId: currentPlan },
                    },
                    {
                        start_date: currentPeriodEndUnix,
                        items: phase2Items as never,
                        metadata: { planId: targetPlanId },
                    },
                ],
            });
        } catch (err: unknown) {
            if (err instanceof ScheduleDowngradeError) {
                throw err;
            }
            const msg = err instanceof Error ? err.message : 'Stripe API error';
            logger.error('Stripe schedule downgrade failed', { subscriptionId, error: msg });
            throw new ScheduleDowngradeError(502, 'Could not schedule plan change with payment provider. Try again later.');
        }
    }

    await prisma.workspace.update({
        where: { id: workspace.id },
        data: {
            pendingPlanId: targetPlanId,
            pendingPlanEffectiveAt: effectiveAt,
            ...(rawPeriodEnd == null || rawPeriodEnd <= now
                ? { currentPeriodEnd: effectiveAt }
                : {}),
        },
    });

    const planName = targetPlan.name;
    const priceBrl = getPlanPrices(targetPlan, CYCLE).price_brl;
    const message = `Seu plano será alterado para ${planName} em ${effectiveAt.toLocaleDateString('pt-BR')}. A próxima cobrança será no valor de R$ ${priceBrl.toLocaleString('pt-BR')} no dia ${effectiveAt.toLocaleDateString('pt-BR')}.`;

    return {
        message,
        pendingPlanId: targetPlanId,
        pendingPlanEffectiveAt: effectiveAt.toISOString(),
    };
}
