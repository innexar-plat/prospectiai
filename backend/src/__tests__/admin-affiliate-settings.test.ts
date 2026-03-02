/**
 * Admin affiliate settings API: GET and PATCH.
 */
const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    affiliateSettings: {
      findFirst: mockFindFirst,
      findUnique: jest.fn(),
      update: mockUpdate,
      create: mockCreate,
    },
  },
}));

const { GET, PATCH } = require('@/app/api/admin/affiliate-settings/route');
const auth = require('@/auth').auth;
const isAdmin = require('@/lib/admin').isAdmin;

describe('GET /api/admin/affiliate-settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    isAdmin.mockReturnValue(true);
  });

  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    isAdmin.mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns settings when row exists', async () => {
    mockFindFirst.mockResolvedValue({
      id: 's1',
      defaultCommissionRatePercent: 20,
      cookieDurationDays: 30,
      commissionRule: 'FIRST_PAYMENT_ONLY',
      approvalHoldDays: 15,
      minPayoutCents: 10000,
      allowSelfSignup: true,
      updatedAt: new Date('2025-01-01'),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.defaultCommissionRatePercent).toBe(20);
    expect(data.commissionRule).toBe('FIRST_PAYMENT_ONLY');
  });
});

describe('PATCH /api/admin/affiliate-settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    isAdmin.mockReturnValue(true);
    mockFindFirst.mockResolvedValue({
      id: 's1',
      defaultCommissionRatePercent: 20,
      cookieDurationDays: 30,
      commissionRule: 'FIRST_PAYMENT_ONLY',
      approvalHoldDays: 15,
      minPayoutCents: 10000,
      allowSelfSignup: true,
      updatedAt: new Date(),
    });
    mockUpdate.mockResolvedValue({
      id: 's1',
      defaultCommissionRatePercent: 25,
      cookieDurationDays: 14,
      commissionRule: 'RECURRING',
      approvalHoldDays: 7,
      minPayoutCents: 5000,
      allowSelfSignup: false,
      updatedAt: new Date(),
    });
  });

  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({}) }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid payload', async () => {
    const res = await PATCH(new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultCommissionRatePercent: 150 }),
    }));
    expect(res.status).toBe(400);
  });

  it('updates and returns settings when valid', async () => {
    const res = await PATCH(new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultCommissionRatePercent: 25, commissionRule: 'RECURRING' }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.defaultCommissionRatePercent).toBe(25);
    expect(data.commissionRule).toBe('RECURRING');
  });
});
