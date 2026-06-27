export {};

const { GET } = require('@/app/api/plans/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'u1',
        workspaces: [{ workspace: { plan: 'FREE', subscriptionStatus: null, starterPromoEligible: false } }],
      }),
    },
    planConfig: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      upsert: jest.fn().mockResolvedValue({}),
    },
  },
}));

describe('GET /api/plans', () => {
  const req = new Request('http://localhost/api/plans', {
    headers: { host: 'precisionia.com.br' },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 200 with plans from DB', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const plans = [
      { key: 'FREE', name: 'Free', leadsLimit: 10, priceMonthlyBrl: 0, priceAnnualBrl: 0, priceMonthlyUsd: 0, priceAnnualUsd: 0, modules: ['MAPEAMENTO'] },
    ];
    (prisma.planConfig.findMany as jest.Mock).mockResolvedValue(plans);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(plans.map((p) => ({ ...p, currency: 'BRL' })));
  });

  it('returns US currency and 50 BASIC credits for US market', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const plans = [
      {
        key: 'BASIC',
        name: 'Starter',
        leadsLimit: 100,
        priceMonthlyBrl: 99,
        priceAnnualBrl: 989,
        priceMonthlyUsd: 19,
        priceAnnualUsd: 190,
        modules: ['MAPEAMENTO'],
      },
    ];
    (prisma.planConfig.findMany as jest.Mock).mockResolvedValue(plans);
    const usReq = new Request('http://localhost/api/plans', {
      headers: { host: 'precisionai.innexar.app', 'X-Prospector-Market': 'US' },
    });
    const res = await GET(usReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0]).toMatchObject({ key: 'BASIC', leadsLimit: 50, currency: 'USD' });
    expect(data[0].promo).toBeUndefined();
  });

  it('seeds defaults and returns when table empty', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const seeded = [
      { key: 'FREE', name: 'Free', leadsLimit: 10, priceMonthlyBrl: 0, priceAnnualBrl: 0, priceMonthlyUsd: 0, priceAnnualUsd: 0, modules: ['MAPEAMENTO'] },
    ];
    (prisma.planConfig.findMany as jest.Mock).mockResolvedValue(seeded);
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(prisma.planConfig.upsert).toHaveBeenCalled();
    const data = await res.json();
    expect(data).toEqual(seeded.map((p) => ({ ...p, currency: 'BRL' })));
  });

  it('rejects when findMany throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.planConfig.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));
    await expect(GET(req)).rejects.toThrow('DB error');
  });
});
