/**
 * Mercado Pago webhook: card subscriptions (PreApproval) and recurring PIX.
 */
import { createHmac } from 'crypto';

const mockWsFindFirst = jest.fn();
const mockWsFindUnique = jest.fn();
const mockWsUpdate = jest.fn().mockResolvedValue({});
const mockWsUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
const mockUserFindUnique = jest.fn();
const mockMemberFindFirst = jest.fn().mockResolvedValue({ user: { email: 'owner@test.com', name: 'Owner', market: 'BR' } });

jest.mock('@/lib/prisma', () => ({
    prisma: {
        workspace: {
            findFirst: (...a: unknown[]) => mockWsFindFirst(...a),
            findUnique: (...a: unknown[]) => mockWsFindUnique(...a),
            update: (...a: unknown[]) => mockWsUpdate(...a),
            updateMany: (...a: unknown[]) => mockWsUpdateMany(...a),
        },
        user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
        workspaceMember: { findFirst: (...a: unknown[]) => mockMemberFindFirst(...a) },
    },
}));

const mockPaymentGet = jest.fn();
jest.mock('mercadopago', () => ({ Payment: jest.fn().mockImplementation(() => ({ get: (...a: unknown[]) => mockPaymentGet(...a) })) }));
jest.mock('@/lib/mercadopago', () => ({ mpConfig: {} }));

const mockGetPreApproval = jest.fn();
const mockCancelPreApproval = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/mercadopago-subscription', () => ({
    getPreApproval: (...a: unknown[]) => mockGetPreApproval(...a),
    cancelPreApproval: (...a: unknown[]) => mockCancelPreApproval(...a),
    updatePreApprovalAmount: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/stripe', () => ({ stripe: {} }));
jest.mock('@/lib/mercadopago-pix', () => ({ createPixRenewalCharge: jest.fn() }));

const mockIsDuplicate = jest.fn().mockResolvedValue(false);
jest.mock('@/lib/webhook-dedup', () => ({ isWebhookDuplicate: (...a: unknown[]) => mockIsDuplicate(...a) }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock('@/lib/email', () => ({ sendEmail: jest.fn().mockResolvedValue({ sent: true }) }));
const mockRenewalEmail = jest.fn().mockResolvedValue(true);
const mockCancelledEmail = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/billing-emails', () => ({
    sendRenewalConfirmedEmail: (...a: unknown[]) => mockRenewalEmail(...a),
    sendSubscriptionCancelledEmail: (...a: unknown[]) => mockCancelledEmail(...a),
}));
const mockFirstCommission = jest.fn().mockResolvedValue(undefined);
const mockRecurringCommission = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/affiliate', () => ({
    createCommissionForFirstPayment: (...a: unknown[]) => mockFirstCommission(...a),
    createCommissionForRecurring: (...a: unknown[]) => mockRecurringCommission(...a),
    cancelCommissionsByOrderOrSubscription: jest.fn().mockResolvedValue(0),
}));
jest.mock('@/lib/telegram-business-alerts', () => new Proxy({}, { get: () => jest.fn() }));
const mockRecordPayment = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/billing-ledger', () => ({
    recordPayment: (...a: unknown[]) => mockRecordPayment(...a),
    markPaymentRefunded: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/ops-telemetry', () => ({ recordWebhook: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { POST } from '@/app/api/billing/webhook/mercadopago/route';

const SECRET = 'mp-secret';

function notify(type: string, id: string): Request {
    const ts = '1700000000';
    const requestId = 'req-1';
    const v1 = createHmac('sha256', SECRET).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
    return new Request(`http://localhost/api/billing/webhook/mercadopago?type=${type}&data.id=${id}`, {
        method: 'POST',
        headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId },
    });
}

const workspace = (over: Record<string, unknown> = {}) => ({
    id: 'w1', market: 'BR', plan: 'BASIC', subscriptionStatus: 'active', subscriptionId: 'pre_old',
    currentPeriodEnd: new Date('2026-11-10T00:00:00Z'), pendingPlanId: null,
    promoPaymentsRemaining: null, promoRegularAmountBrl: null, ...over,
});

beforeEach(() => {
    jest.clearAllMocks();
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
    mockUserFindUnique.mockResolvedValue({ id: 'u1', email: 'owner@test.com', name: 'Owner', workspaces: [{ workspaceId: 'w1', workspace: workspace() }] });
});

