import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { stripe } from '@/lib/stripe';
import { preference } from '@/lib/mercadopago';
import { createPreApproval } from '@/lib/mercadopago-subscription';
import { rateLimit } from '@/lib/ratelimit';
import { getMarketPlanPrices } from '@/lib/billing-prices';
import {
    buildMpExternalReference,
    buildPromoCheckoutContext,
    canApplyStarterPromo,
    resolveCheckoutPlanId,
    resolvePromoIdFromInput,
    verifyPromoToken,
    type StarterPromoId,
} from '@/lib/billing-promo';
import { PLANS, PlanType, getPlanPrices, isDowngrade, isUpgrade, type BillingCycle } from '@/lib/billing-config';
import { logger } from '@/lib/logger';
import { checkoutSchema, formatZodError } from '@/lib/validations/schemas';
import { prisma } from '@/lib/prisma';
import { performScheduleDowngrade, ScheduleDowngradeError } from '@/lib/schedule-downgrade';
import { getSiteUrlFromRequest } from '@/lib/site-url';
import { getMarketConfig, getMarketLeadsLimit, getRequestMarket, isMarketFeatureEnabled } from '@/lib/market';
import {
    notifyCheckoutStarted,
    notifyPaymentCreated,
    notifyPlanDowngradeScheduled,
    notifyPlanUpgrade,
} from '@/lib/telegram-business-alerts';
import type { Workspace } from '@prisma/client';

type WorkspaceForCheckout = Pick<Workspace, 'id' | 'plan' | 'subscriptionId' | 'currentPeriodEnd' | 'billingCycle'>;
type SessionUser = { id: string; email?: string | null; name?: string | null };

