const { PATCH } = require('@/app/api/support/users/[id]/activate/route');
const { auth } = require('@/auth');
const { isSupport } = require('@/lib/admin');
const { prisma } = require('@/lib/prisma');
const { NextRequest } = require('next/server');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isSupport: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logSupportAction: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

function req(id: string) {
  return new NextRequest(`http://localhost/api/support/users/${id}`, { method: 'PATCH' });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('PATCH /api/support/users/[id]/activate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.update as jest.Mock).mockResolvedValue({});
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(req('u1'), ctx('u1'));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 403 when not support', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(false);
    const res = await PATCH(req('u2'), ctx('u2'));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Forbidden' });
  });

  it('returns 404 when user not found', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(true);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(req('u2'), ctx('u2'));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'User not found' });
  });

  it('returns 400 when user already active', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(true);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u2', disabledAt: null });
    const res = await PATCH(req('u2'), ctx('u2'));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'User account is already active' });
  });

  it('returns 200 and clears disabledAt', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(true);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u2', disabledAt: new Date() });
    const res = await PATCH(req('u2'), ctx('u2'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: { disabledAt: null },
    });
  });
});
