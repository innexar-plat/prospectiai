const { GET } = require('@/app/api/auth/verify-email/route');
const { prisma } = require('@/lib/prisma');
const { NextRequest } = require('next/server');

jest.mock('@/lib/prisma', () => ({
  prisma: {
    verificationToken: { findUnique: jest.fn(), deleteMany: jest.fn() },
    user: { updateMany: jest.fn() },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  },
}));

describe('GET /api/auth/verify-email', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when token is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/auth/verify-email'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when token is invalid or expired', async () => {
    prisma.verificationToken.findUnique.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/auth/verify-email?token=bad'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid|expired/i);
  });

  it('returns 400 when token is expired', async () => {
    prisma.verificationToken.findUnique.mockResolvedValue({
      identifier: 'u@x.com',
      token: 'expired-token',
      expires: new Date(Date.now() - 1000),
    });
    const res = await GET(new NextRequest('http://localhost/api/auth/verify-email?token=expired-token'));
    expect(res.status).toBe(400);
  });

  it('returns 200 and updates user when token is valid', async () => {
    prisma.verificationToken.findUnique.mockResolvedValue({
      identifier: 'u@x.com',
      token: 'valid-token',
      expires: new Date(Date.now() + 3600000),
    });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.verificationToken.deleteMany.mockResolvedValue({ count: 1 });
    const res = await GET(new NextRequest('http://localhost/api/auth/verify-email?token=valid-token'));
    expect(res.status).toBe(200);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { email: 'u@x.com' },
      data: expect.objectContaining({ emailVerified: expect.any(Date) }),
    });
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: 'u@x.com', token: 'valid-token' },
    });
  });
});
