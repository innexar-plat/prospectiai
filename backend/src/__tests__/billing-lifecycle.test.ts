/**
 * Billing lifecycle job: credit expiry, recurring PIX, unpaid plan expiry, pending plans.
 */
const mockFindMany = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue({});
const mockUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
const mockMemberFindFirst = jest.fn().mockResolvedValue({
    userId: 'u1',
    user: { email: 'owner@test.com', name: 'Owner', market: 'BR' },
});

jest.mock('@/lib/prisma', () => ({
    prisma: {
        workspace: {
            findMany: (...a: unknown[]) => mockFindMany(...a),
            update: (...a: unknown[]) => mockUpdate(...a),
            updateMany: (...a: unknown[]) => mockUpdateMany(...a),
        },
        workspaceMember: { findFirst: (...a: unknown[]) => mockMemberFindFirst(...a) },
    },
}));

const mockStripeRetrieve = jest.fn();
jest.mock('@/lib/stripe', () => ({ stripe: { subscriptions: { retrieve: (...a: unknown[]) => mockStripeRetrieve(...a) } } }));

const mockGetPreApproval = jest.fn();
const mockCancelPreApproval = jest.fn().mockResolvedValue(undefined);
const mockUpdateAmount = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/mercadopago-subscription', () => ({
    getPreApproval: (...a: unknown[]) => mockGetPreApproval(...a),
    cancelPreApproval: (...a: unknown[]) => mockCancelPreApproval(...a),
    updatePreApprovalAmount: (...a: unknown[]) => mockUpdateAmount(...a),
}));

const mockCreatePix = jest.fn();
jest.mock('@/lib/mercadopago-pix', () => ({ createPixRenewalCharge: (...a: unknown[]) => mockCreatePix(...a) }));

