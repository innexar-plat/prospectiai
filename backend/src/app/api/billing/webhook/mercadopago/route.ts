import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { mpConfig } from '@/lib/mercadopago';
import { Payment } from 'mercadopago';
import { cancelPreApproval, getPreApproval, updatePreApprovalAmount } from '@/lib/mercadopago-subscription';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType, getPlanPrices } from '@/lib/billing-config';
import { parseMpExternalReference, STARTER_PROMO_BR } from '@/lib/billing-promo';
import { getMarketLeadsLimit } from '@/lib/market';
import { sendEmail } from '@/lib/email';
import { paymentSuccessTemplate, paymentFailureTemplate } from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { extendPeriodEnd, freshCreditCycle, isMpPreapprovalId, toCycle } from '@/lib/billing-period';
import { freePlanData } from '@/lib/billing-lifecycle';
import { markPaymentRefunded, recordPayment } from '@/lib/billing-ledger';
import { recordWebhook } from '@/lib/ops-telemetry';
import { sendRenewalConfirmedEmail, sendSubscriptionCancelledEmail, type BillingRecipient } from '@/lib/billing-emails';
import { createCommissionForFirstPayment, cancelCommissionsByOrderOrSubscription, createCommissionForRecurring } from '@/lib/affiliate';
import { isWebhookDuplicate } from '@/lib/webhook-dedup';
import { rateLimit } from '@/lib/ratelimit';
import {
    notifyPaymentApproved,
    notifyPaymentCreated,
    notifyPaymentFailed,
    notifyPaymentRefunded,
    notifyPaymentRenewed,
    notifyPlanDowngradeScheduled,
    notifyPlanUpgrade,
} from '@/lib/telegram-business-alerts';

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

        logger.info('Rep commission created', { repId: rep.id, commissionId: commission.id, amountCents: commission.amountCents, userId, workspaceId });
    } catch (e) {
        logger.error('Rep commission creation failed', { error: e instanceof Error ? e.message : 'Unknown', repCode, userId, workspaceId });
    }
}

const GRACE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const APP_BASE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const DASHBOARD_URL = `${APP_BASE_URL.replace(/\/$/, '')}/dashboard`;

// ─── HMAC-SHA256 Signature Validation ────────────────────────────────────────

/**
 * Validates Mercado Pago webhook signature (x-signature header).
 * Format: "ts=TIMESTAMP,v1=HASH"
 * Template: "id:{dataId};request-id:{xRequestId};ts:{ts};"
 * https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
function validateMpSignature(
    xSignature: string | null,
    xRequestId: string | null,
    dataId: string | null,
): boolean {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) {
        logger.error('MERCADOPAGO_WEBHOOK_SECRET not configured — rejecting webhook');
        return false;
    }
    if (!xSignature) return false;

    // Parse "ts=TIMESTAMP,v1=HASH"
    const parts: Record<string, string> = {};
    for (const part of xSignature.split(',')) {
        const [key, ...rest] = part.split('=');
        if (key && rest.length > 0) parts[key.trim()] = rest.join('=').trim();
    }
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    // Build the template string per MP docs
    // Only include parts that are present
    let template = '';
    if (dataId) template += `id:${dataId};`;
    if (xRequestId) template += `request-id:${xRequestId};`;
    template += `ts:${ts};`;

    const expected = createHmac('sha256', secret).update(template).digest('hex');
    const matches = expected === v1;
    if (!matches) {
        logger.warn('MP signature mismatch debug', {
            dataId, xRequestId, ts, template,
            expectedPrefix: expected.slice(0, 8), receivedPrefix: v1.slice(0, 8),
            secretLength: secret.length,
        });
    }
    return matches;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type MpPaymentData = {
    id?: number | string;
    status?: string;
    status_detail?: string;
    transaction_amount?: number;
    date_created?: string;
    payment_type_id?: string;
    external_reference?: string;
    metadata?: Record<string, unknown>;
    point_of_interaction?: { transaction_data?: { subscription_id?: string } };
};

function metaString(data: MpPaymentData, key: string): string | undefined {
    const value = data.metadata?.[key];
    return value == null || value === '' ? undefined : String(value);
}

/** Card-subscription charges reference their PreApproval in metadata or point_of_interaction. */
function preapprovalIdOf(data: MpPaymentData): string | undefined {
    return metaString(data, 'preapproval_id')
        ?? metaString(data, 'subscription_id')
        ?? data.point_of_interaction?.transaction_data?.subscription_id
        ?? undefined;
}

