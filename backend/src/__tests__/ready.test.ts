import { GET } from '@/app/api/ready/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
    prisma: {
        $queryRaw: jest.fn(),
    },
}));

describe('Ready', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns 200 when DB responds', async () => {
        jest.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ '?column?': 1 }]);
        const req = new Request('http://localhost/api/ready');
        const res = await GET(req as unknown as Parameters<typeof GET>[0]);
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ status: 'ready' });
    });

    it('returns 503 when DB fails', async () => {
        jest.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('Connection refused'));
        const req = new Request('http://localhost/api/ready');
        const res = await GET(req as unknown as Parameters<typeof GET>[0]);
        expect(res.status).toBe(503);
        expect(await res.json()).toMatchObject({ status: 'not ready', error: 'Database unavailable' });
    });
});