type CheckoutContext = {
    workspace: WorkspaceForCheckout | null | undefined;
    plan: { name: string; leadsLimit: number };
    cycle: BillingCycle;
    planId: string;
    appUrl: string;
    localePath: string;
    market: ReturnType<typeof getRequestMarket>;
    useMercadoPago: boolean;
    isDowngradeRequest: boolean;
    isUpgradeRequest: boolean;
    isStripeSubscription: boolean;
    priceBrl: number;
    priceUsd: number;
    cardTokenId: string | undefined;
    affiliateCode: string | undefined;
    promoId?: StarterPromoId;
    promoPaymentsMonths?: number;
    promoRegularPriceBrl?: number;
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

function logScheduleAtPeriodEndNotDowngrade(
    userId: string,
    planId: string,
    workspace: WorkspaceForCheckout | undefined,
): void {
    const reasons: string[] = [];
    if (workspace?.plan == null) reasons.push('no_current_plan');
    if (!workspace) reasons.push('no_workspace');
    if (workspace?.plan != null && !isDowngrade(workspace.plan, planId as PlanType)) reasons.push('not_downgrade_tier');
    logger.info('Checkout: scheduleAtPeriodEnd true but not treating as downgrade', {
        userId,
        planId,
        currentPlan: workspace?.plan ?? null,
        hasWorkspace: !!workspace,
        reasons,
    });
}

async function getCheckoutContext(
    session: { user: SessionUser },
    parsed: { data: { planId: string; interval?: string; cycle?: string; locale?: string; card_token_id?: string; scheduleAtPeriodEnd?: boolean; affiliateCode?: string; promoCode?: string; promoToken?: string } },
    appUrl: string,
    market: ReturnType<typeof getRequestMarket>,
): Promise<CheckoutContextResult> {
    const { planId: rawPlanId, interval, cycle: cycleParam, locale, card_token_id, scheduleAtPeriodEnd, affiliateCode, promoCode, promoToken } = parsed.data;
    const cycle: BillingCycle = (interval ?? cycleParam) === 'annual' ? 'annual' : 'monthly';

    let promoId = resolvePromoIdFromInput(promoCode, rawPlanId);
    if (!promoId && promoToken) {
        const verified = verifyPromoToken(promoToken, session.user.id);
        if (verified.valid && verified.promoId) {
            promoId = verified.promoId;
        }
    }

    const resolvedPlanId = resolveCheckoutPlanId(rawPlanId);
    if (!resolvedPlanId || resolvedPlanId === 'FREE' || resolvedPlanId === 'TRIAL') {
        return { ok: false, error: NextResponse.json({ error: 'Invalid plan' }, { status: 400 }) };
    }

    const planDef = PLANS[resolvedPlanId];
    const plan = {
        name: planDef.name,
        leadsLimit: getMarketLeadsLimit(resolvedPlanId, market),
    };
    const userWithWorkspace = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { workspaces: { take: 1, include: { workspace: true } } },
    });
    const workspace = userWithWorkspace?.workspaces?.[0]?.workspace as WorkspaceForCheckout | undefined;

    if (promoId) {
        if (cycle !== 'monthly') {
            return { ok: false, error: NextResponse.json({ error: 'Promo applies to monthly billing only' }, { status: 400 }) };
        }
        if (!workspace || !canApplyStarterPromo(workspace, market, cycle)) {
            return { ok: false, error: NextResponse.json({ error: 'Promo not eligible for this account' }, { status: 403 }) };
        }
        if (resolvedPlanId !== 'BASIC') {
            return { ok: false, error: NextResponse.json({ error: 'Promo applies to Starter plan only' }, { status: 400 }) };
        }
    }

    const { isDowngradeRequest, isUpgradeRequest, isStripeSubscription } = computeCheckoutFlags(workspace, resolvedPlanId, scheduleAtPeriodEnd === true);
    if (scheduleAtPeriodEnd === true && !isDowngradeRequest) {
        logScheduleAtPeriodEndNotDowngrade(session.user.id, resolvedPlanId, workspace);
    }

    const promoContext = promoId ? buildPromoCheckoutContext(promoId) : null;
    const marketPrices = getMarketPlanPrices(resolvedPlanId, cycle, market, promoId ? { promoId } : undefined);
    const basePrices = getPlanPrices(planDef, cycle);
    const priceBrl = promoContext
        ? promoContext.priceBrl
        : market === 'BR'
            ? marketPrices.primary
            : basePrices.price_brl;
    const priceUsd = market === 'US' ? marketPrices.primary : basePrices.price_usd;
    const checkoutLocale = locale || getMarketConfig(market).checkoutLocale;
    return {
        ok: true,
        ctx: {
            workspace: workspace ?? null,
            plan,
            cycle,
            planId: resolvedPlanId,
            appUrl,
            localePath: checkoutLocale,
            market,
            useMercadoPago: isMarketFeatureEnabled('mercadoPago', market),
            isDowngradeRequest,
            isUpgradeRequest,
            isStripeSubscription,
            priceBrl,
            priceUsd,
            cardTokenId: card_token_id,
            affiliateCode: affiliateCode ?? undefined,
            promoId: promoId ?? undefined,
            promoPaymentsMonths: promoContext?.months,
            promoRegularPriceBrl: promoContext?.regularPriceBrl,
        },
    };
}

