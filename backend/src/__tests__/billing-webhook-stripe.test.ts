const { POST } = require('@/app/api/billing/webhook/route');

// --- Mocks ---
const mockConstructEvent = jest.fn();
const mockSubscriptionsRetrieve = jest.fn();
const mockInvoicesRetrieve = jest.fn();

jest.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) },
    subscriptions: { retrieve: (...args: unknown[]) => mockSubscriptionsRetrieve(...args) },
    invoices: { retrieve: (...args: unknown[]) => mockInvoicesRetrieve(...args) },
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    workspace: { update: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/webhook-dedup', () => ({
  isWebhookDuplicate: jest.fn().mockResolvedValue(false),
}));

jest.mock('@/lib/ratelimit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ success: true, remaining: 100, reset: 0 }),
}));

jest.mock('@/lib/affiliate', () => ({
  createCommissionForFirstPayment: jest.fn().mockResolvedValue(undefined),
  cancelCommissionsByOrderOrSubscription: jest.fn().mockResolvedValue(0),
  createCommissionForRecurring: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({ get: () => 'sig_test' }),
}));

const { prisma } = require('@/lib/prisma');
const { rateLimit } = require('@/lib/ratelimit');
const { isWebhookDuplicate } = require('@/lib/webhook-dedup');

function makeReq(body = '{}') {
  return new Request('http://x/api/billing/webhook', { method: 'POST', body });
}

describe('POST /api/billing/webhook (Stripe)', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns 429 when rate limited', async () => {
    rateLimit.mockResolvedValueOnce({ success: false, remaining: 0, reset: 60 });
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
  });

  it('returns 400 when signature is invalid', async () => {
    mockConstructEvent.mockImplementation(() => { throw new Error('Invalid signature'); });
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
  });

  it('returns 200 and skips processing for duplicate events', async () => {
    isWebhookDuplicate.mockResolvedValueOnce(true);
    mockConstructEvent.mockReturnValue({ id: 'evt_dup', type: 'checkout.session.completed', data: { object: {} } });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(prisma.workspace.update).not.toHaveBeenCalled();
  });

  it('handles checkout.session.completed — updates workspace with US leads limit', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'u1', planId: 'BASIC' }, subscription: 'sub_1', id: 'cs_1' } },
    });
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_1', customer: 'cus_1', status: 'active', current_period_end: Math.floor(Date.now() / 1000) + 86400,
      items: { data: [{ price: { recurring: { interval: 'month' } } }] },
    });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@x.com', workspaces: [{ workspaceId: 'w1' }] });
    prisma.workspace.update.mockResolvedValue({});

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(prisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w1' },
        data: expect.objectContaining({ plan: 'BASIC', subscriptionId: 'sub_1', leadsLimit: 50 }),
      }),
    );
  });

  it('returns 400 when planId metadata is invalid', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_bad',
      type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'u1', planId: 'INVALID' }, subscription: 'sub_1', id: 'cs_1' } },
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    expect(prisma.workspace.update).not.toHaveBeenCalled();
  });

  it('handles customer.subscription.deleted — downgrades to FREE', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_2',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_del', current_period_end: Math.floor(Date.now() / 1000), status: 'canceled' } },
    });
    prisma.workspace.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(prisma.workspace.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { subscriptionId: 'sub_del' }, data: expect.objectContaining({ plan: 'FREE' }) }),
    );
  });

  it('handles customer.subscription.updated — past_due sets grace period', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_3',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_upd', metadata: { planId: 'PRO' }, status: 'past_due',
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
          items: { data: [{ price: { recurring: { interval: 'month' } } }] },
        },
      },
    });
    prisma.workspace.findFirst.mockResolvedValue({ plan: 'BASIC' });
    prisma.workspace.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(prisma.workspace.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subscriptionStatus: 'past_due', gracePeriodEnd: expect.any(Date) }),
      }),
    );
  });
});
