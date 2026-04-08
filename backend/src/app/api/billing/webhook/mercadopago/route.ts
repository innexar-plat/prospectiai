import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { mpConfig } from '@/lib/mercadopago';
import { Payment } from 'mercadopago';
import { getPreApproval } from '@/lib/mercadopago-subscription';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType, getPlanPrices } from '@/lib/billing-config';
import { sendEmail } from '@/lib/email';
import { paymentSuccessTemplate, paymentFailureTemplate } from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { createCommissionForFirstPayment, cancelCommissionsByOrderOrSubscription, createCommissionForRecurring } from '@/lib/affiliate';
import { isWebhookDuplicate } from '@/lib/webhook-dedup';
import { rateLimit } from '@/lib/ratelimit';

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
    return expected === v1;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function periodEndFromInterval(interval: string): Date {
    const d = new Date();
    if (interval === 'annual') {
        d.setFullYear(d.getFullYear() + 1);
    } else {
        d.setMonth(d.getMonth() + 1);
    }
    return d;
}

async function applyApprovedPaymentMp(userId: string, planId: PlanType, interval: string, paymentId: string): Promise<void> {
    const plan = PLANS[planId];
    const userWithWorkspace = await prisma.user.findUnique({
        where: { id: userId },
        include: { workspaces: { take: 1, include: { workspace: true } } }
    });
    const workspace = userWithWorkspace?.workspaces?.[0]?.workspace;
    const workspaceId = workspace?.id;
    if (!workspaceId) return;
    const billingCycle = interval === 'annual' ? 'annual' : 'monthly';
    await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
            plan: planId,
            subscriptionStatus: 'active',
            leadsLimit: plan.leadsLimit,
            leadsUsed: 0,
            currentPeriodEnd: periodEndFromInterval(interval),
            billingCycle,
            gracePeriodEnd: null,
            // Store payment ID as reference for one-time MP Preference payments
            // PreApproval payments will overwrite this with the preapproval ID later
            ...(!workspace.subscriptionId ? { subscriptionId: `mp_pay_${paymentId}` } : {}),
        }
    });
    if (userWithWorkspace?.email) {
        const html = paymentSuccessTemplate(plan.name, plan.leadsLimit, DASHBOARD_URL);
        sendEmail(userWithWorkspace.email, 'Seu plano Precision IA está ativo — bem-vindo', html).catch((err) => {
            logger.error('Payment success email failed', { userId, error: err instanceof Error ? err.message : 'Unknown' });
        });
    }
}

async function sendPaymentRejectedEmail(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return;
    const html = paymentFailureTemplate(DASHBOARD_URL);
    sendEmail(user.email, 'Pagamento não aprovado — Precision IA', html).catch((err) => {
        logger.error('Payment failure email failed', { userId, error: err instanceof Error ? err.message : 'Unknown' });
    });
}

async function handlePaymentTopic(id: string): Promise<void> {
    const payment = new Payment(mpConfig);
    const data = await payment.get({ id });
    const statusDetail = (data as { status_detail?: string }).status_detail;
    logger.info('MP Full Payment Data', { paymentId: id, status: data.status, status_detail: statusDetail });

    if (data.status === 'approved') {
        const userId = data.metadata?.user_id;
        const planId = data.metadata?.plan_id as PlanType;
        const interval = (data.metadata?.interval as string) || 'monthly';
        const affiliateCode = data.metadata?.affiliate_code as string | undefined;
        const preapprovalId = (data.metadata?.preapproval_id ?? data.metadata?.subscription_id) as string | undefined;
        if (userId && planId) {
            await applyApprovedPaymentMp(userId, planId, interval, id);
            const plan = PLANS[planId];
            if (plan) {
                const userWithWorkspace = await prisma.user.findUnique({
                    where: { id: userId },
                    include: { workspaces: { take: 1 } },
                });
                const workspaceId = userWithWorkspace?.workspaces?.[0]?.workspaceId;
                if (workspaceId) {
                    const { price_brl } = getPlanPrices(plan, interval === 'annual' ? 'annual' : 'monthly');
                    const valueCents = Math.round(price_brl * 100);
                    try {
                        await createCommissionForFirstPayment({
                            userId,
                            workspaceId,
                            userEmail: userWithWorkspace?.email ?? null,
                            planId,
                            valueCents,
                            currency: 'BRL',
                            orderId: id,
                            affiliateCodeFromMetadata: affiliateCode,
                        });
                    } catch (e) {
                        logger.error('Affiliate commission create failed (MP payment)', { error: e instanceof Error ? e.message : 'Unknown' });
                    }
                }
            }
        }
        // Recurring subscription payments (renewals): MP sends payment with preapproval_id in metadata.
        if (preapprovalId) {
            try {
                const workspace = await prisma.workspace.findFirst({
                    where: { subscriptionId: preapprovalId },
                    select: { id: true, plan: true },
                });
                if (workspace) {
                    const transactionAmount = (data as { transaction_amount?: number }).transaction_amount;
                    const valueCents = transactionAmount != null ? Math.round(transactionAmount * 100) : 0;
                    if (valueCents > 0) {
                        await createCommissionForRecurring({
                            workspaceId: workspace.id,
                            subscriptionId: preapprovalId,
                            planId: (workspace.plan || 'BASIC') as PlanType,
                            valueCents,
                            currency: 'BRL',
                            orderId: id,
                        });
                    }
                }
            } catch (e) {
                logger.error('Affiliate recurring commission (MP) failed', { error: e instanceof Error ? e.message : 'Unknown' });
            }
        }
        return;
    }
    if (data.status === 'rejected') {
        const userId = data.metadata?.user_id;
        if (userId) await sendPaymentRejectedEmail(userId);
    }
    if (data.status === 'refunded' || data.status === 'cancelled') {
        try {
            const cancelled = await cancelCommissionsByOrderOrSubscription(id, undefined);
            if (cancelled > 0) logger.info('Affiliate commissions cancelled (MP refund/cancel)', { paymentId: id, count: cancelled });
        } catch (e) {
            logger.error('Affiliate cancel commissions (MP) failed', { error: e instanceof Error ? e.message : 'Unknown' });
        }
    }
}

