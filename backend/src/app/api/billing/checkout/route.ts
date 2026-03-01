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
import type { Workspace } from '@prisma/client';

type WorkspaceForCheckout = Pick<Workspace, 'id' | 'plan' | 'subscriptionId' | 'currentPeriodEnd'>;
type SessionUser = { id: string; email?: string | null; name?: string | null };

type CheckoutContext = {
    workspace: WorkspaceForCheckout | null | undefined;
    plan: { name: string; leadsLimit: number };
    cycle: BillingCycle;
    planId: string;
    appUrl: string;
    localePath: string;
    isDowngradeRequest: boolean;
    isUpgradeRequest: boolean;
    isStripeSubscription: boolean;
    priceBrl: number;
    priceUsd: number;
    cardTokenId: string | undefined;
};

type CheckoutContextResult = { ok: true; ctx: CheckoutContext } | { ok: false; error: NextResponse };

function computeCheckoutFlags(
    workspace: WorkspaceForCheckout | undefined,
    planId: string,
    scheduleAtPeriodEnd: boolean,
): { isDowngradeRequest: boolean; isUpgradeRequest: boolean; isStripeSubscription: boolean } {
    const currentPlan = workspace?.plan;
    const isDowngradeRequest =
        scheduleAtPeriodEnd === true &&
        currentPlan != null &&
        workspace != null &&
        isDowngrade(currentPlan, planId as PlanType);
    const isStripeSubscription = workspace?.subscriptionId != null && workspace.subscriptionId.startsWith('sub_');
    const isUpgradeRequest =
        currentPlan != null &&
        currentPlan !== 'FREE' &&
        workspace != null &&
        isUpgrade(currentPlan as PlanType, planId as PlanType);
    return { isDowngradeRequest, isUpgradeRequest, isStripeSubscription };
}

async function getCheckoutContext(
    session: { user: SessionUser },
    parsed: { data: { planId: string; interval?: string; cycle?: string; locale?: string; card_token_id?: string; scheduleAtPeriodEnd?: boolean } },
): Promise<CheckoutContextResult> {
    const { planId, interval, cycle: cycleParam, locale, card_token_id, scheduleAtPeriodEnd } = parsed.data;
    const cycle: BillingCycle = (interval ?? cycleParam) === 'annual' ? 'annual' : 'monthly';
    const plan = PLANS[planId as PlanType];
    if (!plan || planId === 'FREE') {
        return { ok: false, error: NextResponse.json({ error: 'Invalid plan' }, { status: 400 }) };
    }
    const userWithWorkspace = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { workspaces: { take: 1, include: { workspace: true } } },
    });
    const workspace = userWithWorkspace?.workspaces?.[0]?.workspace as WorkspaceForCheckout | undefined;
    const { isDowngradeRequest, isUpgradeRequest, isStripeSubscription } = computeCheckoutFlags(workspace, planId, scheduleAtPeriodEnd === true);
    if (scheduleAtPeriodEnd === true && !isDowngradeRequest) {
        const reasons: string[] = [];
        if (workspace?.plan == null) reasons.push('no_current_plan');
        if (!workspace) reasons.push('no_workspace');
        if (workspace?.plan != null && !isDowngrade(workspace.plan, planId as PlanType)) reasons.push('not_downgrade_tier');
        logger.info('Checkout: scheduleAtPeriodEnd true but not treating as downgrade', {
            userId: session.user.id,
            planId,
            currentPlan: workspace?.plan ?? null,
            hasWorkspace: !!workspace,
            reasons,
        });
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const localePath = locale || 'pt';
    const { price_brl: priceBrl, price_usd: priceUsd } = getPlanPrices(plan, cycle);
    return {
        ok: true,
        ctx: {
            workspace: workspace ?? null,
            plan,
            cycle,
            planId,
            appUrl,
            localePath,
            isDowngradeRequest,
            isUpgradeRequest,
            isStripeSubscription,
            priceBrl,
            priceUsd,
            cardTokenId: card_token_id,
        },
    };
}

function executeStripeCheckout(
    sessionUser: SessionUser,
    planId: string,
    plan: { name: string; leadsLimit: number },
    cycle: BillingCycle,
    priceUsd: number,
    locale: string,
): Promise<NextResponse> {
    return stripe.checkout.sessions
        .create({
            customer_email: sessionUser.email ?? undefined,
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
            metadata: { userId: sessionUser.id, planId, interval: cycle },
        })
        .then((stripeSession) => NextResponse.json({ url: stripeSession.url }));
}

