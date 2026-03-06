const { GET } = require('@/app/api/support/users/route');
const { auth } = require('@/auth');
const { isSupport } = require('@/lib/admin');
const { prisma } = require('@/lib/prisma');
const { logSupportAction } = require('@/lib/audit');
const { NextRequest } = require('next/server');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isSupport: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logSupportAction: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

function req(url = 'http://localhost/api/support/users') {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/support/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 403 when not support', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(false);
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Forbidden' });
  });

  it('returns 400 when limit invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(true);
    const res = await GET(req('http://localhost/api/support/users?limit=999'));
    expect(res.status).toBe(400);
  });

  it('returns 200 with items and total', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(true);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: 'u1', name: 'U1', email: 'u1@x.com', plan: 'PRO', disabledAt: null, createdAt: new Date() },
    ]);
    (prisma.user.count as jest.Mock).mockResolvedValue(1);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.limit).toBeDefined();
    expect(data.offset).toBeDefined();
  });

  it('returns 500 when findMany throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(true);
    (prisma.user.findMany as jest.Mock).mockRejectedValue(new Error('db error'));
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal server error' });
  });
});