async function handlePreapprovalTopic(id: string): Promise<void> {
    const preapproval = await getPreApproval(id);
    const extRef = (preapproval as { external_reference?: string }).external_reference;
    if (!extRef) return;
    const parts = extRef.split(':');
    const userId = parts[0];
    const planId = parts[1] as PlanType;
    const cycle = (parts[2] || 'monthly') as 'monthly' | 'annual';
    const affiliateCode = parts[3] as string | undefined;
    const plan = PLANS[planId];
    if (!plan || !userId) {
        logger.warn('MP preapproval: invalid external_reference', { preapprovalId: id, extRef });
        return;
    }

    const userWithWorkspace = await prisma.user.findUnique({
        where: { id: userId },
        include: { workspaces: { take: 1 } }
    });
    const workspaceId = userWithWorkspace?.workspaces?.[0]?.workspaceId;
    if (!workspaceId) return;

    const status = (preapproval as { status?: string }).status;
    if (status === 'authorized' || status === 'active') {
        const nextPayment = (preapproval as { next_payment_date?: string }).next_payment_date;
        const currentPeriodEnd = nextPayment ? new Date(nextPayment) : periodEndFromInterval(cycle);
        await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
                subscriptionId: preapproval.id,
                plan: planId,
                subscriptionStatus: 'active',
                leadsLimit: plan.leadsLimit,
                leadsUsed: 0,
                currentPeriodEnd,
                billingCycle: cycle,
                gracePeriodEnd: null,
            },
        });
        const { price_brl } = getPlanPrices(plan, cycle);
        const valueCents = Math.round(price_brl * 100);
        try {
            await createCommissionForFirstPayment({
                userId,
                workspaceId,
                userEmail: userWithWorkspace?.email ?? null,
                planId,
                valueCents,
                currency: 'BRL',
                orderId: id,
                subscriptionId: id,
                affiliateCodeFromMetadata: affiliateCode,
            });
        } catch (e) {
            logger.error('Affiliate commission create failed (MP preapproval)', { error: e instanceof Error ? e.message : 'Unknown' });
        }
    } else if (status === 'cancelled' || status === 'pending' || status === 'paused') {
        await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
                subscriptionStatus: 'past_due',
                gracePeriodEnd: new Date(Date.now() + GRACE_DAYS_MS),
            },
        });
        if (status === 'cancelled') {
            try {
                const cancelled = await cancelCommissionsByOrderOrSubscription(id, id);
                if (cancelled > 0) logger.info('Affiliate commissions cancelled (MP preapproval cancelled)', { preapprovalId: id, count: cancelled });
            } catch (e) {
                logger.error('Affiliate cancel commissions (MP preapproval) failed', { error: e instanceof Error ? e.message : 'Unknown' });
            }
        }
    }
}

async function handlePaymentTopicSafe(id: string): Promise<void> {
    try {
        await handlePaymentTopic(id);
    } catch (error) {
        logger.error('Mercado Pago Webhook Error', { error: error instanceof Error ? error.message : 'Unknown' });
    }
}

async function handlePreapprovalTopicSafe(id: string): Promise<void> {
    try {
        await handlePreapprovalTopic(id);
    } catch (error) {
        logger.error('MP Preapproval Webhook Error', { error: error instanceof Error ? error.message : 'Unknown' });
    }
}

async function dispatchMpWebhook(topic: string | null, id: string | null): Promise<void> {
    if (topic === 'payment' && id) {
        await handlePaymentTopicSafe(id);
        return;
    }
    if (topic === 'preapproval' && id) {
        await handlePreapprovalTopicSafe(id);
        return;
    }
    // merchant_order: fetch order and process its payments
    if (topic === 'merchant_order' && id) {
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
                await handlePaymentTopicSafe(String(approved.id));
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
        logger.warn('MP Webhook signature validation failed', { topic, dataId });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Idempotency: skip duplicate webhook deliveries
    const dedupeId = dataId ?? xRequestId ?? '';
    if (dedupeId && await isWebhookDuplicate('mercadopago', `${topic}:${dedupeId}`)) {
        return NextResponse.json({ received: true });
    }

    await dispatchMpWebhook(topic, dataId);
    return NextResponse.json({ received: true });
}
