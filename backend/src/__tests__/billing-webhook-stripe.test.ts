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
    representative: { findUnique: jest.fn(), update: jest.fn() },
    repClient: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    repCommission: { create: jest.fn() },
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

const mockHeadersGet = jest.fn().mockReturnValue('sig_test');
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({ get: (...args: unknown[]) => mockHeadersGet(...args) }),
}));

const { prisma } = require('@/lib/prisma');
const { rateLimit } = require('@/lib/ratelimit');
const { isWebhookDuplicate } = require('@/lib/webhook-dedup');
const { logger } = require('@/lib/logger');
const { PLANS } = require('@/lib/billing-config');

function makeReq(body = '{}', headers: Record<string, string> = {}) {
  return new Request('http://x/api/billing/webhook', { method: 'POST', body, headers });
}

describe('POST /api/billing/webhook (Stripe)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHeadersGet.mockReturnValue('sig_test');
  });

  it('returns 429 when rate limited', async () => {
    rateLimit.mockResolvedValueOnce({ success: false, remaining: 0, reset: 60 });
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
  });

  it('returns 400 when signature is invalid', async () => {
    mockConstructEvent.mockImplementation(() => { throw new Error('Invalid signature'); });
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    expect(logger.error).toHaveBeenCalledWith('Stripe webhook error', expect.objectContaining({ error: 'Invalid signature' }));
  });

  it('logs warn (not error) for probe requests without stripe-signature', async () => {
    mockHeadersGet.mockReturnValue(null);
    mockConstructEvent.mockImplementation(() => { throw new Error('No signatures found'); });
    const res = await POST(makeReq('{}', { 'user-agent': 'curl/8.0.0' }));
    expect(res.status).toBe(400);
    expect(logger.warn).toHaveBeenCalledWith('Stripe webhook probe rejected', expect.any(Object));
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs warn when stripe-signature header is missing on non-probe requests', async () => {
    mockHeadersGet.mockReturnValue(null);
    mockConstructEvent.mockImplementation(() => { throw new Error('No signatures found'); });
    const res = await POST(makeReq('{}', { 'user-agent': 'Stripe/1.0' }));
    expect(res.status).toBe(400);
    expect(logger.warn).toHaveBeenCalledWith('Stripe webhook missing signature', expect.any(Object));
    expect(logger.error).not.toHaveBeenCalled();
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

  it('handles checkout.session.completed with a rep referral — creates RepClient with the real customer name/email, not a truncated user id', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_rep1',
      type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'u1', planId: 'BASIC', rep: 'cmrrep1' }, subscription: 'sub_1', id: 'cs_1' } },
    });
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_1', customer: 'cus_1', status: 'active', current_period_end: Math.floor(Date.now() / 1000) + 86400,
      items: { data: [{ price: { recurring: { interval: 'month' } } }] },
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'real-customer@x.com', name: 'Real Customer', workspaces: [{ workspaceId: 'w1' }],
    });
    prisma.workspace.update.mockResolvedValue({});
    prisma.representative.findUnique.mockResolvedValue({ id: 'cmrrep1', status: 'ACTIVE', directCommissionPct: 20, commissionHoldDays: 30 });
    prisma.repClient.findFirst.mockResolvedValue(null);
    prisma.repClient.create.mockResolvedValue({ id: 'client1' });
    prisma.repCommission.create.mockResolvedValue({ id: 'comm1', amountCents: 1980 });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(prisma.repClient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Real Customer',
        email: 'real-customer@x.com',
      }),
    });
  });

  it('falls back to email, then to a truncated user id, when the customer has no name on file', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_rep2',
      type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'u2', planId: 'BASIC', rep: 'cmrrep1' }, subscription: 'sub_1', id: 'cs_1' } },
    });
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_1', customer: 'cus_1', status: 'active', current_period_end: Math.floor(Date.now() / 1000) + 86400,
      items: { data: [{ price: { recurring: { interval: 'month' } } }] },
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u2', email: 'noname@x.com', name: null, workspaces: [{ workspaceId: 'w2' }],
    });
    prisma.workspace.update.mockResolvedValue({});
    prisma.representative.findUnique.mockResolvedValue({ id: 'cmrrep1', status: 'ACTIVE', directCommissionPct: 20, commissionHoldDays: 30 });
    prisma.repClient.findFirst.mockResolvedValue(null);
    prisma.repClient.create.mockResolvedValue({ id: 'client2' });
    prisma.repCommission.create.mockResolvedValue({ id: 'comm2', amountCents: 1980 });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(prisma.repClient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'noname@x.com' }),
    });
  });

  it('does not overwrite name/email when a lead RepClient already exists for this workspace (created at signup)', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_rep3',
      type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'u3', planId: 'BASIC', rep: 'cmrrep1' }, subscription: 'sub_1', id: 'cs_1' } },
    });
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_1', customer: 'cus_1', status: 'active', current_period_end: Math.floor(Date.now() / 1000) + 86400,
      items: { data: [{ price: { recurring: { interval: 'month' } } }] },
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u3', email: 'u3@x.com', name: 'U3', workspaces: [{ workspaceId: 'w3' }],
    });
    prisma.workspace.update.mockResolvedValue({});
    prisma.representative.findUnique.mockResolvedValue({ id: 'cmrrep1', status: 'ACTIVE', directCommissionPct: 20, commissionHoldDays: 30 });
    prisma.repClient.findFirst.mockResolvedValue({ id: 'existing-lead', name: 'Lead Name', email: 'lead@x.com' });
    prisma.repClient.update.mockResolvedValue({ id: 'existing-lead' });
    prisma.repCommission.create.mockResolvedValue({ id: 'comm3', amountCents: 1980 });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(prisma.repClient.create).not.toHaveBeenCalled();
    expect(prisma.repClient.update).toHaveBeenCalledWith({
      where: { id: 'existing-lead' },
      data: { planId: 'BASIC', valueCents: expect.any(Number), status: 'ACTIVE' },
    });
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

  it('handles customer.subscription.deleted — downgrades to FREE with the standard FREE credit allowance, not 0', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_2',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_del', current_period_end: Math.floor(Date.now() / 1000), status: 'canceled' } },
    });
    prisma.workspace.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(prisma.workspace.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { subscriptionId: 'sub_del' }, data: expect.objectContaining({ plan: 'FREE', leadsLimit: PLANS.FREE.leadsLimit }) }),
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
