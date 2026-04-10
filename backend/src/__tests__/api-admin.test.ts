import { GET as getStats } from '@/app/api/admin/stats/route';
import { GET as getStatsHistory } from '@/app/api/admin/stats/history/route';
import { GET as getUsers } from '@/app/api/admin/users/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { count: jest.fn(), findMany: jest.fn() },
        workspace: { count: jest.fn() },
        searchHistory: { count: jest.fn() },
        leadAnalysis: { count: jest.fn() },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        usageEvent: {
            groupBy: jest.fn().mockResolvedValue([
                { type: 'GOOGLE_PLACES_SEARCH', _sum: { quantity: 0 } },
                { type: 'GOOGLE_PLACES_DETAILS', _sum: { quantity: 0 } },
                { type: 'SERPER_REQUEST', _sum: { quantity: 0 } },
            ]),
            findMany: jest.fn().mockResolvedValue([]),
        },
        $queryRaw: jest.fn().mockResolvedValue([{ aiInputTokensTotal: BigInt(0), aiOutputTokensTotal: BigInt(0) }]),
    },
}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

describe('Admin API', () => {
    it('GET /api/admin/stats returns 401 when unauthenticated', async () => {
        jest.mocked(auth).mockResolvedValue(null);
        const res = await getStats();
        expect(res.status).toBe(401);
    });

    it('GET /api/admin/stats returns 403 when not admin', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1', email: 'user@test.com' }, expires: '' });
        jest.mocked(isAdmin).mockReturnValue(false);
        const res = await getStats();
        expect(res.status).toBe(403);
    });

    it('GET /api/admin/stats returns counts when admin', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
        jest.mocked(isAdmin).mockReturnValue(true);
        prisma.user.count.mockResolvedValue(10);
        prisma.workspace.count.mockResolvedValue(8);
        prisma.searchHistory.count.mockResolvedValue(100);
        prisma.leadAnalysis.count.mockResolvedValue(50);
        const res = await getStats();
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.users).toBe(10);
        expect(data.workspaces).toBe(8);
        expect(data.searchHistory).toBe(100);
        expect(data.leadAnalyses).toBe(50);
    });

    it('GET /api/admin/users returns 403 when not admin', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1', email: 'user@test.com' }, expires: '' });
        jest.mocked(isAdmin).mockReturnValue(false);
        const req = new NextRequest('http://localhost/api/admin/users');
        const res = await getUsers(req);
        expect(res.status).toBe(403);
    });

    it('GET /api/admin/users returns items and total when admin', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
        jest.mocked(isAdmin).mockReturnValue(true);
        prisma.user.findMany.mockResolvedValue([
            { id: 'u1', name: 'A', email: 'a@b.com', plan: 'FREE', onboardingCompletedAt: null, createdAt: new Date(), _count: { workspaces: 1, analyses: 0, searchHistory: 0 } },
        ] as never);
        prisma.user.count.mockResolvedValue(1);
        const req = new NextRequest('http://localhost/api/admin/users');
        const res = await getUsers(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.items).toHaveLength(1);
        expect(data.total).toBe(1);
        expect(data.limit).toBe(20);
        expect(data.offset).toBe(0);
    });

    it('GET /api/admin/stats returns 500 when prisma throws', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
        jest.mocked(isAdmin).mockReturnValue(true);
        prisma.user.count.mockRejectedValue(new Error('DB error'));
        const res = await getStats();
        expect(res.status).toBe(500);
    });

    it('GET /api/admin/users returns 500 when prisma throws', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
        jest.mocked(isAdmin).mockReturnValue(true);
        prisma.user.findMany.mockRejectedValue(new Error('DB error'));
        const req = new NextRequest('http://localhost/api/admin/users');
        const res = await getUsers(req);
        expect(res.status).toBe(500);
    });

    it('GET /api/admin/stats/history returns 401 when unauthenticated', async () => {
        jest.mocked(auth).mockResolvedValue(null);
        const req = new Request('http://localhost/api/admin/stats/history?days=7');
        const res = await getStatsHistory(req);
        expect(res.status).toBe(401);
    });

    it('GET /api/admin/stats/history returns 403 when not admin', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1', email: 'user@test.com' }, expires: '' });
        jest.mocked(isAdmin).mockReturnValue(false);
        const req = new Request('http://localhost/api/admin/stats/history?days=7');
        const res = await getStatsHistory(req);
        expect(res.status).toBe(403);
    });

    it('GET /api/admin/stats/history returns series when admin', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
        jest.mocked(isAdmin).mockReturnValue(true);
        const today = new Date().toISOString().slice(0, 10);
        prisma.$queryRaw
            .mockResolvedValueOnce([{ date: new Date(today), count: BigInt(2) }])   // users
            .mockResolvedValueOnce([{ date: new Date(today), count: BigInt(5) }])   // analyses
            .mockResolvedValueOnce([{ date: new Date(today), count: BigInt(10) }])  // searches
            .mockResolvedValueOnce([{ date: new Date(today), type: 'GOOGLE_PLACES_SEARCH', total: BigInt(3) }]); // usage
        const req = new Request('http://localhost/api/admin/stats/history?days=3');
        const res = await getStatsHistory(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.days).toBe(3);
        expect(Array.isArray(data.series)).toBe(true);
        expect(data.series.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/admin/stats/history returns 500 on DB error', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
        jest.mocked(isAdmin).mockReturnValue(true);
        prisma.$queryRaw.mockRejectedValue(new Error('DB fail'));
        const req = new Request('http://localhost/api/admin/stats/history');
        const res = await getStatsHistory(req);
        expect(res.status).toBe(500);
    });
});