async function findUserWorkspace(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { workspaces: { orderBy: { workspace: { createdAt: 'asc' } }, take: 1, include: { workspace: true } } },
    });
    return { user, workspace: user?.workspaces?.[0]?.workspace ?? null };
}

async function ownerRecipient(workspaceId: string): Promise<BillingRecipient | null> {
    const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId, role: 'OWNER' },
        orderBy: { createdAt: 'asc' },
        select: { user: { select: { email: true, name: true, market: true } } },
    });
    if (!member?.user.email) return null;
    return { email: member.user.email, name: member.user.name, market: member.user.market };
}

/** Promo payments still to be charged at the promo price after the current one. */
function promoAfterPayment(remaining: number | null | undefined): { promoPaymentsRemaining: number | null; endsNow: boolean } {
    if (remaining == null || remaining <= 0) return { promoPaymentsRemaining: null, endsNow: false };
    const next = remaining - 1;
    return next > 0 ? { promoPaymentsRemaining: next, endsNow: false } : { promoPaymentsRemaining: null, endsNow: true };
}

async function cancelReplacedPreapproval(oldSubscriptionId: string | null | undefined, newId: string | null, workspaceId: string): Promise<void> {
    if (!isMpPreapprovalId(oldSubscriptionId) || oldSubscriptionId === newId) return;
    // Upgrade / plan switch: the previous card subscription must stop charging, otherwise
    // the customer is billed twice every month.
    try {
        await cancelPreApproval(oldSubscriptionId!);
        logger.info('MP: previous PreApproval cancelled after plan switch', { workspaceId, oldSubscriptionId, newId });
    } catch (err) {
        logger.error('MP: failed to cancel previous PreApproval — customer may be double billed', {
            workspaceId, oldSubscriptionId, error: err instanceof Error ? err.message : 'Unknown',
        });
    }
}

// ─── One-time payments (PIX / Checkout Pro) + recurring PIX renewals ────────

async function applyApprovedPaymentMp(data: MpPaymentData, userId: string, planId: PlanType, interval: string, paymentId: string, promoId?: string): Promise<{ workspaceId: string; isRenewal: boolean } | null> {
    const workspaceIdHint = metaString(data, 'workspace_id');
    const { user, workspace: userWorkspace } = await findUserWorkspace(userId);
    const workspace = workspaceIdHint
        ? await prisma.workspace.findUnique({ where: { id: workspaceIdHint } })
        : userWorkspace;
    if (!workspace) return null;

    const now = new Date();
    const cycle = toCycle(interval);
    const isRenewal = metaString(data, 'renewal') === '1';
    // Same plan still running (renewal or paying early): extend from the current end so no paid day is lost.
    const continuesPlan = workspace.plan === planId && workspace.subscriptionStatus === 'active';
    const currentPeriodEnd = extendPeriodEnd(continuesPlan ? workspace.currentPeriodEnd : null, cycle, now);
    const market = workspace.market === 'US' ? 'US' : 'BR';

    await cancelReplacedPreapproval(workspace.subscriptionId, null, workspace.id);

    const promo = isRenewal
        ? promoAfterPayment(workspace.promoPaymentsRemaining)
        : promoId === STARTER_PROMO_BR.id
            ? { promoPaymentsRemaining: STARTER_PROMO_BR.months - 1, endsNow: false }
            : { promoPaymentsRemaining: workspace.promoPaymentsRemaining, endsNow: false };

    await prisma.workspace.update({
        where: { id: workspace.id },
        data: {
            plan: planId,
            subscriptionStatus: 'active',
            subscriptionId: `mp_pay_${paymentId}`,
            leadsLimit: getMarketLeadsLimit(planId, market),
            ...freshCreditCycle(now, currentPeriodEnd),
            currentPeriodEnd,
            billingCycle: cycle,
            gracePeriodEnd: null,
            renewalPaymentId: null,
            renewalPaymentUrl: null,
            renewalPaymentQrCode: null,
            renewalPaymentExpiresAt: null,
            ...(workspace.pendingPlanId === planId ? { pendingPlanId: null, pendingPlanEffectiveAt: null } : {}),
            promoPaymentsRemaining: promo.promoPaymentsRemaining,
            ...(promo.endsNow ? { promoRegularAmountBrl: null, starterPromoCode: null } : {}),
            ...(!isRenewal && promoId === STARTER_PROMO_BR.id
                ? {
                    starterPromoCode: promoId,
                    promoRegularAmountBrl: STARTER_PROMO_BR.regularPriceBrl,
                    starterPromoEligible: false,
                }
                : {}),
        },
    });

    const plan = PLANS[planId];
    const recipient = await ownerRecipient(workspace.id);
    if (isRenewal && recipient) {
        await sendRenewalConfirmedEmail(workspace.id, recipient, {
            planName: plan.name,
            leadsLimit: getMarketLeadsLimit(planId, market),
            periodEnd: currentPeriodEnd,
            paymentId,
        });
    } else if (user?.email) {
        const html = paymentSuccessTemplate(plan.name, getMarketLeadsLimit(planId, market), DASHBOARD_URL, user.name ?? undefined, currentPeriodEnd);
        sendEmail(user.email, 'Seu plano Precision IA está ativo — bem-vindo', html).catch((err) => {
            logger.error('Payment success email failed', { userId, error: err instanceof Error ? err.message : 'Unknown' });
        });
    }
    return { workspaceId: workspace.id, isRenewal };
}

