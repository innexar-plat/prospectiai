const { GET } = require('@/app/api/pipeline/daily-brief/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { getConversionStats } = require('@/lib/lead-intelligence');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceMember: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    pipelineBrief: { findUnique: jest.fn(), upsert: jest.fn() },
    leadAnalysis: { findMany: jest.fn() },
  },
}));
jest.mock('@/lib/lead-intelligence', () => ({
  getConversionStats: jest.fn(),
}));

describe('GET /api/pipeline/daily-brief', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: 'PRO' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({
      workspaceId: 'ws1',
      workspace: { plan: 'PRO' },
    });
    (prisma.pipelineBrief.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.leadAnalysis.findMany as jest.Mock).mockResolvedValue([]);
    (getConversionStats as jest.Mock).mockResolvedValue({
      conversionRate: null,
      avgDealValue: null,
      avgCycleDays: null,
      converted: 0,
      lost: 0,
      topLostReasons: [],
    });
    (prisma.pipelineBrief.upsert as jest.Mock).mockResolvedValue({ id: 'brief1' });
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 401 when auth throws', async () => {
    (auth as jest.Mock).mockRejectedValue(new Error('invalid session'));
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 for FREE plan', async () => {
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({
      workspaceId: 'ws1',
      workspace: { plan: 'FREE' },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: 'FREE' });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns normalized cached brief', async () => {
    (prisma.pipelineBrief.findUnique as jest.Mock).mockResolvedValue({
      recommendations: [{ rank: 1, leadName: 'Acme' }],
      stats: { totalActive: 3, hotLeads: 1, avgCloseProbability: 50, pipelineValue: 1000, conversionRate: 10, avgDealValue: 200, avgCycleDays: 5, totalConverted: 1, totalLost: 0, topLostReasons: [] },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recommendations).toHaveLength(1);
    expect(body.stats.totalActive).toBe(3);
    expect(body.id).toBeUndefined();
  });

  it('returns 503 when database is unavailable', async () => {
    (prisma.leadAnalysis.findMany as jest.Mock).mockRejectedValue(
      new (require('@prisma/client').Prisma.PrismaClientKnownRequestError)('db down', {
        code: 'P1001',
        clientVersion: 'test',
      }),
    );
    const res = await GET();
    expect(res.status).toBe(503);
  });
});
