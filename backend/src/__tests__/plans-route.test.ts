const { GET } = require('@/app/api/plans/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    planConfig: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
  },
}));

describe('GET /api/plans', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 200 with plans from DB', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const plans = [
      { key: 'FREE', name: 'Free', leadsLimit: 5, priceMonthlyBrl: 0, priceAnnualBrl: 0, modules: ['MAPEAMENTO'] },
    ];
    (prisma.planConfig.findMany as jest.Mock).mockResolvedValue(plans);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(plans);
    expect(prisma.planConfig.createMany).not.toHaveBeenCalled();
  });

  it('seeds defaults and returns when table empty', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.planConfig.findMany as jest.Mock).mockResolvedValue([]);
    const seeded = [
      { key: 'FREE', name: 'Free', leadsLimit: 5, priceMonthlyBrl: 0, priceAnnualBrl: 0, modules: ['MAPEAMENTO'] },
    ];
    (prisma.planConfig.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(seeded);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.planConfig.createMany).toHaveBeenCalled();
    const data = await res.json();
    expect(data).toEqual(seeded);
  });

  it('rejects when findMany throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.planConfig.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));
    await expect(GET()).rejects.toThrow('DB error');
  });
});
