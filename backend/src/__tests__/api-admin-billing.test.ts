const mockAuth = jest.fn();
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));
jest.mock('@/lib/admin', () => ({ isAdmin: (s: { user?: { email?: string } } | null) => s?.user?.email === 'admin@x.com' }));
jest.mock('@/lib/audit', () => ({ logAdminAction: jest.fn().mockResolvedValue(undefined) }));
const now = Date.now();
jest.mock('@/lib/prisma', () => ({
    prisma: {
        workspace: {
            findMany: jest.fn().mockResolvedValue([
                { id: 'w1', name: 'Pix Co', market: 'BR', plan: 'BASIC', subscriptionId: 'mp_pay_1', subscriptionStatus: 'active', billingCycle: 'monthly',
                  currentPeriodEnd: new Date(now + 3 * 86400000), creditsResetAt: null, leadsUsed: 10, leadsLimit: 100, pendingPlanId: null,
                  pendingPlanEffectiveAt: null, gracePeriodEnd: null, cnpj: null, renewalPaymentId: 'p1', renewalPaymentUrl: 'https://mp', renewalPaymentExpiresAt: new Date(now + 86400000),
                  promoPaymentsRemaining: null, members: [{ user: { email: 'a@a.com', name: 'A' } }] },
                { id: 'w2', name: 'Interno', market: 'BR', plan: 'SCALE', subscriptionId: null, subscriptionStatus: 'active', billingCycle: null,
                  currentPeriodEnd: null, creditsResetAt: null, leadsUsed: 0, leadsLimit: 5000, pendingPlanId: null, pendingPlanEffectiveAt: null,
                  gracePeriodEnd: null, cnpj: null, renewalPaymentId: null, renewalPaymentUrl: null, renewalPaymentExpiresAt: null,
                  promoPaymentsRemaining: null, members: [] },
            ]),
        },
        planConfig: { findMany: jest.fn().mockResolvedValue([]) },
        billingPayment: {
            findMany: jest.fn().mockResolvedValue([{ id: 'b1', amountCents: 9900, currency: 'BRL' }]),
            groupBy: jest.fn().mockResolvedValue([{ currency: 'BRL', _sum: { amountCents: 9900 }, _count: 1 }]),
        },
        $queryRaw: jest.fn().mockResolvedValue([{ month: '2026-10', currency: 'BRL', cents: BigInt(9900), n: BigInt(1) }]),
    },
}));

import { GET } from '@/app/api/admin/billing/route';

describe('GET /api/admin/billing', () => {
    it('rejects non-admins', async () => {
        mockAuth.mockResolvedValue({ user: { id: 'u', email: 'user@x.com' } });
        expect((await GET()).status).toBe(403);
    });

    it('counts only payment-backed plans in MRR and lists manual grants separately', async () => {
        mockAuth.mockResolvedValue({ user: { id: 'u', email: 'admin@x.com' } });
        const body = await (await GET()).json();
        expect(body.summary.paying).toBe(1);
        expect(body.summary.byProvider.pix).toBe(1);
        expect(body.summary.manualGrants).toBe(1);
        expect(body.summary.mrrBrl).toBe(99);
        expect(body.summary.expiring7d).toBe(1);
        expect(body.summary.openPix).toBe(1);
        expect(body.summary.revenue30d).toEqual([{ currency: 'BRL', amount: 99, payments: 1 }]);
        expect(body.subscriptions.find((s: { id: string }) => s.id === 'w2').provider).toBe('manual');
        expect(body.revenueByMonth).toEqual([{ month: '2026-10', currency: 'BRL', amount: 99, payments: 1 }]);
    });
});
