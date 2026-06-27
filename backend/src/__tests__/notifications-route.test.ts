const { GET } = require('@/app/api/notifications/route');
const { PATCH } = require('@/app/api/notifications/[id]/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { NextRequest } = require('next/server');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

function listReq(query = '') {
  return new NextRequest(`http://localhost/api/notifications${query}`);
}

describe('GET /api/notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([
      { id: 'n1', title: 'Hello', message: 'World', type: 'info', link: null, readAt: null, createdAt: new Date() },
    ]);
    (prisma.notification.count as jest.Mock).mockResolvedValue(1);
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET(listReq());
    expect(res.status).toBe(401);
  });

  it('returns 401 when auth() throws', async () => {
    (auth as jest.Mock).mockRejectedValue(new Error('JWT invalid'));
    const res = await GET(listReq());
    expect(res.status).toBe(401);
  });

  it('returns items and unreadCount', async () => {
    const res = await GET(listReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.unreadCount).toBe(1);
    expect(json.limit).toBe(20);
  });

  it('clamps negative limit to 1', async () => {
    const res = await GET(listReq('?limit=-5'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.limit).toBe(1);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });

  it('clamps limit above 100 to 100', async () => {
    const res = await GET(listReq('?limit=500'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.limit).toBe(100);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('filters unreadOnly when requested', async () => {
    const res = await GET(listReq('?unreadOnly=true'));
    expect(res.status).toBe(200);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', readAt: null } }),
    );
  });

  it('returns 500 on database error', async () => {
    (prisma.notification.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));
    const res = await GET(listReq());
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/notifications/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
    (prisma.notification.findFirst as jest.Mock).mockResolvedValue({ id: 'n1', userId: 'u1' });
    (prisma.notification.update as jest.Mock).mockResolvedValue({
      id: 'n1',
      readAt: new Date('2026-01-01'),
      link: null,
    });
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(listReq(), { params: Promise.resolve({ id: 'n1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when notification not found', async () => {
    (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(listReq(), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
  });

  it('marks notification as read', async () => {
    const res = await PATCH(listReq(), { params: Promise.resolve({ id: 'n1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('n1');
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'n1' }, data: { readAt: expect.any(Date) } }),
    );
  });
});