async function sendPaymentRejectedEmail(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return;
    const html = paymentFailureTemplate(DASHBOARD_URL);
    sendEmail(user.email, 'Pagamento não aprovado — Precision IA', html).catch((err) => {
        logger.error('Payment failure email failed', { userId, error: err instanceof Error ? err.message : 'Unknown' });
    });
}

async function handleOneTimeApproved(data: MpPaymentData, id: string): Promise<void> {
    const userId = metaString(data, 'user_id');
    const planId = metaString(data, 'plan_id') as PlanType | undefined;
    if (!userId || !planId || !(planId in PLANS)) return;
    const interval = metaString(data, 'interval') || 'monthly';
    const affiliateCode = metaString(data, 'affiliate_code');
    const repCode = metaString(data, 'rep');
    const promoId = metaString(data, 'promo_id');

    const applied = await applyApprovedPaymentMp(data, userId, planId, interval, id, promoId);
    if (!applied) return;
    const valueCents = Math.round((data.transaction_amount ?? getPlanPrices(PLANS[planId], toCycle(interval)).price_brl) * 100);
    await recordPayment({
        workspaceId: applied.workspaceId,
        provider: 'mercadopago',
        externalId: `mp:${id}`,
        method: data.payment_type_id === 'bank_transfer' ? 'pix' : data.payment_type_id ?? null,
        kind: applied.isRenewal ? 'RENEWAL' : 'FIRST',
        amountCents: valueCents,
        currency: 'BRL',
        planId,
    });

    if (applied.isRenewal) {
        notifyPaymentRenewed({
            workspaceId: applied.workspaceId,
            toPlan: planId,
            provider: 'mercadopago',
            paymentId: id,
            billingCycle: interval,
            amount: valueCents / 100,
            currency: 'BRL',
        });
        try {
            await createCommissionForRecurring({
                workspaceId: applied.workspaceId,
                subscriptionId: `mp_pay_${id}`,
                planId,
                valueCents,
                currency: 'BRL',
                orderId: id,
            });
        } catch (e) {
            logger.error('Affiliate recurring commission (MP PIX renewal) failed', { error: e instanceof Error ? e.message : 'Unknown' });
        }
        return;
    }

    notifyPaymentApproved({
        userId,
        toPlan: planId,
        billingCycle: interval,
        provider: 'mercadopago',
        amount: valueCents / 100,
        currency: 'BRL',
        paymentId: id,
        status: data.status,
    });
    notifyPlanUpgrade({ userId, toPlan: planId, billingCycle: interval, provider: 'mercadopago' });
    const { user } = await findUserWorkspace(userId);
    try {
        await createCommissionForFirstPayment({
            userId,
            workspaceId: applied.workspaceId,
            userEmail: user?.email ?? null,
            planId,
            valueCents,
            currency: 'BRL',
            orderId: id,
            affiliateCodeFromMetadata: affiliateCode,
        });
    } catch (e) {
        logger.error('Affiliate commission create failed (MP payment)', { error: e instanceof Error ? e.message : 'Unknown' });
    }
    if (repCode) {
        await handleRepCommission(repCode, userId, applied.workspaceId, planId, valueCents, id);
    }
}

