const { POST } = require('@/app/api/billing/checkout/route');
const { auth } = require('@/auth');
const { stripe } = require('@/lib/stripe');
const { preference } = require('@/lib/mercadopago');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: jest.fn() } },
    subscriptions: { retrieve: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('@/lib/mercadopago', () => ({ preference: { create: jest.fn() } }));
jest.mock('@/lib/mercadopago-subscription', () => ({ createPreApproval: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'u1',
        workspaces: [{
          workspace: {
            id: 'w1',
            plan: 'TRIAL',
            subscriptionStatus: 'trial_expired',
            subscriptionId: null,
            starterPromoEligible: true,
          },
        }],
      }),
    },
    workspace: { update: jest.fn() },
  },
}));
jest.mock('@/lib/ratelimit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ success: true, remaining: 10, reset: 0 }),
}));
jest.mock('@/lib/telegram-business-alerts', () => ({
  notifyCheckoutStarted: jest.fn(),
  notifyPaymentCreated: jest.fn(),
  notifyPlanDowngradeScheduled: jest.fn(),
  notifyPlanUpgrade: jest.fn(),
}));

const { getRequestMarket } = require('@/lib/market');

function checkoutRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/billing/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: 'precisionai.innexar.app',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/billing/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue({ user: { id: 'u1', email: 'u@x.com', name: 'User' }, expires: '' });
    stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/test' });
    preference.create.mockResolvedValue({ id: 'pref_1', init_point: 'https://mp.test/checkout' });
  });

  it('resolves BR market from checkout request headers', () => {
    const req = checkoutRequest(
      { planId: 'BASIC' },
      { host: 'precisionia.com.br', 'X-Prospector-Market': 'BR' },
    );
    expect(getRequestMarket(req)).toBe('BR');
  });

  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await POST(checkoutRequest({ planId: 'PRO', interval: 'monthly' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 400 when planId is FREE or invalid', async () => {
    const res = await POST(checkoutRequest({ planId: 'FREE', interval: 'monthly' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Invalid plan' });
  });

  it('uses request host for Stripe success_url when market is US', async () => {
    const res = await POST(
      checkoutRequest(
        { planId: 'BASIC', interval: 'monthly', locale: 'en' },
        { host: 'precisionai.innexar.app' },
      ),
    );
    expect(res.status).toBe(200);
    const stripeArgs = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(stripeArgs.success_url).toContain('https://precisionai.innexar.app/');
    expect(stripeArgs.success_url).not.toContain('precisionia.com.br');
    expect(stripeArgs.cancel_url).toContain('https://precisionai.innexar.app/dashboard/planos');
  });

  it('creates Stripe checkout for US market with en locale and domain URLs', async () => {
    const res = await POST(
      checkoutRequest(
        { planId: 'BASIC', interval: 'monthly', locale: 'en' },
        { 'X-Prospector-Market': 'US' },
      ),
    );
    expect(res.status).toBe(200);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'en',
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'usd',
              unit_amount: 1900,
              product_data: expect.objectContaining({
                description: expect.stringContaining('50'),
              }),
            }),
          }),
        ],
        success_url: expect.stringContaining('https://precisionai.innexar.app/en/billing/success'),
        cancel_url: expect.stringContaining('https://precisionai.innexar.app/dashboard/planos'),
      }),
    );
    expect(preference.create).not.toHaveBeenCalled();
  });

  it('does not leak BR domain or pt locale into US Stripe checkout', async () => {
    const res = await POST(
      checkoutRequest(
        { planId: 'BASIC', interval: 'monthly', locale: 'en' },
        { host: 'precisionai.innexar.app', 'X-Prospector-Market': 'US' },
      ),
    );
    expect(res.status).toBe(200);
    const stripeArgs = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(stripeArgs.locale).toBe('en');
    expect(stripeArgs.locale).not.toBe('pt');
    expect(JSON.stringify(stripeArgs)).not.toContain('precisionia.com.br');
    expect(stripeArgs.success_url).toMatch(/^https:\/\/precisionai\.innexar\.app\//);
    expect(stripeArgs.cancel_url).toMatch(/^https:\/\/precisionai\.innexar\.app\//);
  });

  it('uses Mercado Pago for BR market even when locale is en', async () => {
    const res = await POST(
      checkoutRequest(
        { planId: 'BASIC', interval: 'monthly', locale: 'en' },
        { host: 'precisionia.com.br', 'X-Prospector-Market': 'BR' },
      ),
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.url).toBe('https://mp.test/checkout');
    expect(preference.create).toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('charges R$59 for BR Starter promo checkout via Mercado Pago', async () => {
    const res = await POST(
      checkoutRequest(
        { planId: 'STARTER_PROMO_BR', interval: 'monthly', promoCode: 'starter-6m' },
        { host: 'precisionia.com.br', 'X-Prospector-Market': 'BR' },
      ),
    );
    expect(res.status).toBe(200);
    expect(preference.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          items: [
            expect.objectContaining({
              unit_price: 59,
              title: expect.stringContaining('Starter'),
            }),
          ],
          metadata: expect.objectContaining({
            plan_id: 'BASIC',
            promo_id: 'starter-6m',
          }),
        }),
      }),
    );
  });
});