async function tryScheduleDowngrade(
    workspace: WorkspaceForCheckout,
    planId: string,
): Promise<NextResponse | null> {
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

async function tryStripeUpgrade(
    workspace: WorkspaceForCheckout,
    planId: string,
    cycle: BillingCycle,
    plan: { name: string; leadsLimit: number },
    userId: string,
    appUrl: string,
    localePath: string,
): Promise<NextResponse | null> {
    const subId = workspace.subscriptionId as string;
    const subscription = await stripe.subscriptions.retrieve(subId, {
        expand: ['items.data.price', 'items.data.price.product'],
    });
    const item = subscription.items.data[0];
    const price = item?.price as { recurring?: { interval?: string }; product?: string } | undefined;
    const stripeInterval = price?.recurring?.interval ?? 'month';
    const productId = typeof price?.product === 'string' ? price.product : undefined;
    const sameCycle =
        (cycle === 'monthly' && stripeInterval === 'month') ||
        (cycle === 'annual' && stripeInterval === 'year');
    if (!item || !sameCycle || !productId) return null;
    const newPriceCents = Math.round(getPlanPrices(PLANS[planId as PlanType], cycle).price_usd * 100);
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
        metadata: { planId, userId, interval: cycle },
    });
    logger.info('Stripe subscription upgraded with proration', {
        userId,
        workspaceId: workspace.id,
        from: workspace.plan,
        to: planId,
        cycle,
    });
    return NextResponse.json({ url: `${appUrl}/${localePath}/billing/success?upgraded=1` });
}

async function handlePtLocaleCheckout(params: {
    cardTokenId: string | undefined;
    planId: string;
    cycle: BillingCycle;
    plan: { name: string; leadsLimit: number };
    priceBrl: number;
    sessionUser: SessionUser;
    appUrl: string;
    localePath: string;
}): Promise<NextResponse> {
    const { cardTokenId, planId, cycle, plan, priceBrl, sessionUser, appUrl, localePath } = params;
    if (cardTokenId) {
        const preApproval = await createPreApproval({
            payerEmail: sessionUser.email ?? '',
            cardTokenId,
            reason: `ProspectorAI Plano ${plan.name} (${cycle})`,
            externalReference: `${sessionUser.id}:${planId}:${cycle}`,
            transactionAmount: priceBrl,
            cycle,
            backUrl: `${appUrl}/${localePath}/billing/success`,
            notificationUrl: `${appUrl}/api/billing/webhook/mercadopago`,
        });
        logger.info('MP PreApproval Created', { preApprovalId: preApproval.id, status: preApproval.status });
        const url = preApproval.init_point || `${appUrl}/${localePath}/billing/success`;
        return NextResponse.json({ url });
    }
    const mpUrl = await createMPCheckoutUrl(planId, cycle, plan, priceBrl, sessionUser, appUrl, localePath);
    return NextResponse.json({ url: mpUrl });
}

async function createMPCheckoutUrl(
    planId: string,
    cycle: BillingCycle,
    plan: { name: string; leadsLimit: number },
    priceBrl: number,
    user: SessionUser,
    appUrl: string,
    localePath: string,
): Promise<string> {
    const fullName = user.name || 'Cliente ProspectorAI';
    const spaceIdx = fullName.trim().indexOf(' ');
    const name = spaceIdx > 0 ? fullName.trim().slice(0, spaceIdx) : fullName.trim();
    const surname = spaceIdx > 0 ? fullName.trim().slice(spaceIdx + 1) : '.';
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
            metadata: { user_id: user.id, plan_id: planId, interval: cycle },
            payer: { email: user.email ?? '', name, surname: surname || '.' },
        }
    });
    logger.info('MP Preference Created', { preferenceId: mpPreference.id, initPoint: mpPreference.init_point });
    return mpPreference.init_point ?? '';
}

async function executeCheckoutFlow(
    ctx: CheckoutContext,
    userId: string,
    sessionUser: SessionUser,
): Promise<NextResponse> {
    if (ctx.isDowngradeRequest && ctx.workspace) {
        const downgradeRes = await tryScheduleDowngrade(ctx.workspace, ctx.planId);
        if (downgradeRes) return downgradeRes;
    }
    if (ctx.localePath !== 'pt' && ctx.isUpgradeRequest && ctx.isStripeSubscription && ctx.workspace) {
        try {
            const upgradeRes = await tryStripeUpgrade(
                ctx.workspace,
                ctx.planId,
                ctx.cycle,
                ctx.plan,
                userId,
                ctx.appUrl,
                ctx.localePath,
            );
            if (upgradeRes) return upgradeRes;
        } catch (upgradeErr: unknown) {
            logger.error('Stripe upgrade failed', {
                userId,
                error: upgradeErr instanceof Error ? upgradeErr.message : 'Unknown',
            });
            return NextResponse.json(
                { error: 'Failed to upgrade subscription. Try again or use checkout.' },
                { status: 502 }
            );
        }
    }
    if (ctx.localePath === 'pt') {
        return handlePtLocaleCheckout({
            cardTokenId: ctx.cardTokenId,
            planId: ctx.planId,
            cycle: ctx.cycle,
            plan: ctx.plan,
            priceBrl: ctx.priceBrl,
            sessionUser,
            appUrl: ctx.appUrl,
            localePath: ctx.localePath,
        });
    }
    return executeStripeCheckout(sessionUser, ctx.planId, ctx.plan, ctx.cycle, ctx.priceUsd, ctx.localePath);
}

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
        const contextResult = await getCheckoutContext(session, parsed);
        if (!contextResult.ok) return contextResult.error;
        return executeCheckoutFlow(contextResult.ctx, session.user.id, session.user);
    } catch (error) {
        logger.error('Checkout failed', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
}
