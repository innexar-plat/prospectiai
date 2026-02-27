const { POST } = require('@/app/api/billing/checkout/route');
const { auth } = require('@/auth');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/stripe', () => ({ stripe: { checkout: { sessions: { create: jest.fn() } } } }));
jest.mock('@/lib/mercadopago', () => ({ preference: { create: jest.fn() } }));

describe('POST /api/billing/checkout', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await POST(new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: 'PRO', interval: 'monthly' }) }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 400 when planId is FREE or invalid', async () => {
    auth.mockResolvedValue({ user: { id: 'u1', email: 'u@x.com' }, expires: '' });
    const res = await POST(new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: 'FREE', interval: 'monthly' }) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Invalid plan' });
  });
});
