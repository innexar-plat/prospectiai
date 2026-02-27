import { GET } from '@/app/api/leads/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: jest.fn() },
        leadAnalysis: { findMany: jest.fn() },
    },
}));

describe('GET /api/leads', () => {
    it('returns 401 when unauthenticated', async () => {
        jest.mocked(auth).mockResolvedValue(null);
        const req = new NextRequest('http://localhost/api/leads');
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it('returns 200 with analyses when user has workspace', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        prisma.user.findUnique.mockResolvedValue({ workspaces: [{ workspaceId: 'w1' }] } as never);
        prisma.leadAnalysis.findMany.mockResolvedValue([{ id: 'a1', lead: {} }] as never);
        const req = new NextRequest('http://localhost/api/leads');
        const res = await GET(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(1);
    });

    it('returns 500 when prisma throws', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        prisma.user.findUnique.mockResolvedValue({ workspaces: [{ workspaceId: 'w1' }] } as never);
        prisma.leadAnalysis.findMany.mockRejectedValue(new Error('DB error'));
        const req = new NextRequest('http://localhost/api/leads');
        const res = await GET(req);
        expect(res.status).toBe(500);
    });
});
