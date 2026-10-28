const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
jest.mock('@/lib/prisma', () => ({ prisma: { lead: { findMany: (...a: unknown[]) => mockFindMany(...a), updateMany: (...a: unknown[]) => mockUpdateMany(...a) } } }));
const mockLock = jest.fn();
jest.mock('@/lib/redis', () => ({ acquireRedisLock: (...a: unknown[]) => mockLock(...a) }));
const mockScrape = jest.fn();
jest.mock('@/lib/website-scraper', () => ({
    scrapeWebsite: (...a: unknown[]) => mockScrape(...a),
    pickBestEmail: (emails: string[]) => emails[0] ?? null,
}));

import { runEmailEnrichment } from '@/lib/email-enrichment';

beforeEach(() => jest.clearAllMocks());

describe('runEmailEnrichment', () => {
    it('scrapes leads not tried recently and stores the e-mail found', async () => {
        mockFindMany.mockResolvedValueOnce([{ id: 'a', website: 'a.com.br' }, { id: 'b', website: 'b.com.br' }, { id: 'c', website: 'c.com.br' }]);
        mockLock.mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        mockScrape.mockResolvedValueOnce({ emails: ['oi@a.com.br'] }).mockResolvedValueOnce({ emails: [] });

        expect(await runEmailEnrichment(false)).toEqual({ checked: 2, found: 1 });
        expect(mockScrape).toHaveBeenCalledTimes(2);
        expect(mockUpdateMany).toHaveBeenCalledWith({ where: { id: 'a', email: null, recommendedEmail: null }, data: { recommendedEmail: 'oi@a.com.br' } });
    });

    it('dry run only counts', async () => {
        mockFindMany.mockResolvedValueOnce([{ id: 'a', website: 'a.com.br' }]);
        expect(await runEmailEnrichment(true)).toEqual({ checked: 1, found: 0 });
        expect(mockScrape).not.toHaveBeenCalled();
    });
});
