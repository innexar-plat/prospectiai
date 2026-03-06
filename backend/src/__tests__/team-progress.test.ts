const { GET } = require('@/app/api/team/progress/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { getMemberUsage } = require('@/lib/team-credits');
const { NextRequest } = require('next/server');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/team-credits', () => ({ getMemberUsage: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceMember: { findFirst: jest.fn(), findMany: jest.fn() },
    searchHistory: { count: jest.fn(), groupBy: jest.fn() },
    leadAnalysis: { count: jest.fn() },
    auditLog: { count: jest.fn() },
  },
}));

function req() {
  return new NextRequest('http://localhost/api/team/progress', { method: 'GET' });
}

describe('GET /api/team/progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMemberUsage as jest.Mock).mockResolvedValue({ today: 0, week: 0, month: 0 });
    (prisma.searchHistory.count as jest.Mock).mockResolvedValue(0);
    (prisma.leadAnalysis.count as jest.Mock).mockResolvedValue(0);
    (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);
    (prisma.searchHistory.groupBy as jest.Mock).mockResolvedValue([]);
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 when no workspace membership', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('No workspace found');
  });

  it('returns 200 with progress, goals, limits and usage', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({
      id: 'wm1',
      workspaceId: 'w1',
      userId: 'u1',
      dailyLeadsGoal: 10,
      dailyAnalysesGoal: 5,
      monthlyConversionsGoal: 50,
      dailyLeadsLimit: 100,
      weeklyLeadsLimit: 500,
      monthlyLeadsLimit: 2000,
      workspace: {},
    });
    (prisma.workspaceMember.findMany as jest.Mock).mockResolvedValue([
      { userId: 'u1', user: { name: 'User One' } },
    ]);
    (prisma.searchHistory.groupBy as jest.Mock).mockResolvedValue([{ userId: 'u1', _count: { id: 3 } }]);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.goals).toEqual({
      dailyLeadsGoal: 10,
      dailyAnalysesGoal: 5,
      monthlyConversionsGoal: 50,
    });
    expect(data.limits).toEqual({
      dailyLeadsLimit: 100,
      weeklyLeadsLimit: 500,
      monthlyLeadsLimit: 2000,
    });
    expect(data.usage).toEqual({ today: 0, week: 0, month: 0 });
    expect(data.today).toBeDefined();
    expect(data.month).toBeDefined();
    expect(data.streak).toBeGreaterThanOrEqual(0);
    expect(data.ranking).toBeDefined();
  });

  it('returns 500 when findFirst throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockRejectedValue(new Error('db error'));
    const res = await GET(req());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal server error');
  });
});
