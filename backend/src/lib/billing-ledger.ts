/**
 * Ledger of received payments. Webhooks record each approved payment once (upsert by provider id);
 * refunds flip the status. Best-effort: a ledger failure must never fail the webhook.
 */
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface LedgerPayment {
    workspaceId?: string | null;
    provider: 'mercadopago' | 'stripe';
    externalId: string;
    method?: string | null;
    kind: 'FIRST' | 'RENEWAL';
    amountCents: number;
    currency: 'BRL' | 'USD';
    planId?: string | null;
}

export async function recordPayment(p: LedgerPayment): Promise<void> {
    if (!p.externalId || !(p.amountCents > 0)) return;
    try {
        await prisma.billingPayment.upsert({
            where: { externalId: p.externalId },
            create: { ...p, workspaceId: p.workspaceId ?? null, method: p.method ?? null, planId: p.planId ?? null },
            update: {},
        });
    } catch (err) {
        logger.warn('Billing ledger: record payment failed', { externalId: p.externalId, error: err instanceof Error ? err.message : 'Unknown' });
    }
}

export async function markPaymentRefunded(externalId: string): Promise<void> {
    try {
        await prisma.billingPayment.updateMany({ where: { externalId }, data: { status: 'REFUNDED' } });
    } catch (err) {
        logger.warn('Billing ledger: mark refunded failed', { externalId, error: err instanceof Error ? err.message : 'Unknown' });
    }
}
