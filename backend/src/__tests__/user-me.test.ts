/**
 * Tests for GET /api/user/me
 */
const { GET } = require('@/app/api/user/me/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { applyGracePeriodExpiryIfNeeded } = require('@/lib/grace-period');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/grace-period', () => ({ applyGracePeriodExpiryIfNeeded: jest.fn(() => Promise.resolve()) }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    workspace: { findUnique: jest.fn() },
    workspaceMember: { findFirst: jest.fn() },
  },
}));

const baseWorkspace = {
  plan: 'FREE',
  leadsUsed: 0,
  leadsLimit: 10,
  subscriptionStatus: null,
  currentPeriodEnd: null,
  gracePeriodEnd: null,
  companyName: null,
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

describe('GET /api/user/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    applyGracePeriodExpiryIfNeeded.mockResolvedValue(undefined);
  });

  it('returns 200 with null user when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/api/user/me'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user).toBeNull();
  });

  it('returns 404 when user not found', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/api/user/me'));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'User not found' });
  });

  it('returns 200 with user and requiresOnboarding true when no onboardingCompletedAt', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const userWithWorkspace = {
      id: 'u1',
      name: 'Test',
      email: 'test@example.com',
      image: null,
      plan: 'FREE',
      leadsUsed: 0,
      leadsLimit: 10,
      companyName: null,
      productService: null,
      targetAudience: null,
      mainBenefit: null,
      phone: null,
      address: null,
      linkedInUrl: null,
      instagramUrl: null,
      facebookUrl: null,
      websiteUrl: null,
      onboardingCompletedAt: null,
      notifyByEmail: true,
      notifyWeeklyReport: false,
      notifyLeadAlerts: false,
      workspaces: [{ workspace: { id: 'w1', ...baseWorkspace } }],
    };
    prisma.user.findUnique.mockResolvedValue(userWithWorkspace);
    prisma.workspace.findUnique.mockResolvedValue({ id: 'w1', ...baseWorkspace });
    const res = await GET(new Request('http://localhost/api/user/me'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user).toBeDefined();
    expect(json.user.id).toBe('u1');
    expect(json.user.requiresOnboarding).toBe(true);
    expect(json.user.workspaces).toBeUndefined();
    expect(json.workspaceProfile).toBeDefined();
  });

  it('returns 200 with workspace plan when user has workspace', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const workspaceData = { id: 'w1', ...baseWorkspace, plan: 'PRO', leadsUsed: 5, leadsLimit: 100 };
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      name: 'Test',
      email: 'test@example.com',
      image: null,
      plan: 'FREE',
      leadsUsed: 0,
      leadsLimit: 10,
      companyName: 'Acme',
      productService: null,
      targetAudience: null,
      mainBenefit: null,
      phone: null,
      address: null,
      linkedInUrl: null,
      instagramUrl: null,
      facebookUrl: null,
      websiteUrl: null,
      onboardingCompletedAt: new Date(),
      notifyByEmail: true,
      notifyWeeklyReport: false,
      notifyLeadAlerts: false,
      workspaces: [{ workspace: workspaceData }],
    });
    prisma.workspace.findUnique.mockResolvedValue(workspaceData);
    const res = await GET(new Request('http://localhost/api/user/me'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.plan).toBe('PRO');
    expect(json.user.leadsUsed).toBe(5);
    expect(json.user.leadsLimit).toBe(100);
    expect(json.user.requiresOnboarding).toBe(false);
  });
});