const emails = {
    sendCreditsExpiringEmail: jest.fn().mockResolvedValue(true),
    sendGraceExpiredEmail: jest.fn().mockResolvedValue(true),
    sendPixRenewalEmail: jest.fn().mockResolvedValue(true),
    sendPlanChangedEmail: jest.fn().mockResolvedValue(true),
    sendPlanExpiredEmail: jest.fn().mockResolvedValue(true),
    sendTrialExpiredEmail: jest.fn().mockResolvedValue(true),
    sendTrialExpiringEmail: jest.fn().mockResolvedValue(true),
};
jest.mock('@/lib/billing-emails', () => emails);
jest.mock('@/lib/reengagement', () => ({ runReengagementEmails: jest.fn().mockResolvedValue({ candidates: 0, sent: 0, fromRf: 0, fromHistory: 0 }) }));
jest.mock('@/lib/activation-lifecycle', () => ({ runActivationEmails: jest.fn().mockResolvedValue({ firstSearch: 0, nudge: 0 }) }));
jest.mock('@/lib/sales-routine', () => ({ runFollowUpReminders: jest.fn().mockResolvedValue({ sent: 0, pushed: 0, candidates: 0 }) }));
jest.mock('@/lib/email-enrichment', () => ({ runEmailEnrichment: jest.fn().mockResolvedValue({ checked: 0, found: 0 }) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { runBillingLifecycleJob, applyPendingPlanChange, renewalAmountBrl } from '@/lib/billing-lifecycle';

const NOW = new Date('2026-10-28T12:00:00Z');

/** Route findMany calls to fixtures by a recognisable part of the where clause. */
function fixtures(map: Partial<Record<'trialExpired' | 'trialEnding' | 'grace' | 'pending' | 'unanchored' | 'creditsDue' | 'creditsSoon' | 'pix' | 'expired', unknown[]>>) {
    mockFindMany.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        const w = JSON.stringify(where);
        if (where.plan === 'TRIAL' && w.includes('"lt"')) return Promise.resolve(map.trialExpired ?? []);
        if (where.plan === 'TRIAL') return Promise.resolve(map.trialEnding ?? []);
        if (where.subscriptionStatus === 'past_due') return Promise.resolve(map.grace ?? []);
        if (where.pendingPlanId) return Promise.resolve(map.pending ?? []);
        if (where.creditsResetAt === null) return Promise.resolve(map.unanchored ?? []);
        if (w.includes('"creditsResetAt":{"lte"')) return Promise.resolve(map.creditsDue ?? []);
        if (w.includes('"creditsResetAt":{"gt"')) return Promise.resolve(map.creditsSoon ?? []);
        if (w.includes('mp_pay_')) return Promise.resolve(map.pix ?? []);
        if (w.includes('"currentPeriodEnd":{"lt"')) return Promise.resolve(map.expired ?? []);
        return Promise.resolve([]);
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    fixtures({});
});

describe('runBillingLifecycleJob', () => {
    it('resets credits at the cycle boundary (unused credits expire) keeping the monthly anchor', async () => {
        fixtures({
            creditsDue: [{ id: 'w1', leadsUsed: 30, leadsLimit: 100, creditsResetAt: new Date('2026-09-15T00:00:00Z'), currentPeriodEnd: new Date('2027-09-15T00:00:00Z') }],
        });
        const report = await runBillingLifecycleJob({ now: NOW });
        expect(mockUpdateMany).toHaveBeenCalledWith({
            where: { id: 'w1', creditsResetAt: new Date('2026-09-15T00:00:00Z') },
            data: { leadsUsed: 0, creditsResetAt: new Date('2026-11-15T00:00:00Z') },
        });
        expect(report.actions[0].detail).toContain('70 unused credits expired');
    });

    it('dryRun reports without writing or emailing', async () => {
        fixtures({
            creditsDue: [{ id: 'w1', leadsUsed: 0, leadsLimit: 100, creditsResetAt: new Date('2026-10-01T00:00:00Z'), currentPeriodEnd: null }],
            expired: [{ id: 'w2', plan: 'BASIC', market: 'BR', subscriptionId: 'mp_pay_1', currentPeriodEnd: new Date('2026-08-16T00:00:00Z') }],
        });
        const report = await runBillingLifecycleJob({ now: NOW, dryRun: true });
        expect(report.counts).toEqual({ credits_reset: 1, plan_expired: 1 });
        expect(mockUpdate).not.toHaveBeenCalled();
        expect(mockUpdateMany).not.toHaveBeenCalled();
        expect(emails.sendPlanExpiredEmail).not.toHaveBeenCalled();
    });

    it('sends the credits-expiring notice only when a meaningful balance remains', async () => {
        const resetAt = new Date('2026-10-30T00:00:00Z');
        fixtures({
            creditsSoon: [
                { id: 'many', leadsUsed: 10, leadsLimit: 100, creditsResetAt: resetAt },
                { id: 'few', leadsUsed: 95, leadsLimit: 100, creditsResetAt: resetAt },
            ],
        });
        await runBillingLifecycleJob({ now: NOW });
        expect(emails.sendCreditsExpiringEmail).toHaveBeenCalledTimes(1);
        expect(emails.sendCreditsExpiringEmail).toHaveBeenCalledWith('many', expect.objectContaining({ email: 'owner@test.com' }), 90, 100, resetAt);
    });

    it('recurring PIX: creates the renewal charge before period end and emails it', async () => {
        const periodEnd = new Date('2026-11-01T00:00:00Z');
        fixtures({
            pix: [{
                id: 'w1', plan: 'BASIC', billingCycle: 'monthly', currentPeriodEnd: periodEnd, pendingPlanId: null,
                promoPaymentsRemaining: null, promoRegularAmountBrl: null, renewalPaymentId: null, renewalPaymentExpiresAt: null,
            }],
        });
        mockCreatePix.mockResolvedValue({ id: 'pay_9', ticketUrl: 'https://mp/pix', qrCode: '000201...', expiresAt: new Date('2026-11-04T00:00:00Z') });
        await runBillingLifecycleJob({ now: NOW });
        expect(mockCreatePix).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'w1', userId: 'u1', planId: 'BASIC', amountBrl: 99 }), NOW);
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'w1' },
            data: expect.objectContaining({ renewalPaymentId: 'pay_9', renewalPaymentQrCode: '000201...' }),
        }));
        expect(emails.sendPixRenewalEmail).toHaveBeenCalledWith('w1', expect.anything(), expect.objectContaining({ paymentId: 'pay_9', amountBrl: 99 }));
    });

    it('recurring PIX: does not create a second charge while one is open', async () => {
        fixtures({
            pix: [{
                id: 'w1', plan: 'BASIC', billingCycle: 'monthly', currentPeriodEnd: new Date('2026-11-01T00:00:00Z'),
                renewalPaymentId: 'pay_8', renewalPaymentExpiresAt: new Date('2026-11-02T00:00:00Z'),
            }],
        });
        await runBillingLifecycleJob({ now: NOW });
        expect(mockCreatePix).not.toHaveBeenCalled();
    });

    it('expires an unpaid PIX plan to FREE and sends a reactivation PIX for the same plan', async () => {
        fixtures({ expired: [{ id: 'w1', plan: 'BASIC', market: 'BR', subscriptionId: 'mp_pay_1', billingCycle: 'monthly', currentPeriodEnd: new Date('2026-08-16T00:00:00Z') }] });
        mockCreatePix.mockResolvedValue({ id: 'pay_r', ticketUrl: 'https://mp/pix', qrCode: '0002', expiresAt: new Date('2026-11-04T00:00:00Z') });
        const report = await runBillingLifecycleJob({ now: NOW });
        expect(mockUpdate).toHaveBeenNthCalledWith(1, { where: { id: 'w1' }, data: expect.objectContaining({ plan: 'FREE', subscriptionId: null, creditsResetAt: null }) });
        expect(mockCreatePix).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'w1', planId: 'BASIC', amountBrl: 99 }), NOW);
        expect(mockUpdate).toHaveBeenNthCalledWith(2, { where: { id: 'w1' }, data: expect.objectContaining({ renewalPaymentId: 'pay_r' }) });
        expect(emails.sendPlanExpiredEmail).toHaveBeenCalledWith('w1', expect.anything(), 'Starter', new Date('2026-08-16T00:00:00Z'),
            expect.objectContaining({ amountBrl: 99, ticketUrl: 'https://mp/pix' }));
        expect(report.counts.reactivation_pix).toBe(1);
    });

    it('still downgrades and emails when the reactivation PIX cannot be created', async () => {
        fixtures({ expired: [{ id: 'w1', plan: 'BASIC', market: 'BR', subscriptionId: 'mp_pay_1', billingCycle: 'monthly', currentPeriodEnd: new Date('2026-08-16T00:00:00Z') }] });
        mockCreatePix.mockRejectedValue(new Error('mp down'));
        const report = await runBillingLifecycleJob({ now: NOW });
        expect(emails.sendPlanExpiredEmail).toHaveBeenCalledWith('w1', expect.anything(), 'Starter', expect.any(Date), undefined);
        expect(report.errors).toEqual([expect.objectContaining({ step: 'reactivation_pix', detail: 'mp down' })]);
    });

    it('syncs instead of expiring when the card subscription is still paid at the provider', async () => {
        fixtures({ expired: [{ id: 'w1', plan: 'PRO', market: 'BR', subscriptionId: 'pre_1', currentPeriodEnd: new Date('2026-10-01T00:00:00Z') }] });
        mockGetPreApproval.mockResolvedValue({ id: 'pre_1', status: 'authorized', next_payment_date: '2026-11-01T00:00:00Z' });
        const report = await runBillingLifecycleJob({ now: NOW });
        expect(report.counts.period_synced).toBe(1);
        expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 'w1' }, data: expect.objectContaining({ currentPeriodEnd: new Date('2026-11-01T00:00:00Z'), subscriptionStatus: 'active' }) });
        expect(emails.sendPlanExpiredEmail).not.toHaveBeenCalled();
    });

    it('expires trials and emails', async () => {
        fixtures({ trialExpired: [{ id: 't1' }] });
        await runBillingLifecycleJob({ now: NOW });
        expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 't1' }, data: { subscriptionStatus: 'trial_expired', starterPromoEligible: true } });
        expect(emails.sendTrialExpiredEmail).toHaveBeenCalledWith('t1', expect.anything());
    });

    it('a failing step is reported and does not stop later steps', async () => {
        fixtures({
            expired: [{ id: 'w1', plan: 'PRO', market: 'BR', subscriptionId: 'sub_1', currentPeriodEnd: new Date('2026-10-01T00:00:00Z') }],
            trialExpired: [{ id: 't1' }],
        });
        mockStripeRetrieve.mockRejectedValue(new Error('stripe down'));
        const report = await runBillingLifecycleJob({ now: NOW });
        expect(report.errors).toEqual([expect.objectContaining({ step: 'plan_expired', workspaceId: 'w1', detail: 'stripe down' })]);
        expect(report.counts.trial_expired).toBe(1);
    });
});

