import { NextResponse } from 'next/server';
import { mpConfig } from '@/lib/mercadopago';
import { Payment } from 'mercadopago';
import { getPreApproval } from '@/lib/mercadopago-subscription';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType } from '@/lib/billing-config';
import { sendEmail } from '@/lib/email';
import { paymentSuccessTemplate, paymentFailureTemplate } from '@/lib/email-templates';
import { logger } from '@/lib/logger';

const GRACE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const APP_BASE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const DASHBOARD_URL = `${APP_BASE_URL.replace(/\/$/, '')}/dashboard`;

function periodEndFromInterval(interval: string): Date {
    const d = new Date();
    if (interval === 'annual') {
        d.setFullYear(d.getFullYear() + 1);
    } else {
        d.setMonth(d.getMonth() + 1);
    }
    return d;
}

async function applyApprovedPaymentMp(userId: string, planId: PlanType, interval: string): Promise<void> {
    const plan = PLANS[planId];
    const userWithWorkspace = await prisma.user.findUnique({
        where: { id: userId },
        include: { workspaces: { take: 1 } }
    });
    const workspaceId = userWithWorkspace?.workspaces?.[0]?.workspaceId;
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
        }
    });
    if (userWithWorkspace?.email) {
        const html = paymentSuccessTemplate(plan.name, plan.leadsLimit, DASHBOARD_URL);
        sendEmail(userWithWorkspace.email, 'Seu plano ProspectorAI está ativo — bem-vindo', html).catch((err) => {
            logger.error('Payment success email failed', { userId, error: err instanceof Error ? err.message : 'Unknown' });
        });
    }
}

async function sendPaymentRejectedEmail(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return;
    const html = paymentFailureTemplate(DASHBOARD_URL);
    sendEmail(user.email, 'Pagamento não aprovado — ProspectorAI', html).catch((err) => {
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
        if (userId && planId) await applyApprovedPaymentMp(userId, planId, interval);
        return;
    }
    if (data.status === 'rejected') {
        const userId = data.metadata?.user_id;
        if (userId) await sendPaymentRejectedEmail(userId);
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
    const plan = PLANS[planId];
    if (!plan) return;

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
    } else if (status === 'cancelled' || status === 'pending' || status === 'paused') {
        await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
                subscriptionStatus: 'past_due',
                gracePeriodEnd: new Date(Date.now() + GRACE_DAYS_MS),
            },
        });
    }
}

export async function POST(req: Request) {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get('topic') || searchParams.get('type');
    const id = searchParams.get('id') || searchParams.get('data.id');

    logger.info('MP Webhook Received', { searchParams: searchParams.toString(), topic, id });

    if (topic === 'payment' && id) {
        try {
            await handlePaymentTopic(id);
        } catch (error) {
            logger.error('Mercado Pago Webhook Error', { error: error instanceof Error ? error.message : 'Unknown' });
        }
    }

    if (topic === 'preapproval' && id) {
        try {
            await handlePreapprovalTopic(id);
        } catch (error) {
            logger.error('MP Preapproval Webhook Error', { error: error instanceof Error ? error.message : 'Unknown' });
        }
    }

    return NextResponse.json({ received: true });
}