async function handlePaymentTopic(id: string): Promise<void> {
    const payment = new Payment(mpConfig);
    const data = await payment.get({ id }) as unknown as MpPaymentData;
    const preapprovalId = preapprovalIdOf(data);
    logger.info('MP Full Payment Data', { paymentId: id, status: data.status, status_detail: data.status_detail, preapprovalId });

    // Dedup by payment+status (not just payment ID): MP re-notifies the same payment ID as
    // its status transitions (e.g. pending -> approved). A dedup key on ID alone would let the
    // first (pending) notification consume the slot and silently swallow the later approval.
    if (await isWebhookDuplicate('mercadopago', `payment:${id}:${data.status}`)) {
        return;
    }
    notifyPaymentCreated({
        userId: metaString(data, 'user_id'),
        toPlan: metaString(data, 'plan_id'),
        billingCycle: metaString(data, 'interval') || 'monthly',
        provider: 'mercadopago',
        amount: data.transaction_amount ?? null,
        currency: 'BRL',
        paymentId: id,
        subscriptionId: preapprovalId,
        status: data.status,
    });

    if (data.status === 'approved') {
        if (preapprovalId) {
            // Card subscription charge — the PreApproval is the source of truth.
            await handlePreapprovalCharge(preapprovalId, id, data);
        } else {
            await handleOneTimeApproved(data, id);
        }
        return;
    }
    if (data.status === 'rejected') {
        const userId = metaString(data, 'user_id');
        notifyPaymentFailed({
            userId,
            toPlan: metaString(data, 'plan_id'),
            billingCycle: metaString(data, 'interval') || 'monthly',
            provider: 'mercadopago',
            paymentId: id,
            subscriptionId: preapprovalId ?? null,
            status: data.status,
        });
        if (userId) await sendPaymentRejectedEmail(userId);
    }
    if (data.status === 'refunded' || data.status === 'cancelled' || data.status === 'charged_back') {
        notifyPaymentRefunded({
            userId: metaString(data, 'user_id'),
            toPlan: metaString(data, 'plan_id'),
            provider: 'mercadopago',
            paymentId: id,
            subscriptionId: preapprovalId ?? null,
            status: data.status,
        });
        await revokeRefundedOneTimePayment(id, data.status);
        if (data.status !== 'cancelled') await markPaymentRefunded(`mp:${id}`);
        try {
            const cancelled = await cancelCommissionsByOrderOrSubscription(id, undefined);
            if (cancelled > 0) logger.info('Affiliate commissions cancelled (MP refund/cancel)', { paymentId: id, count: cancelled });
        } catch (e) {
            logger.error('Affiliate cancel commissions (MP) failed', { error: e instanceof Error ? e.message : 'Unknown' });
        }
    }
}

/** A refunded/charged-back one-time payment that is the workspace's current plan revokes it. */
async function revokeRefundedOneTimePayment(paymentId: string, status: string | undefined): Promise<void> {
    if (status === 'cancelled') {
        // An expired, never-paid PIX: just clear it if it was the pending renewal charge.
        await prisma.workspace.updateMany({
            where: { renewalPaymentId: paymentId },
            data: { renewalPaymentId: null, renewalPaymentUrl: null, renewalPaymentQrCode: null, renewalPaymentExpiresAt: null },
        });
        return;
    }
    const ws = await prisma.workspace.findFirst({ where: { subscriptionId: `mp_pay_${paymentId}` }, select: { id: true, market: true } });
    if (!ws) return;
    await prisma.workspace.update({ where: { id: ws.id }, data: freePlanData() });
    logger.warn('MP refund/chargeback: plan revoked', { workspaceId: ws.id, paymentId, status });
}