async function executeStripeCheckout(
    sessionUser: SessionUser,
    planId: string,
    plan: { name: string; leadsLimit: number },
    cycle: BillingCycle,
    priceUsd: number,
    locale: string,
    appUrl: string,
    currentPlan?: string | null,
    workspaceId?: string | null,
    affiliateCode?: string,
): Promise<NextResponse> {
    const metadata: Record<string, string> = { userId: sessionUser.id, planId, interval: cycle };
    if (affiliateCode) metadata.affiliateCode = affiliateCode;
    const base = appUrl.replace(/\/$/, '');
    const localeSegment = locale === 'en' ? 'en' : locale === 'es' ? 'es' : 'pt';
    const stripeLocale = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es' : 'en';
    const stripeSession = await stripe.checkout.sessions.create({
        customer_email: sessionUser.email ?? undefined,
        locale: stripeLocale,
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `Precision AI ${plan.name} Plan (${cycle})`,
                        description: `Subscription for ${plan.leadsLimit} leads searches per month.`,
                    },
                    unit_amount: priceUsd * 100,
                    recurring: { interval: cycle === 'annual' ? 'year' : 'month' },
                },
                quantity: 1,
            },
        ],
        mode: 'subscription',
        subscription_data: { metadata },
        success_url: `${base}/${localeSegment}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/dashboard/planos`,
        metadata,
    });

    notifyCheckoutStarted({
        userId: sessionUser.id,
        userEmail: sessionUser.email,
        userName: sessionUser.name,
        workspaceId,
        fromPlan: currentPlan,
        toPlan: planId,
        billingCycle: cycle,
        provider: 'stripe',
        amount: priceUsd,
        currency: 'USD',
    });

    return NextResponse.json({ url: stripeSession.url });
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
                billingCycle: workspace.billingCycle,
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
    const newPriceCents = Math.round(getMarketPlanPrices(planId as PlanType, cycle, 'US').primary * 100);
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

    notifyPlanUpgrade({
        userId,
        workspaceId: workspace.id,
        fromPlan: workspace.plan,
        toPlan: planId,
        billingCycle: cycle,
        provider: 'stripe',
        subscriptionId: subId,
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
    currentPlan?: string | null;
    workspaceId?: string | null;
    affiliateCode?: string;
    promoId?: StarterPromoId;
    promoPaymentsMonths?: number;
    promoRegularPriceBrl?: number;
}): Promise<NextResponse> {
    const {
        cardTokenId, planId, cycle, plan, priceBrl, sessionUser, appUrl, localePath,
        currentPlan, workspaceId, affiliateCode, promoId, promoPaymentsMonths, promoRegularPriceBrl,
    } = params;
    if (cardTokenId) {
        const extRef = buildMpExternalReference({
            userId: sessionUser.id,
            planId: planId as PlanType,
            cycle,
            affiliateCode,
            promoId,
        });
        const preApproval = await createPreApproval({
            payerEmail: sessionUser.email ?? '',
            cardTokenId,
            reason: promoId
                ? `Precision IA Plano ${plan.name} — promo ${promoPaymentsMonths} meses`
                : `Precision IA Plano ${plan.name} (${cycle})`,
            externalReference: extRef,
            transactionAmount: priceBrl,
            cycle,
            backUrl: `${appUrl}/dashboard/planos?billing=success`,
            notificationUrl: `${appUrl}/api/billing/webhook/mercadopago`,
        });
        logger.info('MP PreApproval Created', { preApprovalId: preApproval.id, status: preApproval.status, promoId });
        if (workspaceId && promoId && promoPaymentsMonths && promoRegularPriceBrl) {
            await prisma.workspace.update({
                where: { id: workspaceId },
                data: {
                    starterPromoCode: promoId,
                    promoPaymentsRemaining: promoPaymentsMonths,
                    promoRegularAmountBrl: promoRegularPriceBrl,
                    starterPromoEligible: false,
                },
            });
        }
        notifyPaymentCreated({
            userId: sessionUser.id,
            userEmail: sessionUser.email,
            userName: sessionUser.name,
            workspaceId,
            fromPlan: currentPlan,
            toPlan: planId,
            billingCycle: cycle,
            provider: 'mercadopago',
            amount: priceBrl,
            currency: 'BRL',
            paymentId: preApproval.id,
            subscriptionId: preApproval.id,
            status: preApproval.status,
        });
        const url = preApproval.init_point || `${appUrl}/dashboard/planos?billing=success`;
        return NextResponse.json({ url });
    }
    const mpUrl = await createMPCheckoutUrl(
        planId, cycle, plan, priceBrl, sessionUser, appUrl, localePath, affiliateCode, promoId,
    );
    return NextResponse.json({ url: mpUrl });
}

