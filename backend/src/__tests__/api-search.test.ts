import { POST } from '@/app/api/search/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCached } from '@/lib/redis';
import { textSearch } from '@/lib/google-places';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: jest.fn() },
        workspace: { update: jest.fn().mockResolvedValue({}) },
        searchHistory: { create: jest.fn().mockResolvedValue({}) },
        lead: { findMany: jest.fn().mockResolvedValue([]) },
        usageEvent: { create: jest.fn().mockResolvedValue({}) },
        $transaction: jest.fn((arg) => (Array.isArray(arg) ? Promise.all(arg) : arg)),
    },
}));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));
jest.mock('@/lib/google-places');
jest.mock('@/lib/redis', () => ({
    getCached: jest.fn().mockResolvedValue(null),
    setCached: jest.fn()
}));
jest.mock('@/lib/db-sync', () => ({
    syncLeads: jest.fn().mockResolvedValue(true)
}));

describe('Search API Route', () => {
    it('should return 429 when rate limit exceeded', async () => {
        const { rateLimit } = await import('@/lib/ratelimit');
        jest.mocked(rateLimit).mockResolvedValueOnce({ success: false });
        const req = new NextRequest('http://localhost/api/search', {
            method: 'POST',
            body: JSON.stringify({ textQuery: 'cafes' })
        });
        const res = await POST(req);
        expect(res.status).toBe(429);
        const data = await res.json();
        expect(data.error).toContain('Too many requests');
    });

    it('should return 401 if unauthorized', async () => {
        auth.mockResolvedValue(null);
        const req = new NextRequest('http://localhost/api/search', {
            method: 'POST',
            body: JSON.stringify({ textQuery: 'cafes' })
        });

        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('should return 403 if limit exceeded', async () => {
        auth.mockResolvedValue({ user: { id: 'u1' } });
        prisma.user.findUnique.mockResolvedValue({
            onboardingCompletedAt: new Date(),
            workspaces: [{ workspace: { id: 'w1', leadsUsed: 100, leadsLimit: 100 } }]
        });

        const req = new NextRequest('http://localhost/api/search', {
            method: 'POST',
            body: JSON.stringify({ textQuery: 'cafes' })
        });

        const res = await POST(req);
        expect(res.status).toBe(403);
    });

    it('should return 403 if onboarding not completed', async () => {
        auth.mockResolvedValue({ user: { id: 'u1' } });
        prisma.user.findUnique.mockResolvedValue({
            onboardingCompletedAt: null,
            workspaces: [{ workspace: { id: 'w1', leadsUsed: 0, leadsLimit: 100 } }]
        });

        const req = new NextRequest('http://localhost/api/search', {
            method: 'POST',
            body: JSON.stringify({ textQuery: 'cafes' })
        });

        const res = await POST(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.code).toBe('REQUIRES_ONBOARDING');
    });

    it('should return results and increment usage', async () => {
        auth.mockResolvedValue({ user: { id: 'u1' } });
        prisma.user.findUnique.mockResolvedValue({
            onboardingCompletedAt: new Date(),
            workspaces: [{ workspace: { id: 'w1', leadsUsed: 0, leadsLimit: 100 } }]
        });
        jest.mocked(textSearch).mockResolvedValue({
            places: [{ id: '1', displayName: { text: 'P1' } }]
        });

        const req = new NextRequest('http://localhost/api/search', {
            method: 'POST',
            body: JSON.stringify({ textQuery: 'cafes' })
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.places).toHaveLength(1);
        expect(prisma.workspace.update).toHaveBeenCalled();
    });

    it('should return 400 when textQuery is empty', async () => {
        auth.mockResolvedValue({ user: { id: 'u1' } });
        const req = new NextRequest('http://localhost/api/search', {
            method: 'POST',
            body: JSON.stringify({ textQuery: '' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('should return 404 when workspace not found', async () => {
        auth.mockResolvedValue({ user: { id: 'u1' } });
        prisma.user.findUnique.mockResolvedValue(null);

        const req = new NextRequest('http://localhost/api/search', {
            method: 'POST',
            body: JSON.stringify({ textQuery: 'cafes' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(404);
        const json = await res.json();
        expect(json.error).toBe('Workspace not found');
    });

    it('should return 404 when user has no workspaces', async () => {
        auth.mockResolvedValue({ user: { id: 'u1' } });
        prisma.user.findUnique.mockResolvedValue({
            onboardingCompletedAt: new Date(),
            workspaces: [],
        });

        const req = new NextRequest('http://localhost/api/search', {
            method: 'POST',
            body: JSON.stringify({ textQuery: 'cafes' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(404);
    });

    it('should return cached results when cache hit', async () => {
        jest.mocked(textSearch).mockClear();
        const cachedPlaces = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, displayName: { text: `Cached ${i}` } }));
        (getCached as jest.Mock).mockImplementationOnce(() =>
            Promise.resolve({ places: cachedPlaces })
        );
        auth.mockResolvedValue({ user: { id: 'u1' } });
        prisma.user.findUnique.mockResolvedValue({
            onboardingCompletedAt: new Date(),
            workspaces: [{ workspace: { id: 'w1', leadsUsed: 0, leadsLimit: 100 } }],
        });
        prisma.searchHistory.create.mockResolvedValue({} as never);

        const req = new NextRequest('http://localhost/api/search', {
            method: 'POST',
            body: JSON.stringify({ textQuery: 'cafes' }),
        });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.fromCache).toBe(true);
        expect(data.places).toHaveLength(5);
        expect(jest.mocked(textSearch)).not.toHaveBeenCalled();
        (getCached as jest.Mock).mockResolvedValue(null);
    });

    it('should return fromLocalDb when DB has enough leads', async () => {
        jest.mocked(textSearch).mockClear();
        (getCached as jest.Mock).mockResolvedValue(null);
        auth.mockResolvedValue({ user: { id: 'u1' } });
        prisma.user.findUnique.mockResolvedValue({
            onboardingCompletedAt: new Date(),
            workspaces: [{ workspace: { id: 'w1', leadsUsed: 0, leadsLimit: 100 } }],
        });
        prisma.searchHistory.create.mockResolvedValue({} as never);
        const dbLeads = Array.from({ length: 12 }, (_, i) => ({
            placeId: `place-${i}`,
            name: `Lead ${i}`,
            address: 'Addr',
            phone: '123',
            website: 'https://x.com',
            rating: 4,
            reviewCount: 10,
            types: null,
            businessStatus: 'OPERATIONAL',
        }));
        prisma.lead.findMany.mockResolvedValue(dbLeads as never);

        const req = new NextRequest('http://localhost/api/search', {
            method: 'POST',
            body: JSON.stringify({ textQuery: 'cafes', pageSize: 20 }),
        });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.fromLocalDb).toBe(true);
        expect(data.places).toBeDefined();
        expect(data.places.length).toBeGreaterThanOrEqual(5);
        expect(jest.mocked(textSearch)).not.toHaveBeenCalled();
    });
});
