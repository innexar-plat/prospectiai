const { GET } = require('@/app/api/team/members/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() }, workspaceMember: { findMany: jest.fn() } },
}));

describe('GET /api/team/members', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });
  it('returns 404 when no workspace', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({ workspaces: [] });
    const res = await GET();
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Workspace not found' });
  });
  it('returns 200 with members', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({ workspaces: [{ workspaceId: 'w1' }] });
    prisma.workspaceMember.findMany.mockResolvedValue([
      { id: 'wm1', role: 'OWNER', user: { id: 'u1', name: 'O', email: 'o@x.com' } },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json[0].user.email).toBe('o@x.com');
  });
  it('returns 500 when findMany throws', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({ workspaces: [{ workspaceId: 'w1' }] });
    prisma.workspaceMember.findMany.mockRejectedValue(new Error('DB error'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
