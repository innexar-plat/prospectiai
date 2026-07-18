const { checkTokenRevocation } = require('@/lib/session-revocation');
const { prisma } = require('@/lib/prisma');

jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

describe('checkTokenRevocation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('revokes when the user no longer exists (deleted account)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const result = await checkTokenRevocation('u1', 3, false);
    expect(result).toEqual({ revoked: true });
  });

  it('revokes when the account is disabled', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'u@x.com', tokenVersion: 1, disabledAt: new Date() });
    const result = await checkTokenRevocation('u1', 1, false);
    expect(result).toEqual({ revoked: true });
  });

  it('revokes on a stale tokenVersion (force-logout / password change happened elsewhere)', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'u@x.com', tokenVersion: 2, disabledAt: null });
    const result = await checkTokenRevocation('u1', 1, false);
    expect(result).toEqual({ revoked: true });
  });

  it('does not revoke a fresh login even with no prior tokenVersion', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'u@x.com', tokenVersion: 5, disabledAt: null });
    const result = await checkTokenRevocation('u1', undefined, true);
    expect(result).toEqual({ revoked: false, email: 'u@x.com', tokenVersion: 5 });
  });

  it('does not revoke when tokenVersion matches', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'u@x.com', tokenVersion: 4, disabledAt: null });
    const result = await checkTokenRevocation('u1', 4, false);
    expect(result).toEqual({ revoked: false, email: 'u@x.com', tokenVersion: 4 });
  });

  it('does not revoke on the very first jwt() pass for a fresh login (no tokenVersion baked in yet)', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'u@x.com', tokenVersion: 0, disabledAt: null });
    const result = await checkTokenRevocation('u1', undefined, false);
    expect(result).toEqual({ revoked: false, email: 'u@x.com', tokenVersion: 0 });
  });
});