async function createMPCheckoutUrl(
    planId: string,
    cycle: BillingCycle,
    plan: { name: string; leadsLimit: number },
    priceBrl: number,
    user: SessionUser,
    appUrl: string,
    _localePath: string,
    affiliateCode?: string,
    promoId?: StarterPromoId,
): Promise<string> {
    const fullName = user.name || 'Cliente Precision IA';
    const spaceIdx = fullName.trim().indexOf(' ');
    const name = spaceIdx > 0 ? fullName.trim().slice(0, spaceIdx) : fullName.trim();
    const surname = spaceIdx > 0 ? fullName.trim().slice(spaceIdx + 1) : '.';
    const promoLabel = promoId ? ` — promo 6 meses` : '';
    const mpPreference = await preference.create({
        body: {
            items: [
                {
                    id: `${planId}_${cycle}${promoId ? '_promo' : ''}`,
                    title: `Precision IA Plano ${plan.name} (${cycle})${promoLabel}`,
                    description: promoId
                        ? `Assinatura promocional R$${priceBrl}/mês por 6 meses. Depois R$99/mês. ${plan.leadsLimit} buscas/mês.`
                        : `Assinatura ${cycle} para ${plan.leadsLimit} buscas por mês.`,
                    quantity: 1,
                    unit_price: priceBrl,
                    currency_id: 'BRL'
                }
            ],
            back_urls: {
                success: `${appUrl}/dashboard/planos?billing=success`,
                failure: `${appUrl}/dashboard/planos?billing=failure`,
                pending: `${appUrl}/dashboard/planos?billing=pending`
            },
            auto_return: 'approved',
            notification_url: `${appUrl}/api/billing/webhook/mercadopago`,
            metadata: {
                user_id: user.id,
                plan_id: planId,
                interval: cycle,
                ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
                ...(promoId ? { promo_id: promoId } : {}),
            },
            payer: { email: user.email ?? '', name, surname: surname || '.' },
        }
    });
    logger.info('MP Preference Created', { preferenceId: mpPreference.id, initPoint: mpPreference.init_point });
    notifyPaymentCreated({
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        toPlan: planId,
        billingCycle: cycle,
        provider: 'mercadopago',
        amount: priceBrl,
        currency: 'BRL',
        paymentId: mpPreference.id,
    });
    return mpPreference.init_point ?? '';
}

async function executeCheckoutFlow(
    ctx: CheckoutContext,
    userId: string,
    sessionUser: SessionUser,
): Promise<NextResponse> {
    if (ctx.isDowngradeRequest && ctx.workspace) {
        const downgradeRes = await tryScheduleDowngrade(ctx.workspace, ctx.planId);
        if (downgradeRes) {
            notifyPlanDowngradeScheduled({
                userId,
                userEmail: sessionUser.email,
                userName: sessionUser.name,
                workspaceId: ctx.workspace.id,
                fromPlan: ctx.workspace.plan,
                toPlan: ctx.planId,
                billingCycle: ctx.cycle,
                provider: ctx.isStripeSubscription ? 'stripe' : 'mercadopago',
                effectiveAt: ctx.workspace.currentPeriodEnd?.toISOString() ?? null,
            });
            return downgradeRes;
        }
    }
    if (!ctx.useMercadoPago && ctx.isUpgradeRequest && ctx.isStripeSubscription && ctx.workspace) {
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
    if (ctx.useMercadoPago) {
        return handlePtLocaleCheckout({
            cardTokenId: ctx.cardTokenId,
            planId: ctx.planId,
            cycle: ctx.cycle,
            plan: ctx.plan,
            priceBrl: ctx.priceBrl,
            sessionUser,
            appUrl: ctx.appUrl,
            localePath: ctx.localePath,
            currentPlan: ctx.workspace?.plan,
            workspaceId: ctx.workspace?.id,
            affiliateCode: ctx.affiliateCode,
            promoId: ctx.promoId,
            promoPaymentsMonths: ctx.promoPaymentsMonths,
            promoRegularPriceBrl: ctx.promoRegularPriceBrl,
        });
    }
    return executeStripeCheckout(
        sessionUser,
        ctx.planId,
        ctx.plan,
        ctx.cycle,
        ctx.priceUsd,
        ctx.localePath,
        ctx.appUrl,
        ctx.workspace?.plan,
        ctx.workspace?.id,
        ctx.affiliateCode,
    );
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
        const appUrl = getSiteUrlFromRequest(req);
        const market = getRequestMarket(req);
        const contextResult = await getCheckoutContext(session, parsed, appUrl, market);
        if (!contextResult.ok) return contextResult.error;
        return executeCheckoutFlow(contextResult.ctx, session.user.id, session.user);
    } catch (error) {
        logger.error('Checkout failed', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
}
