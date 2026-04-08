import { POST } from '@/app/api/analyze/route';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));
jest.mock('@/lib/redis', () => ({ setCached: jest.fn().mockResolvedValue(undefined), getCached: jest.fn() }));

const mockRunAnalyzePreChecks = jest.fn();
const mockRunAnalyze = jest.fn();
jest.mock('@/modules/analyze', () => ({
    runAnalyzePreChecks: (...args: unknown[]) => mockRunAnalyzePreChecks(...args),
    runAnalyze: (...args: unknown[]) => mockRunAnalyze(...args),
    AnalyzeHttpError: class AnalyzeHttpError extends Error {
        constructor(public status: number, public body: Record<string, unknown>) {
            super(typeof body.error === 'string' ? body.error : 'Request failed');
            this.name = 'AnalyzeHttpError';
        }
    },
}));

describe('POST /api/analyze API Cost Shield', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRunAnalyzePreChecks.mockResolvedValue({ cached: null });
        mockRunAnalyze.mockResolvedValue({ score: 8, summary: 'New' });
    });

    it('should return cached analysis and NOT call runAnalyze if preChecks returns cached', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        const cachedResult = { score: 9, summary: 'Cached summary', gaps: ['G1'] };
        mockRunAnalyzePreChecks.mockResolvedValue({ cached: cachedResult });

        const req = new NextRequest('http://localhost:3000/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ placeId: 'place-123', name: 'Test Business' }),
        });

        const res = await POST(req);
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.summary).toBe('Cached summary');
        expect(mockRunAnalyze).not.toHaveBeenCalled();
    });

    it('should return 400 when placeId or name is missing', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        const req = new NextRequest('http://localhost/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ placeId: 'p1' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBeDefined();
    });

    it('should return 404 when preChecks throws 404', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        const { AnalyzeHttpError } = require('@/modules/analyze');
        mockRunAnalyzePreChecks.mockRejectedValue(new AnalyzeHttpError(404, { error: 'Workspace not found' }));
        const req = new NextRequest('http://localhost/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ placeId: 'p1', name: 'Business' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(404);
        const json = await res.json();
        expect(json.error).toBe('Workspace not found');
    });

    it('should return 403 REQUIRES_ONBOARDING when preChecks throws', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        const { AnalyzeHttpError } = require('@/modules/analyze');
        mockRunAnalyzePreChecks.mockRejectedValue(new AnalyzeHttpError(403, { error: 'Onboarding required', code: 'REQUIRES_ONBOARDING' }));
        const req = new NextRequest('http://localhost/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ placeId: 'p1', name: 'Business' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.code).toBe('REQUIRES_ONBOARDING');
    });

    it('should return 403 LIMIT_EXCEEDED when preChecks throws', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        const { AnalyzeHttpError } = require('@/modules/analyze');
        mockRunAnalyzePreChecks.mockRejectedValue(new AnalyzeHttpError(403, { error: 'Limit reached', code: 'LIMIT_EXCEEDED' }));
        const req = new NextRequest('http://localhost/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ placeId: 'p1', name: 'Business' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.code).toBe('LIMIT_EXCEEDED');
    });

    it('should return jobId and processing status when no cached analysis', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        mockRunAnalyzePreChecks.mockResolvedValue({ cached: null });

        const req = new NextRequest('http://localhost/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ placeId: 'p1', name: 'Business' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.jobId).toBeDefined();
        expect(data.status).toBe('processing');
    });

    it('should return 429 when rate limit exceeded', async () => {
        const { rateLimit } = require('@/lib/ratelimit');
        (rateLimit as jest.Mock).mockResolvedValueOnce({ success: false });
        const req = new NextRequest('http://localhost/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ placeId: 'p1', name: 'Business' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(429);
        const json = await res.json();
        expect(json.error).toBe('Too many requests. Try again later.');
    });

    it('should return 401 when unauthenticated', async () => {
        jest.mocked(auth).mockResolvedValue(null);
        const req = new NextRequest('http://localhost/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ placeId: 'p1', name: 'Business' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error).toBe('Unauthorized');
    });
});
