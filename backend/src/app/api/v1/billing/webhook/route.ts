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

    if (event.type === 'checkout.session.completed') {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId as PlanType;

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId in metadata' }, { status: 400 });
        }

        const plan = PLANS[planId];

        await prisma.user.update({
            where: { id: userId },
            data: {
                subscriptionId: subscription.id,
                customerId: subscription.customer as string,
                plan: planId,
                subscriptionStatus: subscription.status,
                leadsLimit: plan.leadsLimit,
                currentPeriodEnd: new Date((subscription as unknown as Stripe.Subscription & { current_period_end: number }).current_period_end * 1000),
            },
        });
    }

    if (event.type === 'customer.subscription.deleted') {
        const obj = event.data.object;
        if (typeof obj !== 'object' || obj === null || !('id' in obj)) {
            return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
        }
        const subscriptionId = (obj as { id: string }).id;
        await prisma.user.update({
            where: { subscriptionId },
            data: {
                subscriptionStatus: 'canceled',
                plan: 'FREE',
                leadsLimit: PLANS.FREE.leadsLimit,
            },
        });
    }

    return NextResponse.json({ received: true });
}
