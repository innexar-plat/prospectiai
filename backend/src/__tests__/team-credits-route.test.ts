const { PUT } = require('@/app/api/team/credits/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceMember: { findFirst: jest.fn(), update: jest.fn() },
  },
}));

function req(body: object) {
  return new Request('http://localhost/api/team/credits', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/team/credits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await PUT(req({ memberId: 'wm1', dailyLeadsLimit: 10 }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 400 when body invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const res = await PUT(req({ memberId: 'wm1', dailyLeadsLimit: -1 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: 'Invalid input' });
  });

  it('returns 400 when body is invalid JSON', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const invalidReq = new Request('http://localhost/api/team/credits', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await PUT(invalidReq);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: 'Invalid input' });
  });

  it('returns 403 when caller is not OWNER or ADMIN', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({
      id: 'wm1',
      workspaceId: 'w1',
      role: 'MEMBER',
    });
    const res = await PUT(req({ memberId: 'wm2', dailyLeadsLimit: 10 }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Only admins can set credit limits' });
  });

  it('returns 404 when member not in workspace', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 'wm1', workspaceId: 'w1', role: 'OWNER' })
      .mockResolvedValueOnce(null);
    const res = await PUT(req({ memberId: 'wm-other', dailyLeadsLimit: 10 }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Member not found in workspace' });
  });

  it('returns 200 and updates credit limits', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 'wm1', workspaceId: 'w1', role: 'OWNER' })
      .mockResolvedValueOnce({ id: 'wm2', workspaceId: 'w1', role: 'MEMBER' });
    (prisma.workspaceMember.update as jest.Mock).mockResolvedValue({
      id: 'wm2',
      dailyLeadsLimit: 50,
      weeklyLeadsLimit: 200,
      monthlyLeadsLimit: 500,
      user: { name: 'Bob', email: 'b@x.com' },
    });

    const res = await PUT(
      req({
        memberId: 'wm2',
        dailyLeadsLimit: 50,
        weeklyLeadsLimit: 200,
        monthlyLeadsLimit: 500,
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.member).toMatchObject({
      id: 'wm2',
      dailyLeadsLimit: 50,
      weeklyLeadsLimit: 200,
      monthlyLeadsLimit: 500,
    });
  });

  it('accepts null limits (clear limit)', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 'wm1', workspaceId: 'w1', role: 'ADMIN' })
      .mockResolvedValueOnce({ id: 'wm2', workspaceId: 'w1', role: 'MEMBER' });
    (prisma.workspaceMember.update as jest.Mock).mockResolvedValue({
      id: 'wm2',
      dailyLeadsLimit: null,
      weeklyLeadsLimit: null,
      monthlyLeadsLimit: null,
      user: { name: 'Bob', email: 'b@x.com' },
    });

    const res = await PUT(
      req({ memberId: 'wm2', dailyLeadsLimit: null, weeklyLeadsLimit: null, monthlyLeadsLimit: null }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('returns 500 when update throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 'wm1', workspaceId: 'w1', role: 'OWNER' })
      .mockResolvedValueOnce({ id: 'wm2', workspaceId: 'w1', role: 'MEMBER' });
    (prisma.workspaceMember.update as jest.Mock).mockRejectedValue(new Error('DB error'));

    const res = await PUT(req({ memberId: 'wm2', dailyLeadsLimit: 10 }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal server error' });
  });
});
