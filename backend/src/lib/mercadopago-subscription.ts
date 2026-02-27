/**
 * Mercado Pago PreApproval (recurring subscription) via REST.
 * Used when user pays with card; PIX/boleto use Preference (one-time) in checkout.
 */

const MP_BASE = 'https://api.mercadopago.com';

export type BillingCycle = 'monthly' | 'annual';

export interface CreatePreApprovalParams {
    payerEmail: string;
    cardTokenId: string;
    reason: string;
    externalReference: string;
    transactionAmount: number;
    cycle: BillingCycle;
    backUrl: string;
    notificationUrl?: string;
}

export interface PreApprovalResponse {
    id: string;
    init_point?: string;
    status: string;
    date_created?: string;
    last_modified?: string;
    next_payment_date?: string;
    auto_recurring?: {
        transaction_amount: number;
        currency_id: string;
        frequency: number;
        frequency_type: string;
        start_date?: string;
        end_date?: string;
    };
}

export async function createPreApproval(params: CreatePreApprovalParams): Promise<PreApprovalResponse> {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN is not set');

    const frequency = params.cycle === 'annual' ? 12 : 1;
    const frequencyType = 'months';
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 2);

    const body = {
        reason: params.reason,
        external_reference: params.externalReference,
        payer_email: params.payerEmail,
        card_token_id: params.cardTokenId,
        auto_recurring: {
            frequency,
            frequency_type: frequencyType,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            transaction_amount: params.transactionAmount,
            currency_id: 'BRL',
        },
        back_url: params.backUrl,
        status: 'authorized' as const,
        ...(params.notificationUrl && { notification_url: params.notificationUrl }),
    };

    const res = await fetch(`${MP_BASE}/preapproval`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Mercado Pago preapproval failed: ${res.status} ${err}`);
    }

    return res.json() as Promise<PreApprovalResponse>;
}

/** GET preapproval by id (for webhook). */
export async function getPreApproval(preapprovalId: string): Promise<PreApprovalResponse & { payer_id?: number }> {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN is not set');

    const res = await fetch(`${MP_BASE}/preapproval/${preapprovalId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Mercado Pago get preapproval failed: ${res.status} ${err}`);
    }

    return res.json() as Promise<PreApprovalResponse & { payer_id?: number }>;
}

/** Cancel a PreApproval (e.g. when applying a scheduled downgrade at period end). */
export async function cancelPreApproval(preapprovalId: string): Promise<void> {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN is not set');

    const res = await fetch(`${MP_BASE}/preapproval/${preapprovalId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'cancelled' }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Mercado Pago cancel preapproval failed: ${res.status} ${err}`);
    }
}
