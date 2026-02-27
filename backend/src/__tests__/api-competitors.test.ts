/**
 * POST /api/competitors — requires ANALISE_CONCORRENCIA (PRO+)
 */
import { POST } from '@/app/api/competitors/route';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));
jest.mock('@/modules/competitors', () => ({
  runCompetitorAnalysis: jest.fn(),
  SearchHttpError: class SearchHttpError extends Error {
    constructor(public status: number, public body: Record<string, unknown>) {
      super('SearchHttpError');
    }
  },
}));

const { runCompetitorAnalysis } = require('@/modules/competitors');

describe('POST /api/competitors', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    jest.mocked(auth).mockResolvedValue(null);
    const req = new NextRequest('http://x/api/competitors', {
      method: 'POST',
      body: JSON.stringify({ textQuery: 'cafes sp' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 429 when rate limit exceeded', async () => {
    const { rateLimit } = await import('@/lib/ratelimit');
    jest.mocked(rateLimit).mockResolvedValueOnce({ success: false });
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
    prisma.user.findUnique.mockResolvedValue({
      workspaces: [{ workspace: { plan: 'PRO' } }],
      plan: 'PRO',
    });
    const req = new NextRequest('http://x/api/competitors', {
      method: 'POST',
      body: JSON.stringify({ textQuery: 'cafes' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('returns 400 when textQuery missing', async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
    const req = new NextRequest('http://x/api/competitors', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/textQuery/);
  });

  it('returns 403 when plan does not have ANALISE_CONCORRENCIA', async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
    prisma.user.findUnique.mockResolvedValue({
      workspaces: [{ workspace: { plan: 'FREE' } }],
      plan: 'FREE',
    });
    const req = new NextRequest('http://x/api/competitors', {
      method: 'POST',
      body: JSON.stringify({ textQuery: 'cafes' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('not available on your plan');
  });

  it('returns 200 with competitor analysis when plan is PRO', async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
    prisma.user.findUnique.mockResolvedValue({
      workspaces: [{ workspace: { plan: 'PRO' } }],
      plan: 'PRO',
    });
    const mockResult = {
      totalCount: 5,
      rankingByRating: [],
      rankingByReviews: [],
      digitalPresence: { withWebsite: 2, withoutWebsite: 3, withPhone: 4, withoutPhone: 1 },
      opportunities: [],
    };
    jest.mocked(runCompetitorAnalysis).mockResolvedValue(mockResult);

    const req = new NextRequest('http://x/api/competitors', {
      method: 'POST',
      body: JSON.stringify({ textQuery: 'cafes sao paulo' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.totalCount).toBe(5);
    expect(json.digitalPresence.withWebsite).toBe(2);
    expect(runCompetitorAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ textQuery: 'cafes sao paulo' }),
      'u1'
    );
  });
});
