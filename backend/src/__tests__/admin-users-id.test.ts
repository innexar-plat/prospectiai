const { GET } = require('@/app/api/admin/users/[id]/route');
const { auth } = require('@/auth');
const { isAdmin } = require('@/lib/admin');
const { prisma } = require('@/lib/prisma');
const { NextRequest } = require('next/server');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn() }, auditLog: { create: jest.fn().mockResolvedValue({}) } } }));

describe('GET /api/admin/users/[id]', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({ id: 'u1' }) });
    expect(res.status).toBe(401);
  });
  it('returns 403 when not admin', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    isAdmin.mockReturnValue(false);
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(403);
  });
  it('returns 200 with user', async () => {
    auth.mockResolvedValue({ user: { id: 'a1' }, expires: '' });
    isAdmin.mockReturnValue(true);
    prisma.user.findUnique.mockResolvedValue({ id: 'u2', name: 'U2', email: 'u2@x.com', workspaces: [] });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe('u2');
  });
});