describe('MP webhook — card subscription', () => {
    it('upgrade: activating a new PreApproval cancels the previous one (no double billing) and refills credits', async () => {
        mockGetPreApproval.mockResolvedValue({
            id: 'pre_new', status: 'authorized', external_reference: 'u1:PRO:monthly',
            date_created: '2026-10-28T10:00:00Z', next_payment_date: '2026-11-28T10:00:00Z', auto_recurring: { transaction_amount: 297 },
        });
        mockWsFindFirst.mockResolvedValue(null);

        await POST(notify('subscription_preapproval', 'pre_new'));

        expect(mockCancelPreApproval).toHaveBeenCalledWith('pre_old');
        expect(mockWsUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ subscriptionId: 'pre_new', plan: 'PRO', leadsLimit: 400, leadsUsed: 0 }),
        }));
        expect(mockFirstCommission).toHaveBeenCalledTimes(1);
        expect(mockIsDuplicate).toHaveBeenCalledWith('mercadopago', 'preapproval:pre_new:authorized');
    });

    it('a repeated "authorized" notification does not refill credits', async () => {
        mockGetPreApproval.mockResolvedValue({ id: 'pre_old', status: 'authorized', external_reference: 'u1:BASIC:monthly', next_payment_date: '2026-11-10T00:00:00Z' });
        mockWsFindFirst.mockResolvedValue(workspace());

        await POST(notify('preapproval', 'pre_old'));

        const data = mockWsUpdate.mock.calls[0][0].data;
        expect(data).not.toHaveProperty('leadsUsed');
        expect(mockCancelPreApproval).not.toHaveBeenCalled();
        expect(mockFirstCommission).not.toHaveBeenCalled();
    });

    it('monthly charge renews: credits refilled, recurring commission, renewal email', async () => {
        mockPaymentGet.mockResolvedValue({
            id: 555, status: 'approved', transaction_amount: 99, date_created: '2026-11-10T08:00:00Z',
            metadata: { preapproval_id: 'pre_old' },
        });
        mockGetPreApproval.mockResolvedValue({
            id: 'pre_old', status: 'authorized', external_reference: 'u1:BASIC:monthly',
            date_created: '2026-09-10T08:00:00Z', next_payment_date: '2026-12-10T08:00:00Z',
        });
        mockWsFindFirst.mockResolvedValue(workspace());

        await POST(notify('payment', '555'));

        expect(mockWsUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ leadsUsed: 0, currentPeriodEnd: new Date('2026-12-10T08:00:00Z') }),
        }));
        expect(mockRecurringCommission).toHaveBeenCalledWith(expect.objectContaining({ orderId: '555', valueCents: 9900 }));
        expect(mockRenewalEmail).toHaveBeenCalled();
        expect(mockRecordPayment).toHaveBeenCalledWith(expect.objectContaining({
            externalId: 'mp:555', kind: 'RENEWAL', method: 'credit_card', amountCents: 9900, workspaceId: 'w1',
        }));
    });

    it('pending PreApproval (checkout in progress) does not mark the account past_due', async () => {
        mockGetPreApproval.mockResolvedValue({ id: 'pre_new', status: 'pending', external_reference: 'u1:PRO:monthly' });
        await POST(notify('preapproval', 'pre_new'));
        expect(mockWsUpdate).not.toHaveBeenCalled();
    });

    it('cancelled subscription keeps paid access until period end, then FREE is scheduled', async () => {
        mockGetPreApproval.mockResolvedValue({ id: 'pre_old', status: 'cancelled', external_reference: 'u1:BASIC:monthly' });
        mockWsFindFirst.mockResolvedValue(workspace({ currentPeriodEnd: new Date('2099-01-01T00:00:00Z') }));

        await POST(notify('preapproval', 'pre_old'));

        expect(mockWsUpdate).toHaveBeenCalledWith({
            where: { id: 'w1' },
            data: { subscriptionStatus: 'canceled', pendingPlanId: 'FREE', pendingPlanEffectiveAt: new Date('2099-01-01T00:00:00Z') },
        });
        expect(mockCancelledEmail).toHaveBeenCalled();
    });

    it('cancellation of an old, replaced PreApproval is ignored', async () => {
        mockGetPreApproval.mockResolvedValue({ id: 'pre_old', status: 'cancelled', external_reference: 'u1:BASIC:monthly' });
        mockWsFindFirst.mockResolvedValue(null);
        mockUserFindUnique.mockResolvedValue({ id: 'u1', workspaces: [{ workspaceId: 'w1', workspace: workspace({ subscriptionId: 'pre_new' }) }] });

        await POST(notify('preapproval', 'pre_old'));
        expect(mockWsUpdate).not.toHaveBeenCalled();
    });
});

describe('MP webhook — recurring PIX', () => {
    it('renewal PIX payment extends from the current period end and sends the renewal email', async () => {
        mockPaymentGet.mockResolvedValue({
            id: 777, status: 'approved', transaction_amount: 99,
            metadata: { user_id: 'u1', workspace_id: 'w1', plan_id: 'BASIC', interval: 'monthly', renewal: '1' },
        });
        const current = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        mockWsFindUnique.mockResolvedValue(workspace({ subscriptionId: 'mp_pay_100', currentPeriodEnd: current }));

        await POST(notify('payment', '777'));

        const data = mockWsUpdate.mock.calls[0][0].data;
        expect(data.subscriptionId).toBe('mp_pay_777');
        expect(data.leadsUsed).toBe(0);
        expect(data.renewalPaymentId).toBeNull();
        const expected = new Date(current); expected.setUTCMonth(expected.getUTCMonth() + 1);
        expect((data.currentPeriodEnd as Date).toISOString().slice(0, 10)).toBe(expected.toISOString().slice(0, 10));
        expect(mockRecurringCommission).toHaveBeenCalled();
        expect(mockFirstCommission).not.toHaveBeenCalled();
        expect(mockRenewalEmail).toHaveBeenCalled();
        expect(mockRecordPayment).toHaveBeenCalledWith(expect.objectContaining({ externalId: 'mp:777', kind: 'RENEWAL', amountCents: 9900 }));
    });

    it('first PIX purchase replacing a card subscription cancels the card PreApproval', async () => {
        mockPaymentGet.mockResolvedValue({
            id: 778, status: 'approved', transaction_amount: 297,
            metadata: { user_id: 'u1', plan_id: 'PRO', interval: 'monthly' },
        });
        await POST(notify('payment', '778'));
        expect(mockCancelPreApproval).toHaveBeenCalledWith('pre_old');
        expect(mockFirstCommission).toHaveBeenCalled();
    });
});
