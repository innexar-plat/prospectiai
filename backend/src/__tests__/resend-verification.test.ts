const { POST } = require('@/app/api/auth/resend-verification/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { sendVerificationEmail } = require('@/lib/email');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    verificationToken: { findFirst: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
  },
}));
jest.mock('@/lib/email', () => ({ sendVerificationEmail: jest.fn() }));

function req(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/auth/resend-verification', { method: 'POST', headers });
}

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an English error when unauthenticated on the US host with x-locale: en', async () => {
    auth.mockResolvedValue(null);
    const res = await POST(req({ 'x-locale': 'en' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized.');
  });

  it('returns a Portuguese error when unauthenticated with no locale hint (BR default)', async () => {
    auth.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Não autorizado.');
  });

  it('returns a localized "already verified" message', async () => {
    auth.mockResolvedValue({ user: { email: 'u@x.com' } });
    prisma.user.findUnique.mockResolvedValue({ emailVerified: new Date() });
    const res = await POST(req({ 'x-locale': 'en' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Email already verified.');
  });

  it('returns a localized cooldown message with the remaining seconds interpolated', async () => {
    auth.mockResolvedValue({ user: { email: 'u@x.com' } });
    prisma.user.findUnique.mockResolvedValue({ emailVerified: null });
    prisma.verificationToken.findFirst.mockResolvedValue({
      expires: new Date(Date.now() + 86400000 - 5000), // created 5s ago
    });
    const res = await POST(req({ 'x-locale': 'en' }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/^Wait \d+ seconds before resending\.$/);
  });

  it('returns a localized send-failure message', async () => {
    auth.mockResolvedValue({ user: { email: 'u@x.com' } });
    prisma.user.findUnique.mockResolvedValue({ emailVerified: null });
    prisma.verificationToken.findFirst.mockResolvedValue(null);
    sendVerificationEmail.mockResolvedValue({ sent: false, error: 'smtp down' });
    const res = await POST(req({ 'x-locale': 'en' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to send email. Try again.');
  });

  it('succeeds and sends the verification email in the requested locale', async () => {
    auth.mockResolvedValue({ user: { email: 'u@x.com' } });
    prisma.user.findUnique.mockResolvedValue({ emailVerified: null });
    prisma.verificationToken.findFirst.mockResolvedValue(null);
    sendVerificationEmail.mockResolvedValue({ sent: true });
    const res = await POST(req({ 'x-locale': 'en' }));
    expect(res.status).toBe(200);
    expect(sendVerificationEmail).toHaveBeenCalledWith('u@x.com', expect.any(String), 'en', expect.any(String));
  });
});
