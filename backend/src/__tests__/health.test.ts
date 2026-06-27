import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
    prisma: { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) },
}));
jest.mock('@/lib/telegram-alert', () => ({
    alertCritical: jest.fn().mockResolvedValue(undefined),
    alertSuccess: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('ioredis', () => {
    const MockRedis = jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn().mockResolvedValue(undefined),
    }));
    return { __esModule: true, default: MockRedis };
});

const { GET } = require('@/app/api/health/route');

describe('Health', () => {
    it('returns 200 with status ok and services', async () => {
        const req = new NextRequest('http://localhost/api/health');
        const res = await GET(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe('ok');
        expect(data.services.postgres.ok).toBe(true);
        expect(data.services.redis.ok).toBe(true);
        expect(data.timestamp).toBeDefined();
    });
});
