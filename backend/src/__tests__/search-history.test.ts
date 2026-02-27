/**
 * Tests for GET /api/search/history
 */

import { GET } from '@/app/api/search/history/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: jest.fn() },
        searchHistory: { findMany: jest.fn(), count: jest.fn() },
    },
}));

describe('GET /api/search/history', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 when unauthenticated', async () => {
        jest.mocked(auth).mockResolvedValue(null);
        const req = new NextRequest('http://localhost/api/search/history');
        const res = await GET(req);
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error).toBe('Unauthorized');
    });

    it('returns 404 when user has no workspace', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
        prisma.user.findUnique.mockResolvedValue({ workspaces: [] } as never);

        const req = new NextRequest('http://localhost/api/search/history');
        const res = await GET(req);
        expect(res.status).toBe(404);
        const json = await res.json();
        expect(json.error).toBe('Workspace not found');
    });

    it('returns 200 with items and total', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
        prisma.user.findUnique.mockResolvedValue({
            workspaces: [{ workspaceId: 'w1' }],
        } as never);
        prisma.searchHistory.findMany.mockResolvedValue([
            {
                id: 'sh1',
                textQuery: 'restaurant',
                pageSize: 10,
                filters: null,
                resultsCount: 5,
                createdAt: new Date(),
                user: { name: 'Test', email: 'test@example.com' },
            },
        ] as never);
        prisma.searchHistory.count.mockResolvedValue(1);

        const req = new NextRequest('http://localhost/api/search/history');
        const res = await GET(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].textQuery).toBe('restaurant');
        expect(json.total).toBe(1);
        expect(json.limit).toBe(20);
        expect(json.offset).toBe(0);
    });

    it('respects limit and offset query params', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
        prisma.user.findUnique.mockResolvedValue({
            workspaces: [{ workspaceId: 'w1' }],
        } as never);
        prisma.searchHistory.findMany.mockResolvedValue([] as never);
        prisma.searchHistory.count.mockResolvedValue(50);

        const req = new NextRequest('http://localhost/api/search/history?limit=5&offset=10');
        const res = await GET(req);
        expect(res.status).toBe(200);
        expect(prisma.searchHistory.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { workspaceId: 'w1' },
                take: 5,
                skip: 10,
            })
        );
        const json = await res.json();
        expect(json.limit).toBe(5);
        expect(json.offset).toBe(10);
    });
});
