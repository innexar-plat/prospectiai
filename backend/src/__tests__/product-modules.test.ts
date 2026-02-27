/**
 * Tests for GET /api/product/modules
 */
const { GET } = require('@/app/api/product/modules/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

describe('GET /api/product/modules', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 404 when user not found', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'User not found' });
  });

  it('returns 200 with plan, modules and catalog for FREE', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({
      plan: 'FREE',
      workspaces: [{ workspace: { plan: 'FREE' } }],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.plan).toBe('FREE');
    expect(Array.isArray(json.modules)).toBe(true);
    expect(Array.isArray(json.catalog)).toBe(true);
    expect(json.tagline).toBeDefined();
    expect(json.catalog.length).toBeGreaterThan(0);
    expect(json.catalog[0]).toHaveProperty('key');
    expect(json.catalog[0]).toHaveProperty('enabled');
  });

  it('returns 200 with workspace plan when present', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({
      plan: 'FREE',
      workspaces: [{ workspace: { plan: 'PRO' } }],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.plan).toBe('PRO');
  });
});