// ─── Card subscriptions (PreApproval) ───────────────────────────────────────

type PreApprovalData = Awaited<ReturnType<typeof getPreApproval>> & { external_reference?: string };

async function resolvePreapprovalWorkspace(preapproval: PreApprovalData) {
    const parsed = preapproval.external_reference ? parseMpExternalReference(preapproval.external_reference) : null;
    const bySub = await prisma.workspace.findFirst({ where: { subscriptionId: preapproval.id } });
    if (bySub) return { workspace: bySub, parsed };
    if (!parsed?.userId) return { workspace: null, parsed };
    const { workspace } = await findUserWorkspace(parsed.userId);
    return { workspace, parsed };
}

/**
 * Activates a card subscription or records one of its charges.
 * - new subscription (first time we see this PreApproval on the workspace): full activation,
 *   cancels the PreApproval it replaces (upgrade), first-payment commissions, welcome email
 * - later charge (paymentId, not the first one): renewal — period extended, credits refilled
 * - repeated "authorized" notifications: only sync status/period, credits untouched
 */
async function activatePreapproval(preapproval: PreApprovalData, charge?: { paymentId: string; data: MpPaymentData }): Promise<void> {
    const { workspace, parsed } = await resolvePreapprovalWorkspace(preapproval);
    if (!workspace || !parsed) {
        logger.warn('MP preapproval: workspace not resolved', { preapprovalId: preapproval.id });
        return;
    }
    const { userId, planId, cycle, affiliateCode, promoId, repCode } = parsed;
    const plan = PLANS[planId];
    if (!plan) return;

    const now = new Date();
    const isNew = workspace.subscriptionId !== preapproval.id;
    const createdAt = preapproval.date_created ? new Date(preapproval.date_created) : null;
    const chargedAt = charge?.data.date_created ? new Date(charge.data.date_created) : now;
    const isFirstCharge = createdAt != null && chargedAt.getTime() - createdAt.getTime() < 24 * 60 * 60 * 1000;
    const isRenewal = !isNew && charge != null && !isFirstCharge;
    const nextPayment = preapproval.next_payment_date ? new Date(preapproval.next_payment_date) : null;
    const currentPeriodEnd = nextPayment && nextPayment > now ? nextPayment : extendPeriodEnd(workspace.currentPeriodEnd, cycle, now);
    const market = workspace.market === 'US' ? 'US' : 'BR';
    const chargedBrl = preapproval.auto_recurring?.transaction_amount ?? getPlanPrices(plan, cycle).price_brl;
    const valueCents = Math.round((charge?.data.transaction_amount ?? chargedBrl) * 100);

    if (isNew) await cancelReplacedPreapproval(workspace.subscriptionId, preapproval.id, workspace.id);

    const promo = isRenewal ? promoAfterPayment(workspace.promoPaymentsRemaining) : null;
    await prisma.workspace.update({
        where: { id: workspace.id },
        data: {
            subscriptionId: preapproval.id,
            plan: planId,
            subscriptionStatus: 'active',
            leadsLimit: getMarketLeadsLimit(planId, market),
            currentPeriodEnd,
            billingCycle: cycle,
            gracePeriodEnd: null,
            renewalPaymentId: null,
            renewalPaymentUrl: null,
            renewalPaymentQrCode: null,
            renewalPaymentExpiresAt: null,
            ...(isNew || isRenewal ? freshCreditCycle(now, currentPeriodEnd) : {}),
            ...(isNew ? { pendingPlanId: null, pendingPlanEffectiveAt: null } : {}),
            ...(isNew && promoId === STARTER_PROMO_BR.id
                ? {
                    starterPromoCode: promoId,
                    promoPaymentsRemaining: STARTER_PROMO_BR.months - 1,
                    promoRegularAmountBrl: STARTER_PROMO_BR.regularPriceBrl,
                    starterPromoEligible: false,
                }
                : {}),
            ...(promo ? { promoPaymentsRemaining: promo.promoPaymentsRemaining } : {}),
            ...(promo?.endsNow ? { promoRegularAmountBrl: null, starterPromoCode: null } : {}),
        },
    });

    if (charge) {
        await recordPayment({
            workspaceId: workspace.id,
            provider: 'mercadopago',
            externalId: `mp:${charge.paymentId}`,
            method: 'credit_card',
            kind: isRenewal ? 'RENEWAL' : 'FIRST',
            amountCents: valueCents,
            currency: 'BRL',
            planId,
        });
    }

    if (promo?.endsNow) {
        const regular = workspace.promoRegularAmountBrl ?? STARTER_PROMO_BR.regularPriceBrl;
        await updatePreApprovalAmount(preapproval.id, regular).catch((err: unknown) => {
            logger.error('MP promo end: update to regular price failed', { preapprovalId: preapproval.id, error: err instanceof Error ? err.message : 'Unknown' });
        });
    }

    const recipient = await ownerRecipient(workspace.id);
    if (isRenewal) {
        notifyPaymentRenewed({
            workspaceId: workspace.id,
            toPlan: planId,
            provider: 'mercadopago',
            paymentId: charge!.paymentId,
            subscriptionId: preapproval.id,
            amount: valueCents / 100,
            currency: 'BRL',
        });
        try {
            await createCommissionForRecurring({
                workspaceId: workspace.id,
                subscriptionId: preapproval.id,
                planId,
                valueCents,
                currency: 'BRL',
                orderId: charge!.paymentId,
            });
        } catch (e) {
            logger.error('Affiliate recurring commission (MP) failed', { error: e instanceof Error ? e.message : 'Unknown' });
        }
        if (recipient) {
            await sendRenewalConfirmedEmail(workspace.id, recipient, {
                planName: plan.name,
                leadsLimit: getMarketLeadsLimit(planId, market),
                periodEnd: currentPeriodEnd,
                paymentId: charge!.paymentId,
            });
        }
        return;
    }
    if (!isNew) return;

    const { user } = await findUserWorkspace(userId);
    notifyPaymentApproved({
        userId,
        userEmail: user?.email ?? null,
        workspaceId: workspace.id,
        toPlan: planId,
        billingCycle: cycle,
        provider: 'mercadopago',
        amount: valueCents / 100,
        currency: 'BRL',
        paymentId: preapproval.id,
        subscriptionId: preapproval.id,
        status: preapproval.status,
    });
    notifyPlanUpgrade({
        userId,
        userEmail: user?.email ?? null,
        workspaceId: workspace.id,
        toPlan: planId,
        billingCycle: cycle,
        provider: 'mercadopago',
        subscriptionId: preapproval.id,
    });
    if (user?.email) {
        const html = paymentSuccessTemplate(plan.name, getMarketLeadsLimit(planId, market), DASHBOARD_URL, user.name ?? undefined, currentPeriodEnd);
        sendEmail(user.email, 'Seu plano Precision IA está ativo — bem-vindo', html).catch((err) => {
            logger.error('Payment success email failed', { userId, error: err instanceof Error ? err.message : 'Unknown' });
        });
    }
    try {
        await createCommissionForFirstPayment({
            userId,
            workspaceId: workspace.id,
            userEmail: user?.email ?? null,
            planId,
            valueCents,
            currency: 'BRL',
            orderId: preapproval.id,
            subscriptionId: preapproval.id,
            affiliateCodeFromMetadata: affiliateCode,
        });
    } catch (e) {
        logger.error('Affiliate commission create failed (MP preapproval)', { error: e instanceof Error ? e.message : 'Unknown' });
    }
    if (repCode) {
        await handleRepCommission(repCode, userId, workspace.id, planId, valueCents, preapproval.id, preapproval.id);
    }
}

