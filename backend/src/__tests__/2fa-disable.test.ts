const { POST } = require('@/app/api/auth/2fa/disable/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { verifyTotpToken } = require('@/lib/twofa');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn(), update: jest.fn() } } }));
jest.mock('@/lib/twofa', () => ({ verifyTotpToken: jest.fn() }));

describe('POST /api/auth/2fa/disable', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ code: '123456' }) }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when 2FA not enabled', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', twoFactorSecret: null, twoFactorEnabled: false });
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ code: '123456' }) }));
    expect(res.status).toBe(400);
  });

  it('returns 200 and clears 2FA when code valid', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', twoFactorSecret: 'S', twoFactorEnabled: true });
    prisma.user.update.mockResolvedValue({});
    verifyTotpToken.mockReturnValue(true);
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ code: '123456' }) }));
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { twoFactorSecret: null, twoFactorEnabled: false },
    });
  });
});
