const { POST } = require('@/app/api/auth/reset-password/route');
const { prisma } = require('@/lib/prisma');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('@/lib/ratelimit');

jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findFirst: jest.fn(), update: jest.fn() } },
}));
jest.mock('bcryptjs', () => ({ hash: jest.fn(() => Promise.resolve('hashed')) }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => { jest.clearAllMocks(); rateLimit.mockResolvedValue({ success: true }); });

  it('returns 429 when rate limit exceeded', async () => {
    rateLimit.mockResolvedValue({ success: false });
    const res = await POST(new Request('http://localhost/api/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 't1', password: 'newpass123' }),
    }));
    expect(res.status).toBe(429);
  });

  it('returns 400 when token or password missing', async () => {
    const res = await POST(new Request('http://localhost/api/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 't1' }),
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/token|password|required|expected string|invalid/i);
  });

  it('returns 400 when token invalid or expired', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const res = await POST(new Request('http://localhost/api/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'bad', password: 'newpass123' }),
    }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Invalid or expired token' });
  });

  it('returns 200 and updates password when token valid', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({});
    const res = await POST(new Request('http://localhost/api/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'valid-token', password: 'newpass123' }),
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ message: 'Password updated successfully' });
    expect(bcrypt.hash).toHaveBeenCalledWith('newpass123', 10);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({
        password: 'hashed',
        resetToken: null,
        resetTokenExpires: null,
      }),
    });
  });
});
