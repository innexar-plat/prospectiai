const { GET } = require('@/app/api/admin/leads/route');
const { auth } = require('@/auth');
const { isAdmin } = require('@/lib/admin');
const { prisma } = require('@/lib/prisma');
const { NextRequest } = require('next/server');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { leadAnalysis: { findMany: jest.fn(), count: jest.fn() }, auditLog: { create: jest.fn().mockResolvedValue({}) } } }));

describe('GET /api/admin/leads', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    expect((await GET(new NextRequest('http://localhost/api/admin/leads'))).status).toBe(401);
  });
  it('returns 403 when not admin', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    isAdmin.mockReturnValue(false);
    expect((await GET(new NextRequest('http://localhost/api/admin/leads'))).status).toBe(403);
  });
  it('returns 200 with items', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    isAdmin.mockReturnValue(true);
    prisma.leadAnalysis.findMany.mockResolvedValue([]);
    prisma.leadAnalysis.count.mockResolvedValue(0);
    const res = await GET(new NextRequest('http://localhost/api/admin/leads'));
    expect(res.status).toBe(200);
    expect((await res.json()).items).toEqual([]);
  });
  it('returns 500 when findMany throws', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    isAdmin.mockReturnValue(true);
    prisma.leadAnalysis.findMany.mockRejectedValue(new Error('DB error'));
    const res = await GET(new NextRequest('http://localhost/api/admin/leads'));
    expect(res.status).toBe(500);
  });
});
