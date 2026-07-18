jest.mock('next-auth', () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = 'credentials';
    constructor(message?: string) {
      super(message);
      this.name = 'CredentialsSignin';
    }
  },
}));
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn() }));
jest.mock('@/lib/twofa', () => ({ verifyTotpToken: jest.fn() }));
jest.mock('bcryptjs', () => ({ compare: jest.fn() }));

const { authorizeCredentials, TwoFactorRequiredError, TwoFactorInvalidError } = require('@/lib/credentials-authorize');
const { prisma } = require('@/lib/prisma');
const { rateLimit } = require('@/lib/ratelimit');
const { verifyTotpToken } = require('@/lib/twofa');
const bcrypt = require('bcryptjs');

const baseUser = {
  id: 'u1',
  email: 'user@example.com',
  password: 'hashed',
  disabledAt: null,
  twoFactorEnabled: false,
  twoFactorSecret: null,
};

describe('authorizeCredentials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rateLimit.mockResolvedValue({ success: true, remaining: 9, reset: 0 });
    bcrypt.compare.mockResolvedValue(true);
  });

  it('returns null for non-string email/password', async () => {
    const result = await authorizeCredentials(undefined, 'x', undefined, '1.2.3.4');
    expect(result).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('throws when rate limited', async () => {
    rateLimit.mockResolvedValue({ success: false, remaining: 0, reset: 0 });
    await expect(authorizeCredentials('user@example.com', 'pw', undefined, '1.2.3.4')).rejects.toThrow();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns null when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const result = await authorizeCredentials('nobody@example.com', 'pw', undefined, '1.2.3.4');
    expect(result).toBeNull();
  });

  it('returns null on wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);
    bcrypt.compare.mockResolvedValue(false);
    const result = await authorizeCredentials('user@example.com', 'wrong', undefined, '1.2.3.4');
    expect(result).toBeNull();
  });

  it('throws on disabled account', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, disabledAt: new Date() });
    await expect(authorizeCredentials('user@example.com', 'pw', undefined, '1.2.3.4')).rejects.toThrow();
  });

  it('logs in normally when 2FA is not enabled', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);
    const result = await authorizeCredentials('user@example.com', 'pw', undefined, '1.2.3.4');
    expect(result).toEqual(baseUser);
  });

  it('requires a 2FA code when twoFactorEnabled is true and none was sent', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, twoFactorEnabled: true, twoFactorSecret: 'SECRET' });
    await expect(authorizeCredentials('user@example.com', 'pw', undefined, '1.2.3.4'))
      .rejects.toThrow(TwoFactorRequiredError);
  });

  it('rejects an invalid 2FA code', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, twoFactorEnabled: true, twoFactorSecret: 'SECRET' });
    verifyTotpToken.mockReturnValue(false);
    await expect(authorizeCredentials('user@example.com', 'pw', '000000', '1.2.3.4'))
      .rejects.toThrow(TwoFactorInvalidError);
  });

  it('logs in with a valid 2FA code', async () => {
    const user = { ...baseUser, twoFactorEnabled: true, twoFactorSecret: 'SECRET' };
    prisma.user.findUnique.mockResolvedValue(user);
    verifyTotpToken.mockReturnValue(true);
    const result = await authorizeCredentials('user@example.com', 'pw', '123456', '1.2.3.4');
    expect(result).toEqual(user);
    expect(verifyTotpToken).toHaveBeenCalledWith('SECRET', '123456');
  });

  it('rate-limits per ip+email combination', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);
    await authorizeCredentials('user@example.com', 'pw', undefined, '9.9.9.9');
    expect(rateLimit).toHaveBeenCalledWith('login:9.9.9.9:user@example.com', 10, 300);
  });
});
