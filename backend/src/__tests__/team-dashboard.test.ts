const { GET } = require('@/app/api/team/dashboard/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceMember: { findFirst: jest.fn(), findMany: jest.fn() },
    searchHistory: { groupBy: jest.fn() },
    leadAnalysis: { groupBy: jest.fn() },
    auditLog: { groupBy: jest.fn() },
  },
}));

function req() {
  return new Request('http://localhost/api/team/dashboard', { method: 'GET' });
}

describe('GET /api/team/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 404 when no workspace', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'No workspace found' });
  });

  it('returns 403 when caller is not OWNER or ADMIN', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({
      id: 'wm1',
      workspaceId: 'w1',
      role: 'MEMBER',
      workspace: {},
    });
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Only admins can view team dashboard' });
  });

  it('returns 200 with members and totals when caller is ADMIN', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({
      id: 'wm1',
      workspaceId: 'w1',
      role: 'ADMIN',
      workspace: { id: 'w1' },
    });
    (prisma.workspaceMember.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'wm1',
        role: 'ADMIN',
        createdAt: new Date(),
        dailyLeadsGoal: 10,
        dailyAnalysesGoal: 5,
        monthlyConversionsGoal: 100,
        user: { id: 'u1', name: 'Alice', email: 'a@x.com', image: null },
      },
    ]);
    (prisma.searchHistory.groupBy as jest.Mock).mockResolvedValue([{ userId: 'u1', _count: { id: 2 } }]);
    (prisma.leadAnalysis.groupBy as jest.Mock).mockResolvedValue([{ userId: 'u1', _count: { id: 1 } }]);
    (prisma.auditLog.groupBy as jest.Mock).mockResolvedValue([{ userId: 'u1', _count: { id: 10 } }]);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('members');
    expect(Array.isArray(json.members)).toBe(true);
    expect(json.members[0]).toMatchObject({
      memberId: 'wm1',
      userId: 'u1',
      name: 'Alice',
      email: 'a@x.com',
      role: 'ADMIN',
      goals: { dailyLeadsGoal: 10, dailyAnalysesGoal: 5, monthlyConversionsGoal: 100 },
      today: { leads: 2, analyses: 1 },
      month: { leads: 2, analyses: 1, actions: 10 },
    });
    expect(json).toHaveProperty('totals');
    expect(json.totals).toMatchObject({
      todayLeads: 2,
      todayAnalyses: 1,
      monthLeads: 2,
      monthAnalyses: 1,
      monthActions: 10,
      membersCount: 1,
    });
  });
});
