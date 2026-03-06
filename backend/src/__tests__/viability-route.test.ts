const { POST } = require('@/app/api/viability/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { planHasModule } = require('@/lib/product-modules');
const { runViabilityAnalysis } = require('@/modules/viability');
const { NextRequest } = require('next/server');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));
jest.mock('@/lib/product-modules', () => ({ planHasModule: jest.fn() }));
jest.mock('@/modules/viability', () => ({ runViabilityAnalysis: jest.fn() }));

function req(body) {
  return new NextRequest('http://localhost/api/viability', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/viability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (planHasModule as jest.Mock).mockReturnValue(true);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      workspaces: [{ workspace: { plan: 'SCALE' } }],
      plan: 'SCALE',
      companyName: 'Acme',
      productService: 'Services',
    });
    (runViabilityAnalysis as jest.Mock).mockResolvedValue({ verdict: 'GO', summary: 'Ok' });
  });

  it('returns 429 when rate limit exceeded', async () => {
    const { rateLimit } = require('@/lib/ratelimit');
    (rateLimit as jest.Mock).mockResolvedValueOnce({ success: false });
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const res = await POST(req({ mode: 'new_business', businessType: 'Restaurant', city: 'São Paulo' }));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'Too many requests. Try again later.' });
  });

  it('returns 400 when body invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const res = await POST(req({ mode: 'new_business', businessType: 'X' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await POST(req({ mode: 'new_business', businessType: 'Shop', city: 'Rio' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 403 when plan does not have module', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (planHasModule as jest.Mock).mockReturnValue(false);
    const res = await POST(req({ mode: 'new_business', businessType: 'Store', city: 'BH' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      error: 'Viability analysis is only available on Scale plan. Upgrade to access.',
    });
  });

  it('returns 200 with result when valid input', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const res = await POST(req({ mode: 'new_business', businessType: 'Restaurant', city: 'São Paulo' }));
    expect(res.status).toBe(200);
    expect(runViabilityAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'new_business', businessType: 'Restaurant', city: 'São Paulo' }),
      'u1',
    );
    const data = await res.json();
    expect(data.verdict).toBe('GO');
  });

  it('returns 500 when runViabilityAnalysis throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (runViabilityAnalysis as jest.Mock).mockRejectedValue(new Error('Service error'));
    const res = await POST(req({ mode: 'new_business', businessType: 'Bar', city: 'Salvador' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal server error' });
  });
});
