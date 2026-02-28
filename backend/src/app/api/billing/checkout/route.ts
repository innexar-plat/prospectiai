import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { stripe } from '@/lib/stripe';
import { preference } from '@/lib/mercadopago';
import { createPreApproval } from '@/lib/mercadopago-subscription';
import { rateLimit } from '@/lib/ratelimit';
import { PLANS, PlanType, getPlanPrices, isDowngrade, isUpgrade, type BillingCycle } from '@/lib/billing-config';
import { logger } from '@/lib/logger';
import { checkoutSchema, formatZodError } from '@/lib/validations/schemas';
import { prisma } from '@/lib/prisma';
import { performScheduleDowngrade, ScheduleDowngradeError } from '@/lib/schedule-downgrade';

export async function POST(req: Request) {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { success } = await rateLimit(`checkout:${session.user.id}`, 10, 60);
    if (!success) {
        return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    try {
        const body = await req.json();
        const parsed = checkoutSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const { planId, interval, cycle: cycleParam, locale, card_token_id, scheduleAtPeriodEnd } = parsed.data;
        const cycle: BillingCycle = (interval ?? cycleParam) === 'annual' ? 'annual' : 'monthly';
        const plan = PLANS[planId as PlanType];

        if (!plan || planId === 'FREE') {
            return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
        }

        const userWithWorkspace = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { workspaces: { take: 1, include: { workspace: true } } },
        });
        const workspace = userWithWorkspace?.workspaces?.[0]?.workspace;
        const currentPlan = workspace?.plan as PlanType | undefined;
        const isDowngradeRequest =
            scheduleAtPeriodEnd === true &&
            currentPlan != null &&
            workspace != null &&
            isDowngrade(currentPlan, planId as PlanType);

        if (scheduleAtPeriodEnd === true && !isDowngradeRequest) {
            const reasons: string[] = [];
            if (currentPlan == null) reasons.push('no_current_plan');
            if (!workspace) reasons.push('no_workspace');
            if (currentPlan != null && !isDowngrade(currentPlan, planId as PlanType)) reasons.push('not_downgrade_tier');
            logger.info('Checkout: scheduleAtPeriodEnd true but not treating as downgrade', {
                userId: session.user.id,
                planId,
                currentPlan: currentPlan ?? null,
                hasWorkspace: !!workspace,
                reasons,
            });
        }

        if (isDowngradeRequest && workspace) {
            try {
                const result = await performScheduleDowngrade(
                    {
                        id: workspace.id,
                        plan: workspace.plan,
                        subscriptionId: workspace.subscriptionId,
                        currentPeriodEnd: workspace.currentPeriodEnd,
                    },
                    planId
                );
                return NextResponse.json({
                    url: null,
                    scheduled: true,
                    message: result.message,
                    pendingPlanEffectiveAt: result.pendingPlanEffectiveAt,
                });
            } catch (scheduleErr: unknown) {
                if (scheduleErr instanceof ScheduleDowngradeError) {
                    return NextResponse.json({ error: scheduleErr.error }, { status: scheduleErr.status });
                }
                throw scheduleErr;
            }
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        const localePath = locale || 'pt';

        // Stripe: upgrade (paid → higher plan) with proration — update subscription instead of new checkout
        const isStripeSubscription = workspace?.subscriptionId != null && workspace.subscriptionId.startsWith('sub_');
        const isUpgradeRequest =
            currentPlan != null &&
            currentPlan !== 'FREE' &&
            workspace != null &&
            isUpgrade(currentPlan as PlanType, planId as PlanType);

        if (localePath !== 'pt' && isUpgradeRequest && isStripeSubscription && workspace) {
            try {
                const subscription = await stripe.subscriptions.retrieve(workspace.subscriptionId!, {
                    expand: ['items.data.price', 'items.data.price.product'],
                });
                const item = subscription.items.data[0];
                const price = item?.price as { recurring?: { interval?: string }; product?: string } | undefined;
                const stripeInterval = price?.recurring?.interval ?? 'month';
                const productId = typeof price?.product === 'string' ? price.product : undefined;
                const sameCycle =
                    (cycle === 'monthly' && stripeInterval === 'month') ||
                    (cycle === 'annual' && stripeInterval === 'year');
                if (!item || !sameCycle || !productId) {
                    // Fall through to create new checkout (e.g. cycle change, missing item, or no product)
                } else {
                    const subId = workspace.subscriptionId as string;
                    const newPriceCents = Math.round(getPlanPrices(plan, cycle).price_usd * 100);
                    await stripe.subscriptions.update(subId, {
                        items: [
                            {
                                id: item.id,
                                price_data: {
                                    currency: 'usd',
                                    unit_amount: newPriceCents,
                                    recurring: { interval: stripeInterval },
                                    product: productId,
                                },
                            },
                        ],
                        proration_behavior: 'always_invoice',
                        metadata: { planId, userId: session.user.id, interval: cycle },
                    });
                    logger.info('Stripe subscription upgraded with proration', {
                        userId: session.user.id,
                        workspaceId: workspace.id,
                        from: currentPlan,
                        to: planId,
                        cycle,
                    });
                    const successUrl = `${appUrl}/${localePath}/billing/success?upgraded=1`;
                    return NextResponse.json({ url: successUrl });
                }
            } catch (upgradeErr: unknown) {
                logger.error('Stripe upgrade failed', {
                    userId: session.user.id,
                    error: upgradeErr instanceof Error ? upgradeErr.message : 'Unknown',
                });
                return NextResponse.json(
                    { error: 'Failed to upgrade subscription. Try again or use checkout.' },
                    { status: 502 }
                );
            }
        }

        const { price_brl: priceBrl, price_usd: priceUsd } = getPlanPrices(plan, cycle);

        if (localePath === 'pt') {
            // MP: upgrade (paid → higher plan) currently charges full new plan price; proration can be added later.
            if (card_token_id) {
                // Recurring subscription with card (PreApproval). No installments.
                const preApproval = await createPreApproval({
                    payerEmail: session.user.email,
                    cardTokenId: card_token_id,
                    reason: `ProspectorAI Plano ${plan.name} (${cycle})`,
                    externalReference: `${session.user.id}:${planId}:${cycle}`,
                    transactionAmount: priceBrl,
                    cycle,
                    backUrl: `${appUrl}/${localePath}/billing/success`,
                    notificationUrl: `${appUrl}/api/billing/webhook/mercadopago`,
                });
                logger.info('MP PreApproval Created', { preApprovalId: preApproval.id, status: preApproval.status });
                const url = preApproval.init_point || `${appUrl}/${localePath}/billing/success`;
                return NextResponse.json({ url });
            }
            // PIX / boleto: one-time Preference. Activate only on webhook approved. No installments.
            const mpPreference = await preference.create({
                body: {
                    items: [
                        {
                            id: `${planId}_${cycle}`,
                            title: `ProspectorAI Plano ${plan.name} (${cycle})`,
                            description: `Assinatura ${cycle} para ${plan.leadsLimit} buscas por mês.`,
                            quantity: 1,
                            unit_price: priceBrl,
                            currency_id: 'BRL'
                        }
                    ],
                    back_urls: {
                        success: `${appUrl}/${localePath}/dashboard`,
                        failure: `${appUrl}/${localePath}/dashboard`,
                        pending: `${appUrl}/${localePath}/dashboard`
                    },
                    auto_return: 'approved',
                    notification_url: `${appUrl}/api/billing/webhook/mercadopago`,
                    metadata: {
                        user_id: session.user.id,
                        plan_id: planId,
                        interval: cycle
                    },
                    payer: {
                        email: session.user.email,
                        name: session.user.name || 'Cliente ProspectorAI',
                    },
                }
            });

            logger.info('MP Preference Created', {
                preferenceId: mpPreference.id,
                initPoint: mpPreference.init_point,
            });

            return NextResponse.json({ url: mpPreference.init_point });
        } else {
            // Stripe Checkout (International)
            const stripeSession = await stripe.checkout.sessions.create({
                customer_email: session.user.email,
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            product_data: {
                                name: `ProspectorAI ${plan.name} Plan (${cycle})`,
                                description: `Subscription for ${plan.leadsLimit} leads searches per month.`,
                            },
                            unit_amount: priceUsd * 100,
                            recurring: { interval: cycle === 'annual' ? 'year' : 'month' },
                        },
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                success_url: `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/pricing`,
                metadata: {
                    userId: session.user.id,
                    planId,
                    interval: cycle
                },
            });

            return NextResponse.json({ url: stripeSession.url });
        }
    } catch (error) {
        logger.error('Checkout failed', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
}
