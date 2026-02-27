/**
 * Tests for GET /api/search/history/[id]
 */

import { GET } from '@/app/api/search/history/[id]/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: jest.fn() },
        searchHistory: { findFirst: jest.fn() },
    },
}));
jest.mock('@/lib/redis', () => ({
    getCached: jest.fn().mockResolvedValue(null),
    setCached: jest.fn().mockResolvedValue(undefined),
}));

describe('GET /api/search/history/:id', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 when unauthenticated', async () => {
        jest.mocked(auth).mockResolvedValue(null);
        const req = new NextRequest('http://localhost/api/search/history/abc-123');
        const res = await GET(req, { params: Promise.resolve({ id: 'abc-123' }) });
        expect(res.status).toBe(401);
    });

    it('returns 404 when item not found', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
        prisma.user.findUnique.mockResolvedValue({
            workspaces: [{ workspaceId: 'w1' }],
        } as never);
        prisma.searchHistory.findFirst.mockResolvedValue(null);

        const req = new NextRequest('http://localhost/api/search/history/nonexistent');
        const res = await GET(req, { params: Promise.resolve({ id: 'nonexistent' }) });
        expect(res.status).toBe(404);
    });

    it('returns 200 with item data including resultsData', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
        prisma.user.findUnique.mockResolvedValue({
            workspaces: [{ workspaceId: 'w1' }],
        } as never);
        prisma.searchHistory.findFirst.mockResolvedValue({
            id: 'sh1',
            textQuery: 'pizzaria santos',
            pageSize: 20,
            filters: null,
            resultsCount: 15,
            resultsData: [
                { id: 'p1', displayName: { text: 'Pizza Express' }, formattedAddress: 'Rua A' },
                { id: 'p2', displayName: { text: 'Pizzaria da Vila' }, formattedAddress: 'Rua B' },
            ],
            createdAt: new Date(),
            user: { name: 'Test', email: 'test@example.com' },
        } as never);

        const req = new NextRequest('http://localhost/api/search/history/sh1');
        const res = await GET(req, { params: Promise.resolve({ id: 'sh1' }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.textQuery).toBe('pizzaria santos');
        expect(json.resultsData).toHaveLength(2);
        expect(json.resultsData[0].displayName.text).toBe('Pizza Express');
    });

    it('returns empty array when resultsData is null (old records)', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
        prisma.user.findUnique.mockResolvedValue({
            workspaces: [{ workspaceId: 'w1' }],
        } as never);
        prisma.searchHistory.findFirst.mockResolvedValue({
            id: 'sh2',
            textQuery: 'old search',
            pageSize: 10,
            filters: null,
            resultsCount: 5,
            resultsData: null,
            createdAt: new Date(),
            user: { name: 'Test', email: 'test@example.com' },
        } as never);

        const req = new NextRequest('http://localhost/api/search/history/sh2');
        const res = await GET(req, { params: Promise.resolve({ id: 'sh2' }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.resultsData).toEqual([]);
    });
});
