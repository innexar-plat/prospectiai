import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType, getPlanPrices } from '@/lib/billing-config';
import { getMarketLeadsLimit } from '@/lib/market';
import Stripe from 'stripe';
import { createCommissionForFirstPayment, cancelCommissionsByOrderOrSubscription, createCommissionForRecurring } from '@/lib/affiliate';
import { isWebhookDuplicate } from '@/lib/webhook-dedup';
import { rateLimit } from '@/lib/ratelimit';
import {
    notifyPaymentApproved,
    notifyPaymentFailed,
    notifyPaymentRefunded,
    notifyPaymentRenewed,
    notifyPlanUpgrade,
} from '@/lib/telegram-business-alerts';
import { logger } from '@/lib/logger';

type SubscriptionWithPeriod = Stripe.Subscription & { current_period_end: number };

async function handleRepCommission(repCode: string, userId: string, workspaceId: string, planId: string, valueCents: number, orderId: string, subscriptionId?: string): Promise<void> {
    try {
        const rep = await prisma.representative.findUnique({ where: { id: repCode } });
        if (!rep || rep.status !== 'ACTIVE') return;

        let repClient = await prisma.repClient.findFirst({
            where: { representativeId: rep.id, workspaceId },
        });
        if (!repClient) {
            // No lead was captured at signup (e.g. rep_code cookie set after registration) —
            // look up the real customer instead of showing a truncated user id as the name.
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
            repClient = await prisma.repClient.create({
                data: {
                    representativeId: rep.id,
                    workspaceId,
                    name: user?.name?.trim() || user?.email || `${userId.slice(0, 8)}...`,
                    email: user?.email,
                    planId,
                    status: 'ACTIVE',
                    valueCents,
                    signedAt: new Date(),
                },
            });
        } else {
            repClient = await prisma.repClient.update({
                where: { id: repClient.id },
                data: { planId, valueCents, status: 'ACTIVE' },
            });
        }

        const holdUntil = new Date();
        holdUntil.setDate(holdUntil.getDate() + rep.commissionHoldDays);

        const commission = await prisma.repCommission.create({
            data: {
                representativeId: rep.id,
                source: 'DIRECT_CLIENT',
                repClientId: repClient.id,
                orderId: orderId || null,
                subscriptionId: subscriptionId || null,
                amountCents: Math.floor((valueCents * Number(rep.directCommissionPct)) / 100),
                commissionPercent: rep.directCommissionPct,
                status: 'PENDING',
                holdUntil,
            },
        });

        await prisma.representative.update({
            where: { id: rep.id },
            data: { lastActivityAt: new Date() },
        });

        logger.info('Rep commission created (Stripe)', { repId: rep.id, commissionId: commission.id, amountCents: commission.amountCents, userId, workspaceId });
    } catch (e) {
        logger.error('Rep commission creation failed (Stripe)', { error: e instanceof Error ? e.message : 'Unknown', repCode, userId, workspaceId });
    }
}

const PROBE_USER_AGENT = /curl|healthcheck|kube-probe|ELB-HealthChecker|Go-http-client/i;

function isWebhookProbeRequest(req: Request): boolean {
    const userAgent = req.headers.get('user-agent') ?? '';
    return PROBE_USER_AGENT.test(userAgent);
}

async function logWebhookVerificationFailure(
    req: Request,
    signature: string | null,
    err: unknown,
): Promise<void> {
    const { logger } = await import('@/lib/logger');
    const payload = { error: err instanceof Error ? err.message : 'Unknown' };
    if (signature) {
        logger.error('Stripe webhook error', payload);
        return;
    }
    const message = isWebhookProbeRequest(req)
        ? 'Stripe webhook probe rejected'
        : 'Stripe webhook missing signature';
    logger.warn(message, payload);
}

