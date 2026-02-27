const { GET } = require('@/app/api/admin/audit-logs/route');
const { auth } = require('@/auth');
const { isAdmin } = require('@/lib/admin');
const { prisma } = require('@/lib/prisma');
const { NextRequest } = require('next/server');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

describe('GET /api/admin/audit-logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/admin/audit-logs'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    isAdmin.mockReturnValue(false);
    const res = await GET(new NextRequest('http://localhost/api/admin/audit-logs'));
    expect(res.status).toBe(403);
  });

  it('returns 200 with items and pagination', async () => {
    auth.mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
    isAdmin.mockReturnValue(true);
    const mockItems = [
      {
        id: 'a1',
        userId: 'u1',
        adminEmail: 'admin@test.com',
        action: 'admin.stats',
        resource: null,
        resourceId: null,
        details: { users: 10 },
        createdAt: new Date('2025-01-01T00:00:00Z'),
      },
    ];
    prisma.auditLog.findMany.mockResolvedValue(mockItems);
    prisma.auditLog.count.mockResolvedValue(1);

    const res = await GET(new NextRequest('http://localhost/api/admin/audit-logs'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: 'a1',
      userId: 'u1',
      adminEmail: 'admin@test.com',
      action: 'admin.stats',
      resource: null,
      resourceId: null,
      details: { users: 10 },
    });
    expect(body.items[0].createdAt).toBeDefined();
    expect(body.total).toBe(1);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
  });

  it('respects limit and offset query params', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    isAdmin.mockReturnValue(true);
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(100);

    const res = await GET(
      new NextRequest('http://localhost/api/admin/audit-logs?limit=10&offset=20')
    );
    expect(res.status).toBe(200);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 })
    );
    const body = await res.json();
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(20);
  });

  it('returns 500 when findMany throws', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    isAdmin.mockReturnValue(true);
    prisma.auditLog.findMany.mockRejectedValue(new Error('DB error'));

    const res = await GET(new NextRequest('http://localhost/api/admin/audit-logs'));
    expect(res.status).toBe(500);
  });
});
