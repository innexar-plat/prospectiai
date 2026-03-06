const { POST } = require('@/app/api/support/users/[id]/reset-password/route');
const { auth } = require('@/auth');
const { isSupport } = require('@/lib/admin');
const { prisma } = require('@/lib/prisma');
const { sendPasswordResetEmail } = require('@/lib/email');
const { NextRequest } = require('next/server');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isSupport: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logSupportAction: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/email', () => ({ sendPasswordResetEmail: jest.fn().mockResolvedValue({ sent: true }) }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

function req(id: string, body: object) {
  return new NextRequest(`http://localhost/api/support/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/support/users/[id]/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.update as jest.Mock).mockResolvedValue({});
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await POST(req('u1', { sendEmail: true }), ctx('u1'));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 403 when not support', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(false);
    const res = await POST(req('u2', { sendEmail: true }), ctx('u2'));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Forbidden' });
  });

  it('returns 400 when body is invalid JSON', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(true);
    const badReq = new NextRequest('http://localhost/api/support/users/u2/reset-password', {
      method: 'POST',
      body: 'not json',
    });
    const res = await POST(badReq, ctx('u2'));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Invalid JSON body' });
  });

  it('returns 400 when schema invalid (need sendEmail or temporaryPassword)', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(true);
    const res = await POST(req('u2', {}), ctx('u2'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(true);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await POST(req('u2', { sendEmail: true }), ctx('u2'));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'User not found' });
  });

  it('returns 400 when user has no email and sendEmail requested', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(true);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u2', email: null });
    const res = await POST(req('u2', { sendEmail: true }), ctx('u2'));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'User has no email' });
  });

  it('returns 200 with message when temporaryPassword set', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(true);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u2', email: 'u2@x.com' });
    const res = await POST(req('u2', { temporaryPassword: 'password123' }), ctx('u2'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBeDefined();
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('returns 200 when sendEmail true', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(true);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u2', email: 'u2@x.com' });
    const res = await POST(req('u2', { sendEmail: true }), ctx('u2'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBeDefined();
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('u2@x.com', expect.any(String));
  });
});
