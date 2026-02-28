import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { mpConfig } from '@/lib/mercadopago';
import { Payment } from 'mercadopago';
import { prisma } from '@/lib/prisma';
import type { Plan } from '@prisma/client';
import { PLANS, PlanType } from '@/lib/billing-config';
import { processPaymentSchema, formatZodError } from '@/lib/validations/schemas';

async function applyApprovedPayment(userId: string, planId: string, interval: string): Promise<void> {
    const plan = PLANS[planId as PlanType];
    const userWithWorkspace = await prisma.user.findUnique({
        where: { id: userId },
        include: { workspaces: { take: 1 } }
    });
    const workspaceId = userWithWorkspace?.workspaces[0]?.workspaceId;
    if (!workspaceId) return;
    await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
            plan: planId as Plan,
            leadsLimit: plan.leadsLimit,
            subscriptionStatus: 'active',
            currentPeriodEnd: new Date(Date.now() + (interval === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000),
            billingCycle: interval === 'annual' ? 'annual' : 'monthly',
        }
    });
}

export async function POST(req: Request) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const parsed = processPaymentSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const { token, issuer_id, payment_method_id, transaction_amount, installments, payer, planId, interval } = parsed.data;

        const payment = new Payment(mpConfig);

        const paymentResponse = await payment.create({
            body: {
                transaction_amount,
                token,
                description: `ProspectorAI ${planId} (${interval})`,
                installments,
                payment_method_id,
                ...(issuer_id != null && issuer_id !== '' ? { issuer_id: Number(issuer_id) } : {}),
                payer: {
                    email: payer?.email ?? session.user.email ?? undefined,
                    identification: payer?.identification ?? {},
                    entity_type: 'individual',
                    type: 'customer',
                },
                metadata: {
                    user_id: session.user.id,
                    plan_id: planId,
                    interval: interval
                },
                notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/billing/webhook/mercadopago`,
            }
        });

        // Log the response status for debugging
        const { logger } = await import('@/lib/logger');
        logger.info('Mercado Pago Payment Created', { paymentId: paymentResponse.id, status: paymentResponse.status });

        if (paymentResponse.status === 'approved') {
            await applyApprovedPayment(session.user.id, planId, interval);
        }

        // Return the clean data object. Bricks expect the direct payment response fields.
        return NextResponse.json(paymentResponse);

    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Payment Processing Error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
    }
}
