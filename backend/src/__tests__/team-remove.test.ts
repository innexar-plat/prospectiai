const { DELETE } = require('@/app/api/team/remove/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn() }, workspaceMember: { deleteMany: jest.fn() } } }));

describe('DELETE /api/team/remove', () => {
  const body = (id) => new Request('http://x', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIdToRemove: id }) });
  beforeEach(() => { jest.clearAllMocks(); });
  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    expect((await DELETE(body('u2'))).status).toBe(401);
  });
  it('returns 400 when userIdToRemove missing', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const res = await DELETE(new Request('http://x', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
  });
  it('returns 400 when removing self', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    expect((await DELETE(body('u1'))).status).toBe(400);
  });
  it('returns 404 when no workspace', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({ workspaces: [] });
    expect((await DELETE(body('u2'))).status).toBe(404);
  });
  it('returns 403 when not OWNER or ADMIN', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({ workspaces: [{ workspaceId: 'w1', role: 'MEMBER' }] });
    expect((await DELETE(body('u2'))).status).toBe(403);
  });
  it('returns 200 when member removed', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({ workspaces: [{ workspaceId: 'w1', role: 'OWNER' }] });
    prisma.workspaceMember.deleteMany.mockResolvedValue({ count: 1 });
    const res = await DELETE(body('u2'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, removedUserId: 'u2' });
  });
  it('returns 500 when deleteMany throws', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({ workspaces: [{ workspaceId: 'w1', role: 'OWNER' }] });
    prisma.workspaceMember.deleteMany.mockRejectedValue(new Error('DB error'));
    const res = await DELETE(body('u2'));
    expect(res.status).toBe(500);
  });
});