it('never auto-expires manual grants (query requires a subscriptionId)', async () => {
    await runBillingLifecycleJob({ now: NOW, dryRun: true });
    const expiryQuery = mockFindMany.mock.calls.map((c) => c[0].where).find((w) => JSON.stringify(w).includes('"currentPeriodEnd":{"lt"') && w.plan?.in);
    expect(expiryQuery.subscriptionId).toEqual({ not: null });
    const pendingQuery = mockFindMany.mock.calls.map((c) => c[0].where).find((w) => w.pendingPlanId);
    expect(pendingQuery.subscriptionId).toEqual({ not: null });
});

describe('applyPendingPlanChange', () => {
    const base = {
        id: 'w1', plan: 'PRO', market: 'BR', billingCycle: 'monthly', currentPeriodEnd: new Date('2026-11-28T00:00:00Z'),
        promoPaymentsRemaining: null, promoRegularAmountBrl: null,
    } as const;

    it('MP card downgrade keeps the subscription and changes its amount', async () => {
        await applyPendingPlanChange({ ...base, subscriptionId: 'pre_1', pendingPlanId: 'BASIC' }, NOW);
        expect(mockUpdateAmount).toHaveBeenCalledWith('pre_1', 99);
        expect(mockCancelPreApproval).not.toHaveBeenCalled();
        expect(mockUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ plan: 'BASIC', leadsLimit: 100, leadsUsed: 0, pendingPlanId: null }),
        }));
    });

    it('cancel to FREE cancels the MP subscription and clears billing fields', async () => {
        await applyPendingPlanChange({ ...base, subscriptionId: 'pre_1', pendingPlanId: 'FREE' }, NOW);
        expect(mockCancelPreApproval).toHaveBeenCalledWith('pre_1');
        expect(mockUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ plan: 'FREE', subscriptionId: null, currentPeriodEnd: null }),
        }));
    });

    it('does not apply the downgrade when Mercado Pago rejects the amount change (retried next run)', async () => {
        mockUpdateAmount.mockRejectedValueOnce(new Error('mp 500'));
        await expect(applyPendingPlanChange({ ...base, subscriptionId: 'pre_1', pendingPlanId: 'BASIC' }, NOW)).rejects.toThrow('mp 500');
        expect(mockUpdateMany).not.toHaveBeenCalled();
    });
});

describe('renewalAmountBrl', () => {
    it('charges the Starter promo price while promo payments remain', () => {
        expect(renewalAmountBrl({ plan: 'BASIC', billingCycle: 'monthly', promoPaymentsRemaining: 2, promoRegularAmountBrl: 99 })).toBe(59);
        expect(renewalAmountBrl({ plan: 'BASIC', billingCycle: 'monthly', promoPaymentsRemaining: 0, promoRegularAmountBrl: null })).toBe(99);
        expect(renewalAmountBrl({ plan: 'PRO', billingCycle: 'annual', promoPaymentsRemaining: null, promoRegularAmountBrl: null })).toBe(3029);
    });
});
