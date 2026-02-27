const { POST } = require('@/app/api/auth/2fa/enable/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn(), update: jest.fn() } },
}));
jest.mock('@/lib/twofa', () => ({
  generateTotpSecret: jest.fn(() => ({ secret: 'MOCKSECRET', otpauthUrl: 'otpauth://totp/MOCK' })),
}));

describe('POST /api/auth/2fa/enable', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns 404 when user has no email', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: null, twoFactorEnabled: false });
    const res = await POST();
    expect(res.status).toBe(404);
  });

  it('returns 400 when 2FA already enabled', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@x.com', twoFactorEnabled: true });
    const res = await POST();
    expect(res.status).toBe(400);
  });

  it('returns 200 with secret and otpauthUrl', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@x.com', twoFactorEnabled: false });
    prisma.user.update.mockResolvedValue({});
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.secret).toBe('MOCKSECRET');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { twoFactorSecret: 'MOCKSECRET' } });
  });
});
