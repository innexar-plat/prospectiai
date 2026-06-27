/**
 * Tests for GET /api/admin/email-logs
 */
import { GET } from '@/app/api/admin/email-logs/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        emailSendLog: { findMany: jest.fn(), count: jest.fn() },
    },
}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

function makeRequest(params: Record<string, string> = {}) {
    const url = new URL('http://localhost/api/admin/email-logs');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return new NextRequest(url);
}

const sampleLog = {
    id: 'log1',
    type: 'TRANSACTIONAL',
    email: 'user@test.com',
    subject: 'Welcome',
    status: 'SENT',
    provider: 'resend',
    providerMessageId: 'msg_123',
    error: null,
    campaignId: null,
    userId: 'u1',
    createdAt: new Date('2026-04-10T10:00:00Z'),
};

describe('GET /api/admin/email-logs', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns 401 when unauthenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        const res = await GET(makeRequest());
        expect(res.status).toBe(401);
    });

    it('returns 403 when not admin', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'user@test.com' }, expires: '' });
        (isAdmin as jest.Mock).mockReturnValue(false);
        const res = await GET(makeRequest());
        expect(res.status).toBe(403);
    });

    it('returns items and total when admin', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
        (isAdmin as jest.Mock).mockReturnValue(true);
        (prisma.emailSendLog.findMany as jest.Mock).mockResolvedValue([sampleLog]);
        (prisma.emailSendLog.count as jest.Mock).mockResolvedValue(1);
        const res = await GET(makeRequest());
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.items).toHaveLength(1);
        expect(data.total).toBe(1);
        expect(data.limit).toBe(50);
        expect(data.offset).toBe(0);
    });

    it('applies type filter', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
        (isAdmin as jest.Mock).mockReturnValue(true);
        (prisma.emailSendLog.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.emailSendLog.count as jest.Mock).mockResolvedValue(0);
        const res = await GET(makeRequest({ type: 'CAMPAIGN' }));
        expect(res.status).toBe(200);
        expect(prisma.emailSendLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ type: 'CAMPAIGN' }),
            }),
        );
    });

    it('applies status filter', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
        (isAdmin as jest.Mock).mockReturnValue(true);
        (prisma.emailSendLog.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.emailSendLog.count as jest.Mock).mockResolvedValue(0);
        const res = await GET(makeRequest({ status: 'FAILED' }));
        expect(res.status).toBe(200);
        expect(prisma.emailSendLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ status: 'FAILED' }),
            }),
        );
    });

    it('applies email filter (case-insensitive)', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
        (isAdmin as jest.Mock).mockReturnValue(true);
        (prisma.emailSendLog.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.emailSendLog.count as jest.Mock).mockResolvedValue(0);
        const res = await GET(makeRequest({ email: 'user@test' }));
        expect(res.status).toBe(200);
        expect(prisma.emailSendLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    email: { contains: 'user@test', mode: 'insensitive' },
                }),
            }),
        );
    });

    it('respects limit and offset params', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
        (isAdmin as jest.Mock).mockReturnValue(true);
        (prisma.emailSendLog.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.emailSendLog.count as jest.Mock).mockResolvedValue(0);
        const res = await GET(makeRequest({ limit: '10', offset: '20' }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.limit).toBe(10);
        expect(data.offset).toBe(20);
        expect(prisma.emailSendLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ take: 10, skip: 20 }),
        );
    });

    it('caps limit at 100', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
        (isAdmin as jest.Mock).mockReturnValue(true);
        (prisma.emailSendLog.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.emailSendLog.count as jest.Mock).mockResolvedValue(0);
        const res = await GET(makeRequest({ limit: '500' }));
        const data = await res.json();
        expect(data.limit).toBe(100);
    });

    it('returns 500 when prisma throws', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
        (isAdmin as jest.Mock).mockReturnValue(true);
        (prisma.emailSendLog.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));
        const res = await GET(makeRequest());
        expect(res.status).toBe(500);
    });
});
