const { POST } = require('@/app/api/team/invite/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { sendTeamInviteEmail } = require('@/lib/email');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn(), create: jest.fn() }, workspaceMember: { create: jest.fn() } },
}));
jest.mock('@/lib/email', () => ({ sendTeamInviteEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/notification-service', () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }));

describe('POST /api/team/invite', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await POST(new Request('http://localhost/api/team/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@y.com' }),
    }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });
  it('returns 400 when email invalid', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({ workspaces: [{ workspaceId: 'w1', role: 'OWNER' }] });
    const res = await POST(new Request('http://localhost/api/team/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });
  it('returns 404 when no workspace', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({ workspaces: [] });
    const res = await POST(new Request('http://localhost/api/team/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@y.com' }),
    }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Workspace not found' });
  });
  it('returns 403 when not OWNER or ADMIN', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({ workspaces: [{ workspaceId: 'w1', role: 'MEMBER' }] });
    const res = await POST(new Request('http://localhost/api/team/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@y.com' }),
    }));
    expect(res.status).toBe(403);
  });
  it('returns 200 when invite succeeds', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique
      .mockResolvedValueOnce({ name: 'Alice', email: 'alice@x.com', workspaces: [{ workspaceId: 'w1', role: 'OWNER', workspace: { name: 'My Workspace' } }] })
      .mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValue({ id: 'u2', email: 'new@x.com', name: 'new', workspaces: [] });
    prisma.workspaceMember.create.mockResolvedValue({ id: 'wm1', userId: 'u2', user: { id: 'u2', name: 'new', email: 'new@x.com' } });
    const res = await POST(new Request('http://localhost/api/team/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@x.com' }),
    }));
    expect(res.status).toBe(200);
    expect(prisma.workspaceMember.create).toHaveBeenCalled();
    expect(sendTeamInviteEmail).toHaveBeenCalledWith('new@x.com', 'Alice', 'My Workspace');
  });
});
