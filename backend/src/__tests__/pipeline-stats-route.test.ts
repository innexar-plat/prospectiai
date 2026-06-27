const { GET } = require('@/app/api/pipeline/stats/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { getConversionStats } = require('@/lib/lead-intelligence');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceMember: { findFirst: jest.fn() },
  },
}));
jest.mock('@/lib/lead-intelligence', () => ({
  getConversionStats: jest.fn(),
}));

describe('GET /api/pipeline/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({ workspaceId: 'ws1' });
    (getConversionStats as jest.Mock).mockResolvedValue({
      conversionRate: 25,
      avgDealValue: 500,
      avgCycleDays: 14,
      converted: 3,
      lost: 1,
      topLostReasons: [{ reason: 'Preço', count: 1 }],
    });
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns conversion stats for workspace', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.conversionRate).toBe(25);
    expect(json.avgDealValue).toBe(500);
    expect(getConversionStats).toHaveBeenCalledWith('u1', 'ws1');
  });

  it('falls back to userId when no workspace membership', async () => {
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(getConversionStats).toHaveBeenCalledWith('u1', undefined);
  });

  it('returns 503 when database is unavailable', async () => {
    (prisma.workspaceMember.findFirst as jest.Mock).mockRejectedValue(
      new (require('@prisma/client').Prisma.PrismaClientKnownRequestError)('db down', {
        code: 'P1001',
        clientVersion: 'test',
      }),
    );
    const res = await GET();
    expect(res.status).toBe(503);
  });
});