async function handlePreapprovalCharge(preapprovalId: string, paymentId: string, data: MpPaymentData): Promise<void> {
    const preapproval = await getPreApproval(preapprovalId) as PreApprovalData;
    await activatePreapproval(preapproval, { paymentId, data });
}

async function handlePreapprovalTopic(id: string): Promise<void> {
    const preapproval = await getPreApproval(id) as PreApprovalData;
    const status = preapproval.status;
    // Dedup per status: the first "pending" notification must not swallow the later "authorized".
    if (await isWebhookDuplicate('mercadopago', `preapproval:${id}:${status}`)) return;

    if (status === 'authorized' || status === 'active') {
        await activatePreapproval(preapproval);
        return;
    }
    if (status === 'pending') {
        // Not authorized yet (checkout in progress) — nothing to change.
        return;
    }

    const { workspace, parsed } = await resolvePreapprovalWorkspace(preapproval);
    // Only the workspace's current subscription matters: an old PreApproval we cancelled
    // ourselves after an upgrade must not touch the new plan.
    if (!workspace || workspace.subscriptionId !== preapproval.id) return;
    const recipient = await ownerRecipient(workspace.id);

    if (status === 'cancelled') {
        const now = new Date();
        const accessUntil = workspace.currentPeriodEnd && workspace.currentPeriodEnd > now ? workspace.currentPeriodEnd : now;
        // Paid time is kept: FREE is applied by the lifecycle cron at period end.
        await prisma.workspace.update({
            where: { id: workspace.id },
            data: { subscriptionStatus: 'canceled', pendingPlanId: 'FREE', pendingPlanEffectiveAt: accessUntil },
        });
        notifyPlanDowngradeScheduled({
            workspaceId: workspace.id,
            fromPlan: workspace.plan,
            toPlan: 'FREE',
            provider: 'mercadopago',
            subscriptionId: id,
            effectiveAt: accessUntil.toISOString(),
        });
        if (recipient) await sendSubscriptionCancelledEmail(workspace.id, recipient, PLANS[workspace.plan as PlanType]?.name ?? workspace.plan, accessUntil);
        try {
            const cancelled = await cancelCommissionsByOrderOrSubscription(id, id);
            if (cancelled > 0) logger.info('Affiliate commissions cancelled (MP preapproval cancelled)', { preapprovalId: id, count: cancelled });
        } catch (e) {
            logger.error('Affiliate cancel commissions (MP preapproval) failed', { error: e instanceof Error ? e.message : 'Unknown' });
        }
        return;
    }

    if (status === 'paused') {
        await prisma.workspace.update({
            where: { id: workspace.id },
            data: { subscriptionStatus: 'past_due', gracePeriodEnd: new Date(Date.now() + GRACE_DAYS_MS) },
        });
        notifyPaymentFailed({
            userId: parsed?.userId,
            workspaceId: workspace.id,
            toPlan: workspace.plan,
            provider: 'mercadopago',
            subscriptionId: id,
            status,
        });
        if (parsed?.userId) await sendPaymentRejectedEmail(parsed.userId);
    }
}

