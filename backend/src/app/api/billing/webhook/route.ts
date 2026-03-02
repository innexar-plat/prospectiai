import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType, getPlanPrices } from '@/lib/billing-config';
import Stripe from 'stripe';
import { createCommissionForFirstPayment, cancelCommissionsByOrderOrSubscription, createCommissionForRecurring } from '@/lib/affiliate';

type SubscriptionWithPeriod = Stripe.Subscription & { current_period_end: number };

function periodEnd(sub: SubscriptionWithPeriod): Date {
    return new Date(sub.current_period_end * 1000);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<NextResponse | null> {
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId as PlanType;
    const affiliateCode = session.metadata?.affiliateCode as string | undefined;
    if (!userId) return NextResponse.json({ error: 'Missing userId in metadata' }, { status: 400 });

    const raw = await stripe.subscriptions.retrieve(session.subscription as string);
    const subscription = raw as unknown as SubscriptionWithPeriod;
    const plan = PLANS[planId];
    const userWithWorkspace = await prisma.user.findUnique({
        where: { id: userId },
        include: { workspaces: { take: 1 } }
    });

    if (!userWithWorkspace?.workspaces[0]?.workspaceId) return null;
    const workspaceId = userWithWorkspace.workspaces[0].workspaceId;
    const interval = (subscription as { items?: { data?: Array<{ price?: { recurring?: { interval?: string } } }> } })
        .items?.data?.[0]?.price?.recurring?.interval;
    const billingCycle = interval === 'year' ? 'annual' : 'monthly';
    await prisma.workspace.update({
        where: { id: workspaceId },
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

    // Comissão afiliado (primeira conversão)
    const priceUsd = getPlanPrices(plan, billingCycle).price_usd;
    const valueCents = Math.round(priceUsd * 100);
    try {
        await createCommissionForFirstPayment({
            userId,
            workspaceId,
            userEmail: userWithWorkspace.email ?? null,
            planId,
            valueCents,
            currency: 'USD',
            orderId: session.id,
            subscriptionId: subscription.id,
            affiliateCodeFromMetadata: affiliateCode ?? undefined,
        });
    } catch (e) {
        const { logger } = await import('@/lib/logger');
        logger.error('Affiliate commission create failed', { error: e instanceof Error ? e.message : 'Unknown' });
    }
    return null;
}

async function handleSubscriptionDeleted(subscription: SubscriptionWithPeriod): Promise<void> {
    await prisma.workspace.updateMany({
        where: { subscriptionId: subscription.id },
        data: {
            subscriptionStatus: 'canceled',
            plan: 'FREE',
            leadsLimit: PLANS.FREE.leadsLimit,
            gracePeriodEnd: null,
        },
    });
}

async function handleSubscriptionUpdated(subscription: SubscriptionWithPeriod): Promise<void> {
    const planId = subscription.metadata?.planId as PlanType;
    if (!planId) return;
    const plan = PLANS[planId];
    const GRACE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const isPastDue = subscription.status === 'past_due';
    const isActive = subscription.status === 'active';
    const subWithItems = subscription as { items?: { data?: Array<{ price?: { recurring?: { interval?: string } } }> } };
    const interval = subWithItems.items?.data?.[0]?.price?.recurring?.interval;
    const billingCycle = interval === 'year' ? 'annual' : 'monthly';
    let gracePeriodEndValue: Date | null | undefined;
    if (isPastDue) gracePeriodEndValue = new Date(Date.now() + GRACE_DAYS_MS);
    else if (isActive) gracePeriodEndValue = null;
    else gracePeriodEndValue = undefined;
    await prisma.workspace.updateMany({
        where: { subscriptionId: subscription.id },
        data: {
            plan: planId,
            subscriptionStatus: subscription.status,
            leadsLimit: plan.leadsLimit,
            leadsUsed: isActive ? 0 : undefined,
            currentPeriodEnd: periodEnd(subscription),
            billingCycle,
            gracePeriodEnd: gracePeriodEndValue,
            pendingPlanId: null,
            pendingPlanEffectiveAt: null,
        },
    });
}

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
        const res = await handleCheckoutCompleted(session);
        if (res) return res;
    }

    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
        const subscription = event.data.object as unknown as SubscriptionWithPeriod;
        if (event.type === 'customer.subscription.deleted') {
            await handleSubscriptionDeleted(subscription);
        } else {
            await handleSubscriptionUpdated(subscription);
        }
    }

    if (event.type === 'charge.refunded') {
        const charge = event.data.object as Stripe.Charge & { invoice?: string };
        try {
            if (charge.invoice) {
                const invoiceRaw = await stripe.invoices.retrieve(charge.invoice);
                const invoice = invoiceRaw as { subscription?: string | { id?: string } };
                const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
                if (subId) {
                    const cancelled = await cancelCommissionsByOrderOrSubscription(null, subId);
                    const { logger } = await import('@/lib/logger');
                    if (cancelled > 0) logger.info('Affiliate commissions cancelled (refund)', { subscriptionId: subId, count: cancelled });
                }
            }
        } catch (e) {
            const { logger } = await import('@/lib/logger');
            logger.error('Affiliate cancel commissions on refund failed', { error: e instanceof Error ? e.message : 'Unknown' });
        }
    }

    if (event.type === 'invoice.paid') {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id?: string }; amount_paid?: number; currency?: string };
        const billingReason = (invoice as { billing_reason?: string }).billing_reason;
        if (billingReason === 'subscription_cycle' && invoice.subscription) {
            const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
            if (subId) {
            try {
                const sub = await stripe.subscriptions.retrieve(subId);
                const periodStart = (invoice as { period_start?: number }).period_start ?? 0;
                const isFirstInvoice = periodStart <= sub.created + 60;
                if (!isFirstInvoice) {
                    const workspace = await prisma.workspace.findFirst({
                        where: { subscriptionId: subId },
                        select: { id: true, plan: true },
                    });
                    if (workspace) {
                        const planId = (workspace.plan || 'BASIC') as PlanType;
                        const valueCents = invoice.amount_paid ?? 0;
                        const currency = (invoice.currency ?? 'usd').toUpperCase();
                        await createCommissionForRecurring({
                            workspaceId: workspace.id,
                            subscriptionId: subId,
                            planId,
                            valueCents,
                            currency: currency === 'USD' ? 'USD' : 'BRL',
                            orderId: invoice.id,
                        });
                    }
                }
            } catch (e) {
                const { logger } = await import('@/lib/logger');
                logger.error('Affiliate recurring commission failed', { error: e instanceof Error ? e.message : 'Unknown' });
            }
            }
        }
    }

    return NextResponse.json({ received: true });
}
