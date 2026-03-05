const { PUT } = require('@/app/api/team/role/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceMember: { findFirst: jest.fn(), update: jest.fn() },
  },
}));

function req(body: object) {
  return new Request('http://localhost/api/team/role', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/team/role', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await PUT(req({ memberId: 'wm1', role: 'MEMBER' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 400 when body invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const res = await PUT(req({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: 'Invalid input' });
  });

  it('returns 403 when caller is not OWNER or ADMIN', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'wm1', workspaceId: 'w1', role: 'MEMBER' });
    const res = await PUT(req({ memberId: 'wm2', role: 'MEMBER' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Only admins can change roles' });
  });

  it('returns 403 when ADMIN tries to assign ADMIN role', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 'wm1', workspaceId: 'w1', role: 'ADMIN' })
      .mockResolvedValueOnce({ id: 'wm2', workspaceId: 'w1', role: 'MEMBER' });
    const res = await PUT(req({ memberId: 'wm2', role: 'ADMIN' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Only the owner can assign ADMIN role' });
  });

  it('returns 404 when member not found in workspace', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const findFirst = prisma.workspaceMember.findFirst as jest.Mock;
    findFirst.mockReset();
    findFirst
      .mockResolvedValueOnce({ id: 'wm1', workspaceId: 'w1', role: 'OWNER' })
      .mockResolvedValueOnce(null);
    const res = await PUT(req({ memberId: 'wm-other', role: 'MEMBER' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Member not found in workspace' });
  });

  it('returns 400 when target is OWNER', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const findFirst = prisma.workspaceMember.findFirst as jest.Mock;
    findFirst.mockReset();
    findFirst
      .mockResolvedValueOnce({ id: 'wm1', workspaceId: 'w1', role: 'OWNER' })
      .mockResolvedValueOnce({ id: 'wm1', workspaceId: 'w1', role: 'OWNER' });
    const res = await PUT(req({ memberId: 'wm1', role: 'MEMBER' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Cannot change owner role' });
  });

  it('returns 200 and updates role when OWNER sets ADMIN', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const findFirst = prisma.workspaceMember.findFirst as jest.Mock;
    findFirst.mockReset();
    findFirst
      .mockResolvedValueOnce({ id: 'wm1', workspaceId: 'w1', role: 'OWNER' })
      .mockResolvedValueOnce({ id: 'wm2', workspaceId: 'w1', role: 'MEMBER' });
    (prisma.workspaceMember.update as jest.Mock).mockResolvedValue({});

    const res = await PUT(req({ memberId: 'wm2', role: 'ADMIN' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.role).toBe('ADMIN');
    expect(prisma.workspaceMember.update).toHaveBeenCalledWith({
      where: { id: 'wm2' },
      data: { role: 'ADMIN' },
    });
  });

  it('returns 500 when update throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const findFirst = prisma.workspaceMember.findFirst as jest.Mock;
    findFirst.mockReset();
    findFirst
      .mockResolvedValueOnce({ id: 'wm1', workspaceId: 'w1', role: 'OWNER' })
      .mockResolvedValueOnce({ id: 'wm2', workspaceId: 'w1', role: 'MEMBER' });
    (prisma.workspaceMember.update as jest.Mock).mockRejectedValue(new Error('DB error'));
    const res = await PUT(req({ memberId: 'wm2', role: 'MEMBER' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal server error' });
  });
});
