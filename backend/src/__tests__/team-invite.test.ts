const { POST } = require('@/app/api/team/invite/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { sendTeamInviteEmail } = require('@/lib/email');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    workspaceMember: { findFirst: jest.fn() },
    workspaceInvitation: { upsert: jest.fn() },
  },
}));
jest.mock('@/lib/email', () => ({ sendTeamInviteEmail: jest.fn().mockResolvedValue({ sent: true }) }));

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
    prisma.user.findUnique.mockResolvedValue({ name: 'Alice', workspaces: [{ workspaceId: 'w1', role: 'OWNER', workspace: { name: 'WS' } }] });
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
    prisma.user.findUnique.mockResolvedValue({ workspaces: [{ workspaceId: 'w1', role: 'MEMBER', workspace: { name: 'WS' } }] });
    const res = await POST(new Request('http://localhost/api/team/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@y.com' }),
    }));
    expect(res.status).toBe(403);
  });
  it('returns 400 when user already in workspace', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({ name: 'Alice', workspaces: [{ workspaceId: 'w1', role: 'OWNER', workspace: { name: 'My Workspace' } }] });
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'wm1' });
    const res = await POST(new Request('http://localhost/api/team/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@x.com' }),
    }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'User is already in this workspace' });
  });
  it('returns 200 and creates pending invitation', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({
      name: 'Alice',
      email: 'alice@x.com',
      workspaces: [{ workspaceId: 'w1', role: 'OWNER', workspace: { name: 'My Workspace' } }],
    });
    prisma.workspaceMember.findFirst.mockResolvedValue(null);
    prisma.workspaceInvitation.upsert.mockResolvedValue({
      id: 'inv1',
      email: 'new@x.com',
      createdAt: new Date(),
      lastSentAt: new Date(),
    });
    const res = await POST(new Request('http://localhost/api/team/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@x.com' }),
    }));
    expect(res.status).toBe(200);
    expect(prisma.workspaceInvitation.upsert).toHaveBeenCalled();
    expect(sendTeamInviteEmail).toHaveBeenCalledWith(
      'new@x.com',
      'Alice',
      'My Workspace',
      expect.stringMatching(/\/accept-invite\?token=/)
    );
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.pendingInvite).toMatchObject({ email: 'new@x.com' });
  });
});
