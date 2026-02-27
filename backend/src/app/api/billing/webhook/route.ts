import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType } from '@/lib/billing-config';
import Stripe from 'stripe';

export async function POST(req: Request) {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err: unknown) {
        const { logger } = await import('@/lib/logger');
        logger.error('Stripe webhook error', { error: err instanceof Error ? err.message : 'Unknown' });
        return NextResponse.json({ error: 'Webhook Error' }, { status: 400 });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    type SubscriptionWithPeriod = Stripe.Subscription & { current_period_end: number };

    const periodEnd = (sub: SubscriptionWithPeriod): Date =>
        new Date(sub.current_period_end * 1000);

    if (event.type === 'checkout.session.completed') {
        const raw = await stripe.subscriptions.retrieve(session.subscription as string);
        const subscription = raw as unknown as SubscriptionWithPeriod;
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId as PlanType;

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId in metadata' }, { status: 400 });
        }

        const plan = PLANS[planId];

        const userWithWorkspace = await prisma.user.findUnique({
            where: { id: userId },
            include: { workspaces: { take: 1 } }
        });

        if (userWithWorkspace?.workspaces[0]?.workspaceId) {
            const interval = (subscription as { items?: { data?: Array<{ price?: { recurring?: { interval?: string } } }> } })
                .items?.data?.[0]?.price?.recurring?.interval;
            const billingCycle = interval === 'year' ? 'annual' : 'monthly';
            await prisma.workspace.update({
                where: { id: userWithWorkspace.workspaces[0].workspaceId },
                data: {
                    subscriptionId: subscription.id,
                    customerId: subscription.customer as string,
                    plan: planId,
                    subscriptionStatus: subscription.status,
                    leadsLimit: plan.leadsLimit,
                    leadsUsed: 0,
                    currentPeriodEnd: periodEnd(subscription),
                    billingCycle,
                    gracePeriodEnd: null,
                },
            });
        }
    }

    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
        const subscription = event.data.object as unknown as SubscriptionWithPeriod;
        const planId = subscription.metadata?.planId as PlanType;

        if (event.type === 'customer.subscription.deleted') {
            await prisma.workspace.updateMany({
                where: { subscriptionId: subscription.id },
                data: {
                    subscriptionStatus: 'canceled',
                    plan: 'FREE',
                    leadsLimit: PLANS.FREE.leadsLimit,
                    gracePeriodEnd: null,
                },
            });
        } else {
            if (planId) {
                const plan = PLANS[planId];
                const GRACE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
                const isPastDue = subscription.status === 'past_due';
                const isActive = subscription.status === 'active';
                const subWithItems = subscription as { items?: { data?: Array<{ price?: { recurring?: { interval?: string } } }> } };
                const interval = subWithItems.items?.data?.[0]?.price?.recurring?.interval;
                const billingCycle = interval === 'year' ? 'annual' : 'monthly';
                await prisma.workspace.updateMany({
                    where: { subscriptionId: subscription.id },
                    data: {
                        plan: planId,
                        subscriptionStatus: subscription.status,
                        leadsLimit: plan.leadsLimit,
                        leadsUsed: isActive ? 0 : undefined,
                        currentPeriodEnd: periodEnd(subscription),
                        billingCycle,
                        gracePeriodEnd: isPastDue ? new Date(Date.now() + GRACE_DAYS_MS) : isActive ? null : undefined,
                        pendingPlanId: null,
                        pendingPlanEffectiveAt: null,
                    },
                });
            }
        }
    }

    return NextResponse.json({ received: true });
}
