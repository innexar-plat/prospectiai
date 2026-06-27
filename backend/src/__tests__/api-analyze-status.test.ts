import { GET } from '@/app/api/analyze/status/route';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/redis', () => ({
    getCached: jest.fn(),
}));

const { getCached } = require('@/lib/redis');

describe('GET /api/analyze/status', () => {
    const originalStaleMs = process.env.ANALYZE_JOB_STALE_MS;

    afterEach(() => {
        process.env.ANALYZE_JOB_STALE_MS = originalStaleMs;
        jest.clearAllMocks();
    });

    it('returns 401 when unauthenticated', async () => {
        jest.mocked(auth).mockResolvedValue(null);
        const req = new NextRequest('http://localhost/api/analyze/status?jobId=abcdefghij');
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it('returns 400 when jobId is missing', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        const req = new NextRequest('http://localhost/api/analyze/status');
        const res = await GET(req);
        expect(res.status).toBe(400);
    });

    it('returns not_found when job expired from Redis', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        getCached.mockResolvedValue(null);
        const req = new NextRequest('http://localhost/api/analyze/status?jobId=abcdefghijklmnop');
        const res = await GET(req);
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.status).toBe('not_found');
    });

    it('returns stale error with errorCode when job heartbeat is too old', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        process.env.ANALYZE_JOB_STALE_MS = '60000';
        getCached.mockResolvedValue({
            status: 'processing',
            step: 'ai_call',
            updatedAt: Date.now() - 120_000,
        });
        const req = new NextRequest('http://localhost/api/analyze/status?jobId=abcdefghijklmnop');
        const res = await GET(req);
        expect(res.status).toBe(504);
        const data = await res.json();
        expect(data.status).toBe('error');
        expect(data.errorCode).toBe('ANALYSIS_STALE');
    });

    it('returns processing state when job is fresh', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        getCached.mockResolvedValue({
            status: 'processing',
            step: 'web_search',
            updatedAt: Date.now(),
        });
        const req = new NextRequest('http://localhost/api/analyze/status?jobId=abcdefghijklmnop');
        const res = await GET(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe('processing');
        expect(data.step).toBe('web_search');
    });

    it('returns done result when job completed', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        const result = { score: 8, summary: 'Great lead' };
        getCached.mockResolvedValue({
            status: 'done',
            result,
            updatedAt: Date.now(),
        });
        const req = new NextRequest('http://localhost/api/analyze/status?jobId=abcdefghijklmnop');
        const res = await GET(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe('done');
        expect(data.result).toEqual(result);
    });
});
