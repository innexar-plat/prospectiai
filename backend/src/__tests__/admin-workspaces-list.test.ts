const { GET } = require('@/app/api/admin/workspaces/route');
const { auth } = require('@/auth');
const { isAdmin } = require('@/lib/admin');
const { prisma } = require('@/lib/prisma');
const { NextRequest } = require('next/server');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findMany: jest.fn(), count: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    usageEvent: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
  },
}));

describe('GET /api/admin/workspaces', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/admin/workspaces'));
    expect(res.status).toBe(401);
  });
  it('returns 403 when not admin', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    isAdmin.mockReturnValue(false);
    const res = await GET(new NextRequest('http://localhost/api/admin/workspaces'));
    expect(res.status).toBe(403);
  });
  it('returns 200 with items and total', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    isAdmin.mockReturnValue(true);
    prisma.workspace.findMany.mockResolvedValue([{ id: 'w1', name: 'WS1', _count: {} }]);
    prisma.workspace.count.mockResolvedValue(1);
    const res = await GET(new NextRequest('http://localhost/api/admin/workspaces'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.total).toBe(1);
  });
  it('returns 500 when findMany throws', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    isAdmin.mockReturnValue(true);
    prisma.workspace.findMany.mockRejectedValue(new Error('DB error'));
    const res = await GET(new NextRequest('http://localhost/api/admin/workspaces'));
    expect(res.status).toBe(500);
  });
});
