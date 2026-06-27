/**
 * Tests for POST /api/user/change-password
 */
import { POST } from '@/app/api/user/change-password/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: jest.fn(), update: jest.fn() },
    },
}));
jest.mock('@/lib/ratelimit', () => ({
    rateLimit: jest.fn().mockResolvedValue({ success: true, remaining: 4, reset: 0 }),
}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

const { rateLimit } = require('@/lib/ratelimit');

function makeRequest(body: object) {
    return new Request('http://localhost/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/user/change-password', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (rateLimit as jest.Mock).mockResolvedValue({ success: true, remaining: 4, reset: 0 });
    });

    it('returns 401 when unauthenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        const res = await POST(makeRequest({ currentPassword: 'old', newPassword: 'newpass12' }));
        expect(res.status).toBe(401);
    });

    it('returns 429 when rate limited', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
        (rateLimit as jest.Mock).mockResolvedValue({ success: false, remaining: 0, reset: 3600 });
        const res = await POST(makeRequest({ currentPassword: 'old', newPassword: 'newpass12' }));
        expect(res.status).toBe(429);
    });

    it('returns 400 when currentPassword is missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
        const res = await POST(makeRequest({ newPassword: 'newpass12' }));
        expect(res.status).toBe(400);
    });

    it('returns 400 when newPassword is too short', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
        const res = await POST(makeRequest({ currentPassword: 'old', newPassword: 'short' }));
        expect(res.status).toBe(400);
    });

    it('returns 400 when user has no password (OAuth account)', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ password: null });
        const res = await POST(makeRequest({ currentPassword: 'old', newPassword: 'newpass12' }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/login social/i);
    });

    it('returns 400 when current password is incorrect', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
        const hashed = await bcrypt.hash('correctpass', 10);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ password: hashed });
        const res = await POST(makeRequest({ currentPassword: 'wrongpass', newPassword: 'newpass12' }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/incorreta/i);
    });

    it('returns 400 when new password equals current password', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
        const hashed = await bcrypt.hash('samepass1', 10);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ password: hashed });
        const res = await POST(makeRequest({ currentPassword: 'samepass1', newPassword: 'samepass1' }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/diferente/i);
    });

    it('returns 200 and updates password on success', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
        const hashed = await bcrypt.hash('oldpass12', 4);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ password: hashed });
        (prisma.user.update as jest.Mock).mockResolvedValue({});
        const res = await POST(makeRequest({ currentPassword: 'oldpass12', newPassword: 'newpass12' }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toMatch(/sucesso/i);
        expect(prisma.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'u1' },
                data: expect.objectContaining({ password: expect.any(String) }),
            }),
        );
    });

    it('returns 500 when prisma throws', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
        (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('DB error'));
        const res = await POST(makeRequest({ currentPassword: 'old', newPassword: 'newpass12' }));
        expect(res.status).toBe(500);
    });
});
