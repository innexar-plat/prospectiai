const { GET } = require('@/app/api/admin/workspaces/[id]/route');
const { auth } = require('@/auth');
const { isAdmin } = require('@/lib/admin');
const { prisma } = require('@/lib/prisma');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findUnique: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    usageEvent: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
  },
}));

describe('GET /api/admin/workspaces/[id]', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await GET({}, { params: Promise.resolve({ id: 'ws1' }) });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 403 when not admin', async () => {
    auth.mockResolvedValue({ user: { id: 'u1', email: 'u@x.com' }, expires: '' });
    isAdmin.mockReturnValue(false);
    const res = await GET({}, { params: Promise.resolve({ id: 'ws1' }) });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Forbidden' });
  });

  it('returns 404 when workspace not found', async () => {
    auth.mockResolvedValue({ user: { id: 'u1', email: 'admin@x.com' }, expires: '' });
    isAdmin.mockReturnValue(true);
    prisma.workspace.findUnique.mockResolvedValue(null);
    const res = await GET({}, { params: Promise.resolve({ id: 'ws1' }) });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Workspace not found' });
  });

  it('returns 200 with workspace when admin', async () => {
    auth.mockResolvedValue({ user: { id: 'u1', email: 'admin@x.com' }, expires: '' });
    isAdmin.mockReturnValue(true);
    const workspace = {
      id: 'ws1',
      name: 'Test WS',
      plan: 'PRO',
      members: [],
      _count: { analyses: 5, searchHistory: 10 },
    };
    prisma.workspace.findUnique.mockResolvedValue(workspace);
    const res = await GET({}, { params: Promise.resolve({ id: 'ws1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('ws1');
    expect(json.name).toBe('Test WS');
    expect(json._count).toBeDefined();
  });
});
