const { GET } = require('@/app/api/support/users/[id]/route');
const { auth } = require('@/auth');
const { isSupport } = require('@/lib/admin');
const { prisma } = require('@/lib/prisma');
const { NextRequest } = require('next/server');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isSupport: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logSupportAction: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}));

function req(id: string) {
  return new NextRequest(`http://localhost/api/support/users/${id}`, { method: 'GET' });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/support/users/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET(req('u1'), ctx('u1'));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 403 when not support', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(false);
    const res = await GET(req('u2'), ctx('u2'));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Forbidden' });
  });

  it('returns 404 when user not found', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(true);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await GET(req('u2'), ctx('u2'));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'User not found' });
  });

  it('returns 200 with user and workspaces', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (isSupport as jest.Mock).mockReturnValue(true);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u2',
      name: 'U2',
      email: 'u2@x.com',
      plan: 'PRO',
      disabledAt: null,
      createdAt: new Date(),
      companyName: null,
      productService: null,
      targetAudience: null,
      mainBenefit: null,
      onboardingCompletedAt: null,
      workspaces: [{ workspace: { id: 'w1', name: 'W1' } }],
    });
    const res = await GET(req('u2'), ctx('u2'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('u2');
    expect(data.workspaces).toEqual([{ id: 'w1', name: 'W1' }]);
  });
});
