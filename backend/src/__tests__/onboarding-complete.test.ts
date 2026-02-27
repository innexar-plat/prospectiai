/**
 * Tests for POST /api/onboarding/complete
 */
const { POST } = require('@/app/api/onboarding/complete/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { update: jest.fn(), findUnique: jest.fn() },
    workspace: { update: jest.fn() },
    workspaceMember: { findFirst: jest.fn() },
  },
}));

describe('POST /api/onboarding/complete', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await POST(new Request('http://localhost/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: 'Acme' }),
    }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 400 when body fails validation', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const long = Array(501).fill('x').join('');
    const res = await POST(new Request('http://localhost/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: long }),
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('returns 200 and updates user when body is valid', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const completedAt = new Date('2025-01-15T12:00:00Z');
    prisma.workspaceMember.findFirst.mockResolvedValue({ workspaceId: 'w1' });
    prisma.user.update.mockResolvedValue({ id: 'u1', onboardingCompletedAt: completedAt });
    prisma.workspace.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({ onboardingCompletedAt: completedAt });
    const res = await POST(new Request('http://localhost/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Acme',
        productService: 'Software',
        targetAudience: 'SMBs',
        mainBenefit: 'Speed',
      }),
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe('Onboarding completed');
    expect(json.onboardingCompletedAt).toBeDefined();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { onboardingCompletedAt: expect.any(Date) },
    });
    expect(prisma.workspace.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: expect.objectContaining({
        companyName: 'Acme',
        productService: 'Software',
        targetAudience: 'SMBs',
        mainBenefit: 'Speed',
      }),
    });
  });

  it('returns 200 with empty body', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.workspaceMember.findFirst.mockResolvedValue({ workspaceId: 'w1' });
    prisma.user.update.mockResolvedValue({ id: 'u1', onboardingCompletedAt: new Date() });
    prisma.workspace.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({ onboardingCompletedAt: new Date() });
    const res = await POST(new Request('http://localhost/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { onboardingCompletedAt: expect.any(Date) },
    });
  });

  it('returns 500 when prisma.user.update throws', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.workspaceMember.findFirst.mockResolvedValue({ workspaceId: 'w1' });
    prisma.user.update.mockRejectedValue(new Error('DB error'));
    const res = await POST(new Request('http://localhost/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: 'Acme' }),
    }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal server error' });
  });
});
