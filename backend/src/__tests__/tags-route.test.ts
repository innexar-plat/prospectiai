const { GET, POST, DELETE } = require('@/app/api/tags/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { NextRequest } = require('next/server');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    leadTag: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
  },
}));

describe('GET /api/tags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/tags'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with all user tags when no leadId', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.leadTag.findMany as jest.Mock).mockResolvedValue([{ id: 't1', label: 'A' }]);
    const res = await GET(new NextRequest('http://localhost/api/tags'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tags).toHaveLength(1);
  });

  it('returns 200 with tags for leadId', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.leadTag.findMany as jest.Mock).mockResolvedValue([]);
    const res = await GET(new NextRequest('http://localhost/api/tags?leadId=lead1'));
    expect(res.status).toBe(200);
    expect(prisma.leadTag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', leadId: 'lead1' },
      }),
    );
  });

  it('returns 500 when findMany throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.leadTag.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));
    const res = await GET(new NextRequest('http://localhost/api/tags'));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal server error' });
  });
});

describe('POST /api/tags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.leadTag.upsert as jest.Mock).mockResolvedValue({ id: 't1', label: 'x', leadId: 'l1', color: 'gray' });
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await POST(
      new NextRequest('http://localhost/api/tags', {
        method: 'POST',
        body: JSON.stringify({ leadId: 'l1', label: 'x' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when body invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const res = await POST(
      new NextRequest('http://localhost/api/tags', {
        method: 'POST',
        body: JSON.stringify({ leadId: '', label: 'x' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 with tag', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const res = await POST(
      new NextRequest('http://localhost/api/tags', {
        method: 'POST',
        body: JSON.stringify({ leadId: 'l1', label: 'Important', color: 'blue' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tag).toBeDefined();
  });

  it('returns 500 when upsert throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.leadTag.upsert as jest.Mock).mockRejectedValue(new Error('DB error'));
    const res = await POST(
      new NextRequest('http://localhost/api/tags', {
        method: 'POST',
        body: JSON.stringify({ leadId: 'l1', label: 'x' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal server error' });
  });
});

describe('DELETE /api/tags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.leadTag.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await DELETE(new NextRequest('http://localhost/api/tags?id=t1', { method: 'DELETE' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when id missing', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const res = await DELETE(new NextRequest('http://localhost/api/tags', { method: 'DELETE' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Tag ID required' });
  });

  it('returns 200 when tag deleted', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const res = await DELETE(new NextRequest('http://localhost/api/tags?id=t1', { method: 'DELETE' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it('returns 500 when deleteMany throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.leadTag.deleteMany as jest.Mock).mockRejectedValue(new Error('db error'));
    const res = await DELETE(new NextRequest('http://localhost/api/tags?id=t1', { method: 'DELETE' }));
    expect(res.status).toBe(500);
  });
});
