const { GET, PATCH } = require('@/app/api/workspace/current/profile/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { rateLimit } = require('@/lib/ratelimit');
const { NextRequest } = require('next/server');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceMember: { findFirst: jest.fn() },
    workspace: { findUnique: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));

const profileData = {
  companyName: 'Acme',
  productService: null,
  targetAudience: null,
  mainBenefit: null,
  address: null,
  linkedInUrl: null,
  instagramUrl: null,
  facebookUrl: null,
  websiteUrl: null,
  logoUrl: null,
};

describe('GET /api/workspace/current/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/workspace/current/profile'));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 404 when no workspace membership', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/workspace/current/profile'));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Workspace not found' });
  });

  it('returns 200 with profile', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({ workspaceId: 'w1' });
    (prisma.workspace.findUnique as jest.Mock).mockResolvedValue({ id: 'w1', ...profileData });
    const res = await GET(new NextRequest('http://localhost/api/workspace/current/profile'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.companyName).toBe('Acme');
  });

  it('returns 404 when workspace not found after membership', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({ workspaceId: 'w1' });
    (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/workspace/current/profile'));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Workspace not found' });
  });

  it('returns 500 when findFirst throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockRejectedValue(new Error('db error'));
    const res = await GET(new NextRequest('http://localhost/api/workspace/current/profile'));
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/workspace/current/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (rateLimit as jest.Mock).mockResolvedValue({ success: true });
    (prisma.workspace.update as jest.Mock).mockResolvedValue({ id: 'w1', ...profileData });
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(
      new NextRequest('http://localhost/api/workspace/current/profile', {
        method: 'PATCH',
        body: JSON.stringify({ companyName: 'X' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limit exceeded', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (rateLimit as jest.Mock).mockResolvedValue({ success: false });
    const res = await PATCH(
      new NextRequest('http://localhost/api/workspace/current/profile', {
        method: 'PATCH',
        body: JSON.stringify({ companyName: 'X' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(429);
  });

  it('returns 400 when body invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({ workspaceId: 'w1' });
    const res = await PATCH(
      new NextRequest('http://localhost/api/workspace/current/profile', {
        method: 'PATCH',
        body: JSON.stringify({ companyName: 123 }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 and updates profile', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({ workspaceId: 'w1' });
    const res = await PATCH(
      new NextRequest('http://localhost/api/workspace/current/profile', {
        method: 'PATCH',
        body: JSON.stringify({ companyName: 'New Co', websiteUrl: 'https://x.com' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(200);
    expect(prisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w1' },
        data: expect.objectContaining({ companyName: 'New Co', websiteUrl: 'https://x.com' }),
      }),
    );
  });

  it('returns 500 when update throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({ workspaceId: 'w1' });
    (prisma.workspace.update as jest.Mock).mockRejectedValue(new Error('DB error'));
    const res = await PATCH(
      new NextRequest('http://localhost/api/workspace/current/profile', {
        method: 'PATCH',
        body: JSON.stringify({ companyName: 'X' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal server error' });
  });
});
