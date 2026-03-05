const { GET, POST } = require('@/app/api/team/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { sendTeamInviteEmail } = require('@/lib/email');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceMember: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    workspaceInvitation: { findMany: jest.fn(), upsert: jest.fn() },
    auditLog: { groupBy: jest.fn() },
    leadAnalysis: { groupBy: jest.fn() },
  },
}));
jest.mock('@/lib/email', () => ({ sendTeamInviteEmail: jest.fn().mockResolvedValue({ sent: true }) }));

function req(options: { method: string; body?: object }) {
  return new Request('http://localhost/api/team', {
    method: options.method,
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

describe('GET /api/team', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET(req({ method: 'GET' }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 404 when no workspace', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await GET(req({ method: 'GET' }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toMatchObject({ error: 'No workspace found' });
  });

  it('returns 403 when plan is not SCALE', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({
      id: 'wm1',
      workspaceId: 'w1',
      role: 'OWNER',
      workspace: { id: 'w1', name: 'WS', plan: 'PRO', leadsUsed: 0, leadsLimit: 100 },
    });
    const res = await GET(req({ method: 'GET' }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json).toMatchObject({ error: 'Team management is only available on Scale plan.' });
  });

  it('returns 200 with members, workspace, pendingInvitations when SCALE', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({
      id: 'wm1',
      workspaceId: 'w1',
      role: 'OWNER',
      workspace: { id: 'w1', name: 'My WS', plan: 'SCALE', leadsUsed: 10, leadsLimit: 5000 },
    });
    (prisma.workspaceMember.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'wm1',
        role: 'OWNER',
        createdAt: new Date('2025-01-01'),
        dailyLeadsGoal: null,
        dailyAnalysesGoal: null,
        monthlyConversionsGoal: null,
        user: { id: 'u1', name: 'Alice', email: 'a@x.com', image: null, leadsUsed: 5 },
      },
    ]);
    (prisma.auditLog.groupBy as jest.Mock).mockResolvedValue([{ userId: 'u1', _count: { id: 3 } }]);
    (prisma.leadAnalysis.groupBy as jest.Mock).mockResolvedValue([{ userId: 'u1', _count: { id: 2 } }]);
    (prisma.workspaceInvitation.findMany as jest.Mock).mockResolvedValue([
      { id: 'inv1', email: 'b@x.com', createdAt: new Date(), lastSentAt: new Date() },
    ]);

    const res = await GET(req({ method: 'GET' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('members');
    expect(Array.isArray(json.members)).toBe(true);
    expect(json.members[0]).toMatchObject({ userId: 'u1', name: 'Alice', email: 'a@x.com', role: 'OWNER', leadsAnalyzed: 2, actionsLast30d: 3 });
    expect(json).toHaveProperty('workspace');
    expect(json.workspace).toMatchObject({ id: 'w1', name: 'My WS', plan: 'SCALE', leadsUsed: 10, leadsLimit: 5000 });
    expect(json).toHaveProperty('pendingInvitations');
    expect(Array.isArray(json.pendingInvitations)).toBe(true);
  });

  it('returns 500 when findFirst throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockRejectedValue(new Error('DB error'));
    const res = await GET(req({ method: 'GET' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toMatchObject({ error: 'Internal server error' });
  });
});

describe('POST /api/team', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await POST(req({ method: 'POST', body: { email: 'x@y.com' } }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 400 when email invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', name: 'Alice', email: 'a@x.com' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({
      id: 'wm1',
      workspaceId: 'w1',
      role: 'OWNER',
      workspace: { id: 'w1', name: 'WS', plan: 'SCALE', leadsUsed: 0, leadsLimit: 5000 },
    });
    const res = await POST(req({ method: 'POST', body: {} }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Email inválido' });
  });

  it('returns 403 when caller is not OWNER or ADMIN', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({
      id: 'wm1',
      workspaceId: 'w1',
      role: 'MEMBER',
      workspace: { id: 'w1', name: 'WS', plan: 'SCALE', leadsUsed: 0, leadsLimit: 5000 },
    });
    const res = await POST(req({ method: 'POST', body: { email: 'new@x.com' } }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Only admins can invite members' });
  });

  it('returns 403 when plan is not SCALE', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({
      id: 'wm1',
      workspaceId: 'w1',
      role: 'OWNER',
      workspace: { id: 'w1', name: 'WS', plan: 'PRO', leadsUsed: 0, leadsLimit: 400 },
    });
    const res = await POST(req({ method: 'POST', body: { email: 'new@x.com' } }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Team management requires Scale plan' });
  });

  it('returns 409 when user already member', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', name: 'Alice' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'wm1',
        workspaceId: 'w1',
        role: 'OWNER',
        workspace: { id: 'w1', name: 'WS', plan: 'SCALE', leadsUsed: 0, leadsLimit: 5000 },
      })
      .mockResolvedValueOnce({ id: 'wm2' });
    const res = await POST(req({ method: 'POST', body: { email: 'existing@x.com' } }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'Usuário já é membro do workspace' });
  });

  it('returns 200 and creates pending invitation and sends email', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', name: 'Alice', email: 'alice@x.com' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({
      id: 'wm1',
      workspaceId: 'w1',
      role: 'OWNER',
      workspace: { id: 'w1', name: 'My Workspace', plan: 'SCALE', leadsUsed: 0, leadsLimit: 5000 },
    });
    (prisma.workspaceMember.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'wm1',
        workspaceId: 'w1',
        role: 'OWNER',
        workspace: { id: 'w1', name: 'My Workspace', plan: 'SCALE', leadsUsed: 0, leadsLimit: 5000 },
      })
      .mockResolvedValueOnce(null);
    const createdInv = {
      id: 'inv1',
      email: 'new@x.com',
      createdAt: new Date(),
      lastSentAt: new Date(),
    };
    (prisma.workspaceInvitation.upsert as jest.Mock).mockResolvedValue(createdInv);

    const res = await POST(req({ method: 'POST', body: { email: 'new@x.com' } }));
    expect(res.status).toBe(200);
    expect(prisma.workspaceInvitation.upsert).toHaveBeenCalled();
    expect(sendTeamInviteEmail).toHaveBeenCalledWith(
      'new@x.com',
      'Alice',
      'My Workspace',
      expect.stringMatching(/\/accept-invite\?token=/)
    );
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.pendingInvite).toMatchObject({ id: 'inv1', email: 'new@x.com' });
  });

  it('returns 200 when invite created but email not sent (warn path)', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', name: 'Alice', email: 'alice@x.com' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'wm1',
        workspaceId: 'w1',
        role: 'OWNER',
        workspace: { id: 'w1', name: 'My Workspace', plan: 'SCALE', leadsUsed: 0, leadsLimit: 5000 },
      })
      .mockResolvedValueOnce(null);
    (prisma.workspaceInvitation.upsert as jest.Mock).mockResolvedValue({
      id: 'inv1',
      email: 'new@x.com',
      createdAt: new Date(),
      lastSentAt: new Date(),
    });
    (sendTeamInviteEmail as jest.Mock).mockResolvedValue({ sent: false, error: 'no config' });

    const res = await POST(req({ method: 'POST', body: { email: 'new@x.com' } }));
    expect(res.status).toBe(200);
    await new Promise((r) => setImmediate(r));
  });

  it('covers email send reject path with non-Error (catch branch)', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', name: 'Alice' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'wm1',
        workspaceId: 'w1',
        role: 'OWNER',
        workspace: { id: 'w1', name: 'WS', plan: 'SCALE', leadsUsed: 0, leadsLimit: 5000 },
      })
      .mockResolvedValueOnce(null);
    (prisma.workspaceInvitation.upsert as jest.Mock).mockResolvedValue({
      id: 'inv1',
      email: 'new@x.com',
      createdAt: new Date(),
      lastSentAt: new Date(),
    });
    (sendTeamInviteEmail as jest.Mock).mockRejectedValue('non-Error rejection');
    const res = await POST(req({ method: 'POST', body: { email: 'new@x.com' } }));
    expect(res.status).toBe(200);
    await new Promise((r) => setImmediate(r));
  });

  it('returns 500 when POST invite throws (e.g. upsert fails)', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', name: 'Alice' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'wm1',
        workspaceId: 'w1',
        role: 'OWNER',
        workspace: { id: 'w1', name: 'WS', plan: 'SCALE', leadsUsed: 0, leadsLimit: 5000 },
      })
      .mockResolvedValueOnce(null);
    (prisma.workspaceInvitation.upsert as jest.Mock).mockRejectedValue(new Error('DB error'));

    const res = await POST(req({ method: 'POST', body: { email: 'new@x.com' } }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal server error' });
  });
});
