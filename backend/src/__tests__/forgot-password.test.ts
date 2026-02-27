const { POST } = require('@/app/api/auth/forgot-password/route');
const { prisma } = require('@/lib/prisma');
const { rateLimit } = require('@/lib/ratelimit');
const { sendPasswordResetEmail } = require('@/lib/email');

jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn(), update: jest.fn() } } }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));
jest.mock('@/lib/email', () => ({ sendPasswordResetEmail: jest.fn(() => Promise.resolve({ sent: false })) }));

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => { jest.clearAllMocks(); rateLimit.mockResolvedValue({ success: true }); });

  it('returns 429 when rate limit exceeded', async () => {
    rateLimit.mockResolvedValue({ success: false });
    const res = await POST(new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'u@x.com' }) }));
    expect(res.status).toBe(429);
  });

  it('returns 400 when email missing', async () => {
    const res = await POST(new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/email|required|expected string|invalid/i);
  });

  it('returns 200 when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'n@x.com' }) }));
    expect(res.status).toBe(200);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('returns 200 and updates user when email exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@x.com' });
    prisma.user.update.mockResolvedValue({});
    const res = await POST(new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'u@x.com' }) }));
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: expect.objectContaining({ resetToken: expect.any(String) }) });
  });

  it('calls sendPasswordResetEmail with user email and token after update', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@x.com' });
    prisma.user.update.mockResolvedValue({});
    sendPasswordResetEmail.mockResolvedValue({ sent: true });
    await POST(new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'u@x.com' }) }));
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('u@x.com', expect.any(String));
    const token = prisma.user.update.mock.calls[0][0].data.resetToken;
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('u@x.com', token);
  });
});
