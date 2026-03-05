const { POST } = require('@/app/api/team/invite/accept/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceInvitation: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
    workspaceMember: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((fn) => (Array.isArray(fn) ? Promise.all(fn.map((p) => p)) : fn(prisma))),
  },
}));

const mockPrisma = require('@/lib/prisma').prisma;

function req(body: object) {
  return new Request('http://localhost/api/team/invite/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/team/invite/accept', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.$transaction as jest.Mock).mockImplementation((arg) => {
      if (Array.isArray(arg)) return Promise.all(arg.map((p: Promise<unknown>) => p));
      return arg(mockPrisma);
    });
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await POST(req({ token: 't1' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Faça login para aceitar o convite' });
  });

  it('returns 401 when session has no email', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const res = await POST(req({ token: 't1' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Faça login para aceitar o convite' });
  });

  it('returns 400 when token missing or invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'a@x.com' }, expires: '' });
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Token inválido' });
  });

  it('returns 400 when body is invalid JSON (catch returns {})', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'a@x.com' }, expires: '' });
    const badReq = new Request('http://localhost/api/team/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Token inválido' });
  });

  it('returns 404 when invitation not found or not PENDING', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'a@x.com' }, expires: '' });
    (mockPrisma.workspaceInvitation.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await POST(req({ token: 't1' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Convite não encontrado ou já utilizado' });
  });

  it('returns 404 when invitation status is not PENDING', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'a@x.com' }, expires: '' });
    (mockPrisma.workspaceInvitation.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv1',
      email: 'a@x.com',
      workspaceId: 'w1',
      status: 'ACCEPTED',
      workspace: {},
    });
    const res = await POST(req({ token: 't1' }));
    expect(res.status).toBe(404);
  });

  it('returns 403 when session email does not match invite email', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'other@x.com' }, expires: '' });
    (mockPrisma.workspaceInvitation.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv1',
      email: 'invited@x.com',
      workspaceId: 'w1',
      status: 'PENDING',
      workspace: {},
    });
    const res = await POST(req({ token: 't1' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Use a conta com o email que recebeu o convite para aceitar' });
  });

  it('returns 404 when user not found', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'a@x.com' }, expires: '' });
    (mockPrisma.workspaceInvitation.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv1',
      email: 'a@x.com',
      workspaceId: 'w1',
      status: 'PENDING',
      workspace: {},
    });
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await POST(req({ token: 't1' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'User not found' });
  });

  it('returns 200 with alreadyMember true when user already in workspace', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'a@x.com' }, expires: '' });
    (mockPrisma.workspaceInvitation.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv1',
      email: 'a@x.com',
      workspaceId: 'w1',
      status: 'PENDING',
      workspace: {},
    });
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });
    (mockPrisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue({ id: 'wm1' });
    (mockPrisma.workspaceInvitation.update as jest.Mock).mockResolvedValue({});

    const res = await POST(req({ token: 't1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.alreadyMember).toBe(true);
    expect(mockPrisma.workspaceInvitation.update).toHaveBeenCalledWith({
      where: { id: 'inv1' },
      data: { status: 'ACCEPTED' },
    });
  });

  it('returns 200 and creates member when new user accepts', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'a@x.com' }, expires: '' });
    (mockPrisma.workspaceInvitation.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv1',
      email: 'a@x.com',
      workspaceId: 'w1',
      status: 'PENDING',
      workspace: {},
    });
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });
    (mockPrisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.workspaceMember.create as jest.Mock).mockResolvedValue({ id: 'wm1' });
    (mockPrisma.workspaceInvitation.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.$transaction as jest.Mock).mockImplementation((arg) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg(mockPrisma);
    });

    const res = await POST(req({ token: 't1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.alreadyMember).toBeUndefined();
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('returns 500 when transaction throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'a@x.com' }, expires: '' });
    (mockPrisma.workspaceInvitation.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv1',
      email: 'a@x.com',
      workspaceId: 'w1',
      status: 'PENDING',
      workspace: {},
    });
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });
    (mockPrisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.$transaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

    const res = await POST(req({ token: 't1' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal server error' });
  });

  it('returns 500 when transaction throws non-Error (catch branch)', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'a@x.com' }, expires: '' });
    (mockPrisma.workspaceInvitation.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv1',
      email: 'a@x.com',
      workspaceId: 'w1',
      status: 'PENDING',
      workspace: {},
    });
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });
    (mockPrisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.$transaction as jest.Mock).mockRejectedValue('string error');

    const res = await POST(req({ token: 't1' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal server error' });
  });
});