/** Subscription charge notification (topic authorized_payment / subscription_authorized_payment). */
async function handleAuthorizedPaymentTopic(id: string): Promise<void> {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) return;
    const res = await fetch(`https://api.mercadopago.com/authorized_payments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        logger.warn('MP authorized_payment fetch failed', { id, status: res.status });
        return;
    }
    const ap = await res.json() as { preapproval_id?: string; payment?: { id?: number | string; status?: string } };
    const paymentId = ap.payment?.id != null ? String(ap.payment.id) : null;
    if (!ap.preapproval_id || !paymentId) return;
    // The payment topic carries the same charge; process via the payment so both paths share dedup.
    const payment = new Payment(mpConfig);
    const data = await payment.get({ id: paymentId }) as unknown as MpPaymentData;
    if (data.status !== 'approved') return;
    if (await isWebhookDuplicate('mercadopago', `payment:${paymentId}:${data.status}`)) return;
    await handlePreapprovalCharge(ap.preapproval_id, paymentId, data);
}

async function runSafe(label: string, fn: () => Promise<void>): Promise<void> {
    try {
        await fn();
    } catch (error) {
        logger.error(label, { error: error instanceof Error ? error.message : 'Unknown' });
    }
}

const PREAPPROVAL_TOPICS = new Set(['preapproval', 'subscription_preapproval']);
const AUTHORIZED_PAYMENT_TOPICS = new Set(['authorized_payment', 'subscription_authorized_payment']);

async function dispatchMpWebhook(topic: string | null, id: string | null): Promise<void> {
    if (!topic || !id) return;
    if (topic === 'payment') {
        await runSafe('Mercado Pago Webhook Error', () => handlePaymentTopic(id));
        return;
    }
    if (PREAPPROVAL_TOPICS.has(topic)) {
        await runSafe('MP Preapproval Webhook Error', () => handlePreapprovalTopic(id));
        return;
    }
    if (AUTHORIZED_PAYMENT_TOPICS.has(topic)) {
        await runSafe('MP Authorized Payment Webhook Error', () => handleAuthorizedPaymentTopic(id));
        return;
    }
    // merchant_order: fetch order and process its payments
    if (topic === 'merchant_order') {
        try {
            const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
            if (!token) return;
            const res = await fetch(`https://api.mercadopago.com/merchant_orders/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return;
            const order = await res.json() as { payments?: Array<{ id: number; status: string }> };
            const approved = order.payments?.find((p) => p.status === 'approved');
            if (approved) {
                await runSafe('Mercado Pago Webhook Error', () => handlePaymentTopic(String(approved.id)));
            }
        } catch (err) {
            logger.error('MP merchant_order processing failed', { orderId: id, error: err instanceof Error ? err.message : 'Unknown' });
        }
    }
}

