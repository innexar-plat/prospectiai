/**
 * POST /api/market-report — requires INTELIGENCIA_MERCADO (BUSINESS+)
 */
import { POST } from '@/app/api/market-report/route';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));
jest.mock('@/modules/market', () => ({
  runMarketReport: jest.fn(),
  SearchHttpError: class SearchHttpError extends Error {
    constructor(public status: number, public body: Record<string, unknown>) {
      super('SearchHttpError');
    }
  },
}));

const { runMarketReport } = require('@/modules/market');

describe('POST /api/market-report', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    jest.mocked(auth).mockResolvedValue(null);
    const req = new NextRequest('http://x/api/market-report', {
      method: 'POST',
      body: JSON.stringify({ textQuery: 'restaurantes' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when textQuery missing', async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
    const req = new NextRequest('http://x/api/market-report', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/textQuery/);
  });

  it('returns 403 when plan does not have INTELIGENCIA_MERCADO', async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
    prisma.user.findUnique.mockResolvedValue({
      workspaces: [{ workspace: { plan: 'PRO' } }],
      plan: 'PRO',
    });
    const req = new NextRequest('http://x/api/market-report', {
      method: 'POST',
      body: JSON.stringify({ textQuery: 'restaurantes' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('not available on your plan');
  });

  it('returns 200 with market report when plan is BUSINESS', async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
    prisma.user.findUnique.mockResolvedValue({
      workspaces: [{ workspace: { plan: 'BUSINESS' } }],
      plan: 'BUSINESS',
    });
    const mockResult = {
      totalBusinesses: 20,
      segments: [{ type: 'restaurant', count: 20, avgRating: 4.2 }],
      digitalMaturity: { withWebsite: 15, withPhone: 18, total: 20, withWebsitePercent: 75, withPhonePercent: 90 },
      saturationIndex: 20,
    };
    jest.mocked(runMarketReport).mockResolvedValue(mockResult);

    const req = new NextRequest('http://x/api/market-report', {
      method: 'POST',
      body: JSON.stringify({ textQuery: 'restaurantes praia grande' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.totalBusinesses).toBe(20);
    expect(json.segments).toHaveLength(1);
    expect(json.digitalMaturity.withWebsitePercent).toBe(75);
    expect(runMarketReport).toHaveBeenCalledWith(
      expect.objectContaining({ textQuery: 'restaurantes praia grande' }),
      'u1'
    );
  });
});
