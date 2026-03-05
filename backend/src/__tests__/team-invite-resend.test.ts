const { POST } = require('@/app/api/team/invite/resend/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { sendTeamInviteEmail } = require('@/lib/email');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceInvitation: { findUnique: jest.fn(), update: jest.fn() },
    workspaceMember: { findFirst: jest.fn() },
  },
}));
jest.mock('@/lib/email', () => ({ sendTeamInviteEmail: jest.fn() }));

function req(body: object) {
  return new Request('http://localhost/api/team/invite/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/team/invite/resend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (sendTeamInviteEmail as jest.Mock).mockResolvedValue({ sent: true });
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await POST(req({ invitationId: 'inv1' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 400 when invitationId missing', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invitationId obrigatório' });
  });

  it('returns 404 when invitation not found', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceInvitation.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await POST(req({ invitationId: 'inv1' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Convite não encontrado ou já aceito' });
  });

  it('returns 404 when invitation status is not PENDING', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceInvitation.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv1',
      email: 'a@x.com',
      workspaceId: 'w1',
      status: 'ACCEPTED',
      workspace: { name: 'WS' },
      inviter: { name: 'Alice', email: 'alice@x.com' },
    });
    const res = await POST(req({ invitationId: 'inv1' }));
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not OWNER or ADMIN', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceInvitation.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv1',
      email: 'b@x.com',
      workspaceId: 'w1',
      status: 'PENDING',
      workspace: { name: 'WS' },
      inviter: { name: 'Alice', email: 'alice@x.com' },
    });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({ id: 'wm1', role: 'MEMBER' });
    const res = await POST(req({ invitationId: 'inv1' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Forbidden' });
  });

  it('returns 502 when sendTeamInviteEmail fails', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceInvitation.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv1',
      email: 'b@x.com',
      workspaceId: 'w1',
      status: 'PENDING',
      workspace: { name: 'WS' },
      inviter: { name: 'Alice', email: 'alice@x.com' },
    });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({ id: 'wm1', role: 'ADMIN' });
    (prisma.workspaceInvitation.update as jest.Mock).mockResolvedValue({});
    (sendTeamInviteEmail as jest.Mock).mockResolvedValue({ sent: false, error: 'SMTP error' });

    const res = await POST(req({ invitationId: 'inv1' }));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('returns 200 and updates lastSentAt when resend succeeds', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceInvitation.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv1',
      email: 'b@x.com',
      workspaceId: 'w1',
      status: 'PENDING',
      workspace: { name: 'My WS' },
      inviter: { name: 'Alice', email: 'alice@x.com' },
    });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({ id: 'wm1', role: 'OWNER' });
    (prisma.workspaceInvitation.update as jest.Mock).mockResolvedValue({});

    const res = await POST(req({ invitationId: 'inv1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.lastSentAt).toBeDefined();
    expect(prisma.workspaceInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv1' },
        data: expect.objectContaining({ token: expect.any(String), lastSentAt: expect.any(Date) }),
      })
    );
    expect(sendTeamInviteEmail).toHaveBeenCalledWith('b@x.com', 'Alice', 'My WS', expect.stringMatching(/\/accept-invite\?token=/));
  });

  it('returns 500 when findUnique or update throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceInvitation.findUnique as jest.Mock).mockRejectedValue(new Error('DB error'));
    const res = await POST(req({ invitationId: 'inv1' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal server error' });
  });
});