/**
 * Parse topic and data ID from either:
 * - v1 query params: ?topic=payment&id=123
 * - v2 JSON body: { "type": "payment", "data": { "id": "123" }, "action": "payment.created" }
 */
async function parseMpNotification(req: Request): Promise<{ topic: string | null; dataId: string | null; xSignature: string | null; xRequestId: string | null }> {
    const { searchParams } = new URL(req.url);
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');

    // Try v1 format (query params)
    const topicV1 = searchParams.get('topic') || searchParams.get('type');
    const idV1 = searchParams.get('id') || searchParams.get('data.id');
    if (topicV1 && idV1) {
        return { topic: topicV1, dataId: idV1, xSignature, xRequestId };
    }

    // Try v2 format (JSON body)
    try {
        const body = await req.json() as { type?: string; data?: { id?: string }; action?: string };
        const topic = body.type ?? (body.action?.split('.')[0]) ?? null;
        const dataId = body.data?.id != null ? String(body.data.id) : null;
        if (topic && dataId) {
            return { topic, dataId, xSignature, xRequestId };
        }
        // Fallback: maybe the ID is in the query even if topic is in the body
        return { topic: topic ?? topicV1, dataId: dataId ?? idV1, xSignature, xRequestId };
    } catch {
        // Body wasn't JSON — use whatever we got from query params
        return { topic: topicV1, dataId: idV1, xSignature, xRequestId };
    }
}

export async function POST(req: Request) {
    // Rate limit: 120 requests per minute per endpoint
    const rl = await rateLimit('webhook:mercadopago', 120, 60);
    if (!rl.success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { topic, dataId, xSignature, xRequestId } = await parseMpNotification(req);

    logger.info('MP Webhook Received', { topic, dataId, hasSignature: !!xSignature });

    // Validate HMAC signature
    if (!validateMpSignature(xSignature, xRequestId, dataId)) {
        await recordWebhook('mercadopago', false, 'invalid signature');
        logger.warn('MP Webhook signature validation failed', { topic, dataId });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Idempotency: skip duplicate webhook deliveries. 'payment' and 'merchant_order' dedupe
    // internally (keyed by payment status too — see handlePaymentTopic), since MP re-sends the
    // same resource ID as its status changes and a plain ID-based key here would swallow that.
    const dedupeId = dataId ?? xRequestId ?? '';
    if (topic !== 'payment' && topic !== 'merchant_order' && !PREAPPROVAL_TOPICS.has(topic ?? '') && !AUTHORIZED_PAYMENT_TOPICS.has(topic ?? '') && dedupeId && await isWebhookDuplicate('mercadopago', `${topic}:${dedupeId}`)) {
        return NextResponse.json({ received: true });
    }

    await dispatchMpWebhook(topic, dataId);
    await recordWebhook('mercadopago', true);
    return NextResponse.json({ received: true });
}
