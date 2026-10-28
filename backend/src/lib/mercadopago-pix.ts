/**
 * Recurring PIX: Mercado Pago subscriptions (PreApproval) only accept cards, so PIX
 * customers are renewed by generating one PIX charge per cycle before currentPeriodEnd.
 * The approved payment comes back through the MP webhook with metadata.renewal = '1'.
 */
import { Payment } from 'mercadopago';
import { mpConfig } from '@/lib/mercadopago';
import { addDays, type BillingCycle } from '@/lib/billing-period';

/** How long a generated renewal PIX stays payable. */
export const PIX_CHARGE_VALID_DAYS = 7;

export interface PixRenewalParams {
    workspaceId: string;
    userId: string;
    payerEmail: string;
    payerName?: string | null;
    planId: string;
    planName: string;
    cycle: BillingCycle;
    amountBrl: number;
    notificationUrl: string;
}

export interface PixCharge {
    id: string;
    ticketUrl: string | null;
    qrCode: string | null;
    expiresAt: Date;
}

export async function createPixRenewalCharge(params: PixRenewalParams, now = new Date()): Promise<PixCharge> {
    const expiresAt = addDays(now, PIX_CHARGE_VALID_DAYS);
    const payment = new Payment(mpConfig);
    const cycleLabel = params.cycle === 'annual' ? 'anual' : 'mensal';
    const res = await payment.create({
        body: {
            transaction_amount: params.amountBrl,
            description: `Precision IA Plano ${params.planName} — renovação ${cycleLabel}`,
            payment_method_id: 'pix',
            date_of_expiration: expiresAt.toISOString(),
            notification_url: params.notificationUrl,
            payer: {
                email: params.payerEmail,
                ...(params.payerName ? { first_name: params.payerName.split(' ')[0] } : {}),
            },
            metadata: {
                user_id: params.userId,
                workspace_id: params.workspaceId,
                plan_id: params.planId,
                interval: params.cycle,
                renewal: '1',
            },
        },
        // One charge per workspace per day even if the job runs twice.
        requestOptions: { idempotencyKey: `pix-renewal-${params.workspaceId}-${now.toISOString().slice(0, 10)}` },
    });
    if (res.id == null) throw new Error('Mercado Pago did not return a payment id for the PIX charge');
    const tx = res.point_of_interaction?.transaction_data;
    return {
        id: String(res.id),
        ticketUrl: tx?.ticket_url ?? null,
        qrCode: tx?.qr_code ?? null,
        expiresAt,
    };
}
