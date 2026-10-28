/**
 * Mercado Pago PreApproval (recurring subscription) via REST.
 * Used for card payments (recurring); PIX uses a Preference + one PIX charge per cycle (see mercadopago-pix.ts).
 */

const MP_BASE = 'https://api.mercadopago.com';

export type BillingCycle = 'monthly' | 'annual';

export interface CreatePreApprovalParams {
    payerEmail: string;
    /** Omit to let the customer enter the card on Mercado Pago's page (returns init_point). */
    cardTokenId?: string;
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

    const body = {
        reason: params.reason,
        external_reference: params.externalReference,
        payer_email: params.payerEmail,
        ...(params.cardTokenId ? { card_token_id: params.cardTokenId } : {}),
        // No end_date: the subscription renews until cancelled.
        auto_recurring: {
            frequency,
            frequency_type: frequencyType,
            transaction_amount: params.transactionAmount,
            currency_id: 'BRL',
        },
        back_url: params.backUrl,
        status: params.cardTokenId ? 'authorized' as const : 'pending' as const,
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

export async function updatePreApprovalAmount(preapprovalId: string, transactionAmount: number): Promise<void> {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN is not set');

    const res = await fetch(`${MP_BASE}/preapproval/${preapprovalId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            auto_recurring: {
                transaction_amount: transactionAmount,
                currency_id: 'BRL',
            },
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Mercado Pago update preapproval failed: ${res.status} ${err}`);
    }
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