function periodEnd(sub: SubscriptionWithPeriod): Date {
    return new Date(sub.current_period_end * 1000);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<NextResponse | null> {
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId as PlanType;
    const affiliateCode = session.metadata?.affiliateCode as string | undefined;
    const repCode = session.metadata?.rep as string | undefined;
    if (!userId) return NextResponse.json({ error: 'Missing userId in metadata' }, { status: 400 });
    if (!planId || !(planId in PLANS) || planId === 'FREE' || planId === 'TRIAL') {
        return NextResponse.json({ error: 'Invalid planId in metadata' }, { status: 400 });
    }

    const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as Stripe.Subscription as SubscriptionWithPeriod;
    const plan = PLANS[planId];
    const userWithWorkspace = await prisma.user.findUnique({
        where: { id: userId },
        include: { workspaces: { orderBy: { workspace: { createdAt: 'asc' } }, take: 1 } }
    });

    if (!userWithWorkspace?.workspaces[0]?.workspaceId) return null;
    const workspaceId = userWithWorkspace.workspaces[0].workspaceId;
    const interval = (subscription as { items?: { data?: Array<{ price?: { recurring?: { interval?: string } } }> } })
        .items?.data?.[0]?.price?.recurring?.interval;
    const billingCycle = interval === 'year' ? 'annual' : 'monthly';
    const priceUsd = getPlanPrices(plan, billingCycle).price_usd;
    await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
            subscriptionId: subscription.id,
            customerId: subscription.customer as string,
            plan: planId,
            subscriptionStatus: subscription.status,
            leadsLimit: getMarketLeadsLimit(planId, 'US'),
            leadsUsed: 0,
            currentPeriodEnd: periodEnd(subscription),
            billingCycle,
            gracePeriodEnd: null,
        },
    });

    notifyPaymentApproved({
        userId,
        userEmail: userWithWorkspace.email,
        workspaceId,
        toPlan: planId,
        billingCycle,
        provider: 'stripe',
        amount: priceUsd,
        currency: 'USD',
        paymentId: session.id,
        subscriptionId: subscription.id,
        status: subscription.status,
    });

    notifyPlanUpgrade({
        userId,
        userEmail: userWithWorkspace.email,
        workspaceId,
        toPlan: planId,
        billingCycle,
        provider: 'stripe',
        subscriptionId: subscription.id,
    });

    // Comissão afiliado (primeira conversão)
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

    if (repCode) {
        await handleRepCommission(repCode, userId, workspaceId, planId, valueCents, session.id, subscription.id);
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

    notifyPaymentFailed({
        provider: 'stripe',
        subscriptionId: subscription.id,
        toPlan: 'FREE',
        status: subscription.status,
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

    // Only clear pendingPlan fields if the plan actually changed (schedule applied).
    // Otherwise a card update or other subscription change would lose the scheduled downgrade.
    const workspace = await prisma.workspace.findFirst({
        where: { subscriptionId: subscription.id },
        select: { plan: true },
    });
    const planActuallyChanged = workspace != null && workspace.plan !== planId;

    await prisma.workspace.updateMany({
        where: { subscriptionId: subscription.id },
        data: {
            plan: planId,
            subscriptionStatus: subscription.status,
            leadsLimit: getMarketLeadsLimit(planId, 'US'),
            leadsUsed: isActive ? 0 : undefined,
            currentPeriodEnd: periodEnd(subscription),
            billingCycle,
            gracePeriodEnd: gracePeriodEndValue,
            ...(planActuallyChanged
                ? { pendingPlanId: null, pendingPlanEffectiveAt: null }
                : {}),
        },
    });

    if (isPastDue) {
        notifyPaymentFailed({
            provider: 'stripe',
            subscriptionId: subscription.id,
            toPlan: planId,
            billingCycle,
            status: subscription.status,
        });
    }
}

export async function POST(req: Request) {
    // Rate limit: 120 requests per minute per endpoint
    const rl = await rateLimit('webhook:stripe', 120, 60);
    if (!rl.success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature ?? '',
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err: unknown) {
        await logWebhookVerificationFailure(req, signature, err);
        return NextResponse.json({ error: 'Webhook Error' }, { status: 400 });
    }

    // Idempotency: skip duplicate webhook deliveries
    if (await isWebhookDuplicate('stripe', event.id)) {
        return NextResponse.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    if (event.type === 'checkout.session.completed') {
        const res = await handleCheckoutCompleted(session);
        if (res) return res;
    }

    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
        const subscription = event.data.object as SubscriptionWithPeriod;
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
                    notifyPaymentRefunded({
                        provider: 'stripe',
                        paymentId: charge.id,
                        subscriptionId: subId,
                        status: charge.status,
                    });
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
                    if (!workspace) {
                        const { logger } = await import('@/lib/logger');
                        logger.warn('invoice.paid: no workspace found for subscription', { subscriptionId: subId, invoiceId: invoice.id });
                    } else {
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
                        notifyPaymentRenewed({
                            workspaceId: workspace.id,
                            toPlan: planId,
                            provider: 'stripe',
                            paymentId: invoice.id,
                            subscriptionId: subId,
                            billingCycle: ((invoice as { lines?: { data?: Array<{ price?: { recurring?: { interval?: string } } }> } }).lines?.data?.[0]?.price?.recurring?.interval === 'year') ? 'annual' : 'monthly',
                            amount: valueCents / 100,
                            currency,
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
