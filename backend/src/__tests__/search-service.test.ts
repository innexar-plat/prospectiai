import { describe, it, expect, beforeEach } from '@jest/globals';
import { runSearch, SearchHttpError } from '../modules/search/application/search.service';
import { prisma } from '@/lib/prisma';
import * as googlePlaces from '@/lib/google-places';
import * as redis from '@/lib/redis';
import * as geocode from '@/lib/geocode';
import * as searchHistoryQueue from '@/lib/search-history-queue';
import * as serper from '@/lib/web-search/serper';

jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
        },
        workspaceMember: {
            findFirst: jest.fn(),
        },
        workspace: {
            update: jest.fn(),
            findUnique: jest.fn(),
        },
        lead: {
            findMany: jest.fn(),
        },
        webSearchConfig: {
            findUnique: jest.fn(),
        },
        searchHistory: {
            create: jest.fn(),
            count: jest.fn(),
        },
        leadAnalysis: {
            count: jest.fn(),
        },
        $transaction: jest.fn((cb) => {
            if (typeof cb === 'function') {
                return cb(prisma);
            }
            return Promise.resolve();
        }),
    },
}));

jest.mock('@/lib/google-places', () => ({
    textSearch: jest.fn(),
    textSearchAllPages: jest.fn(),
    PLACES_PAGE_SIZE_MAX: 20,
}));

jest.mock('@/lib/redis', () => ({
    getCached: jest.fn(),
    setCached: jest.fn().mockResolvedValue(undefined),
    acquireRedisLock: jest.fn().mockResolvedValue(true),
    releaseRedisLock: jest.fn().mockResolvedValue(undefined),
    waitForCached: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/geocode', () => ({
    geocodeAddress: jest.fn(),
}));

jest.mock('@/lib/web-search/serper', () => ({
    searchSerper: jest.fn(),
}));

jest.mock('@/lib/search-history-queue', () => ({
    enqueueSearchHistoryWrite: jest.fn(),
    getSearchHistoryQueueStats: jest.fn(() => ({
        queueLength: 0,
        activeWorkers: 0,
        concurrency: 1,
        maxQueueSize: 1000,
        droppedTasks: 0,
    })),
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock('@/lib/usage', () => ({
    recordUsageEvent: jest.fn(),
}));

// Mock db-sync
jest.mock('@/lib/db-sync', () => ({
    syncLeads: jest.fn().mockResolvedValue(undefined),
    computeOpportunityScore: jest.fn().mockReturnValue({ score: 50, factors: {} }),
}));

describe('SearchService', () => {
    const mockUserId = 'user-1';
    const mockWorkspaceId = 'ws-1';
    const mockUser = {
        id: mockUserId,
        onboardingCompletedAt: new Date(),
        workspaces: [{ workspace: { id: mockWorkspaceId, leadsUsed: 0, leadsLimit: 10 } }],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.SEARCH_SERPER_API_KEY = 'test-serper-key';
        process.env.SEARCH_SITE_ENRICH_ENABLED = 'true';
        process.env.SEARCH_SITE_ENRICH_MAX_PLACES = '8';
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.searchHistory.create as jest.Mock).mockResolvedValue({});
        (prisma.workspace.update as jest.Mock).mockResolvedValue({});
        (googlePlaces.textSearch as jest.Mock).mockResolvedValue({ places: [] });
        (serper.searchSerper as jest.Mock).mockResolvedValue([]);
    });

    it('should throw 403 if onboarding is not completed', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, onboardingCompletedAt: null });
        await expect(runSearch({ textQuery: 'test' } as any, mockUserId)).rejects.toThrow(SearchHttpError);
    });

    it('should throw 403 with MEMBER_LIMIT_EXCEEDED when member daily limit reached', async () => {
        const userWithLimit = {
            ...mockUser,
            workspaces: [{
                workspace: { id: mockWorkspaceId, leadsUsed: 0, leadsLimit: 10 },
                dailyLeadsLimit: 5,
                weeklyLeadsLimit: null,
                monthlyLeadsLimit: null,
            }],
        };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(userWithLimit);
        (prisma.searchHistory.count as jest.Mock).mockResolvedValue(3);
        (prisma.leadAnalysis.count as jest.Mock).mockResolvedValue(3);
        (redis.getCached as jest.Mock).mockResolvedValue(null);

        let thrown: unknown;
        try {
            await runSearch({ textQuery: 'test' } as any, mockUserId);
        } catch (e) {
            thrown = e;
        }
        expect(thrown).toBeInstanceOf(SearchHttpError);
        expect((thrown as SearchHttpError).status).toBe(403);
        expect((thrown as SearchHttpError).body?.code).toBe('MEMBER_LIMIT_EXCEEDED');
    });

    it('should return cached results if available', async () => {
        const mockCachedResults = { places: Array(10).fill({ id: 'p1', displayName: { text: 'Place 1' } }) };
        (redis.getCached as jest.Mock).mockResolvedValue(mockCachedResults);

        const result = await runSearch({ textQuery: 'test' } as any, mockUserId);
        expect(result.fromCache).toBe(true);
        expect(result.places).toHaveLength(10);
        expect(searchHistoryQueue.enqueueSearchHistoryWrite).toHaveBeenCalled();
    });

    it('should return from local DB if enough results available', async () => {
        (redis.getCached as jest.Mock).mockResolvedValue(null);
        const mockLeads = Array(12).fill(null).map((_, i) => ({
            placeId: `id-${i}`,
            name: `Lead ${i}`,
            address: 'Address',
            website: 'https://example.com',
            recommendedWebsite: 'https://recomendado.com',
            phone: '+5511999999999',
            recommendedPhone: '+5511888888888',
            email: 'fallback@empresa.com',
            recommendedEmail: 'contato@empresa.com',
            contactsHealthScore: 85,
            rating: 4.5,
            reviewCount: 10,
            types: ['restaurant'],
            businessStatus: 'OPERATIONAL',
            lastSearchedAt: new Date(), // fresh leads
        }));
        (prisma.lead.findMany as jest.Mock).mockResolvedValue(mockLeads);

        const result = await runSearch({ textQuery: 'test', pageSize: 12 } as any, mockUserId);
        expect(result.fromLocalDb).toBe(true);
        expect(result.places).toHaveLength(12);
        expect(result.places?.[0]).toMatchObject({
            nationalPhoneNumber: '+5511888888888',
            websiteUri: 'https://recomendado.com',
            email: 'contato@empresa.com',
            recommendedPhone: '+5511888888888',
            recommendedEmail: 'contato@empresa.com',
            recommendedWebsite: 'https://recomendado.com',
            contactsHealthScore: 85,
        });
    });

    it('should skip local DB when fewer than 5 leads returned', async () => {
        (redis.getCached as jest.Mock).mockResolvedValue(null);
        const fewLeads = Array(3).fill(null).map((_, i) => ({
            placeId: `id-${i}`,
            name: `Lead ${i}`,
            address: 'Address',
            website: 'https://example.com',
            phone: '+5511999999999',
            lastSearchedAt: new Date(),
        }));
        (prisma.lead.findMany as jest.Mock).mockResolvedValue(fewLeads);
        (googlePlaces.textSearch as jest.Mock).mockResolvedValue({
            places: [{ id: 'g1', displayName: { text: 'Google Place' } }],
        });

        const result = await runSearch({ textQuery: 'test' } as any, mockUserId);
        // Should have fallen through to Google
        expect(googlePlaces.textSearch).toHaveBeenCalled();
    });

    it('should call Google Places API if cache and DB miss', async () => {
        (redis.getCached as jest.Mock).mockResolvedValue(null);
        (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
        (googlePlaces.textSearch as jest.Mock).mockResolvedValue({ places: [{ id: 'g1', displayName: { text: 'Google Place' } }] });

        const result = await runSearch({ textQuery: 'google' } as any, mockUserId);
        expect(result.places).toHaveLength(1);
        expect(googlePlaces.textSearch).toHaveBeenCalled();
        expect(prisma.workspace.update).toHaveBeenCalled();
    });

    it('should NOT call Serper during search (moved to lead analysis)', async () => {
        (redis.getCached as jest.Mock).mockResolvedValue(null);
        (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
        (googlePlaces.textSearch as jest.Mock).mockResolvedValue({
            places: [{ id: 'g1', displayName: { text: 'Acme Marketing' }, formattedAddress: 'Rua A, 123, Sao Paulo' }],
        });

        const result = await runSearch({ textQuery: 'acme marketing sp', country: 'Brasil' } as any, mockUserId);

        expect(serper.searchSerper).not.toHaveBeenCalled();
        // Place should still be returned (without Serper enrichment)
        expect(result.places?.[0]?.id).toBe('g1');
    });

    it('should coalesce concurrent identical runSearch requests', async () => {
        (redis.getCached as jest.Mock).mockResolvedValue(null);
        (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);

        let resolveSearch: ((value: { places: Array<{ id: string; displayName: { text: string } }> }) => void) | undefined;
        (googlePlaces.textSearch as jest.Mock).mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveSearch = resolve as typeof resolveSearch;
                })
        );

        const p1 = runSearch({ textQuery: 'same-query' } as any, mockUserId);
        const p2 = runSearch({ textQuery: 'same-query' } as any, mockUserId);

        await new Promise((resolve) => setImmediate(resolve));

        expect(googlePlaces.textSearch).toHaveBeenCalledTimes(1);
        resolveSearch!({ places: [{ id: 'g-coalesce', displayName: { text: 'Coalesced Place' } }] });

        const [r1, r2] = await Promise.all([p1, p2]);
        expect(r1.places).toHaveLength(1);
        expect(r2.places).toHaveLength(1);
        expect(r1.places?.[0].id).toBe('g-coalesce');
        expect(r2.places?.[0].id).toBe('g-coalesce');
    });

    it('should write results to cache after Google Places API call', async () => {
        (redis.getCached as jest.Mock).mockResolvedValue(null);
        (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
        const mockPlaces = [{ id: 'g1', displayName: { text: 'Cached Place' } }];
        (googlePlaces.textSearch as jest.Mock).mockResolvedValue({ places: mockPlaces });

        await runSearch({ textQuery: 'cacheable' } as any, mockUserId);
        expect(redis.setCached).toHaveBeenCalled();
        const cacheKeys = (redis.setCached as jest.Mock).mock.calls.map((call) => call[0]);
        expect(cacheKeys.some((key: string) => key.includes('search:cacheable'))).toBe(true);
    });

    it('should filter out places without website when hasWebsite is yes', async () => {
        (redis.getCached as jest.Mock).mockResolvedValue(null);
        (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
        (googlePlaces.textSearch as jest.Mock).mockResolvedValue({
            places: [
                { id: 'g1', displayName: { text: 'With Web' }, websiteUri: 'https://a.com', nationalPhoneNumber: '+5511111111' },
                { id: 'g2', displayName: { text: 'No Web' }, websiteUri: null, nationalPhoneNumber: null },
            ],
        });
        const result = await runSearch({ textQuery: 'x', hasWebsite: 'yes', hasPhone: 'yes' } as any, mockUserId);
        expect(result.places).toHaveLength(1);
        expect(result.places![0]).toMatchObject({ id: 'g1' });
    });

    it('should filter out places with website when hasWebsite is no', async () => {
        (redis.getCached as jest.Mock).mockResolvedValue(null);
        (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
        (googlePlaces.textSearch as jest.Mock).mockResolvedValue({
            places: [
                { id: 'g1', displayName: { text: 'No Web' }, websiteUri: null },
                { id: 'g2', displayName: { text: 'With Web' }, websiteUri: 'https://b.com' },
            ],
        });
        const result = await runSearch({ textQuery: 'x', hasWebsite: 'no' } as any, mockUserId);
        expect(result.places).toHaveLength(1);
        expect(result.places![0]).toMatchObject({ id: 'g1' });
    });

    it('should apply locationBias when city is provided and geocode succeeds', async () => {
        (redis.getCached as jest.Mock).mockResolvedValue(null);
        (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
        (geocode.geocodeAddress as jest.Mock).mockResolvedValue({ latitude: -23.5, longitude: -46.6 });
        (googlePlaces.textSearch as jest.Mock).mockResolvedValue({
            places: [{ id: 'g1', displayName: { text: 'Place' } }],
        });

        await runSearch({
            textQuery: 'restaurant',
            city: 'São Paulo',
            state: 'SP',
            country: 'Brasil',
        } as any, mockUserId);

        expect(geocode.geocodeAddress).toHaveBeenCalledWith('São Paulo', 'SP', 'Brasil');
        const textSearchCall = (googlePlaces.textSearch as jest.Mock).mock.calls[0][0];
        expect(textSearchCall.locationBias).toBeDefined();
        expect(textSearchCall.locationBias?.center).toEqual({ latitude: -23.5, longitude: -46.6 });
        expect(textSearchCall.locationBias?.radius).toBeDefined();
    });

    it('should pass US regionCode and English languageCode when country is Estados Unidos', async () => {
        (redis.getCached as jest.Mock).mockResolvedValue(null);
        (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
        (geocode.geocodeAddress as jest.Mock).mockResolvedValue({ latitude: 25.76, longitude: -80.19 });
        (googlePlaces.textSearch as jest.Mock).mockResolvedValue({
            places: [{ id: 'us1', displayName: { text: 'House Clean Miami' } }],
        });

        await runSearch({
            textQuery: 'house clean Miami FL',
            city: 'Miami',
            state: 'FL',
            country: 'Estados Unidos',
        } as any, mockUserId);

        const textSearchCall = (googlePlaces.textSearch as jest.Mock).mock.calls[0][0];
        expect(textSearchCall.regionCode).toBe('US');
        expect(textSearchCall.languageCode).toBe('en');
    });

    it('should pass BR regionCode and pt-BR languageCode when country is Brasil', async () => {
        (redis.getCached as jest.Mock).mockResolvedValue(null);
        (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
        (googlePlaces.textSearch as jest.Mock).mockResolvedValue({
            places: [{ id: 'br1', displayName: { text: 'Restaurante SP' } }],
        });

        await runSearch({
            textQuery: 'restaurante',
            country: 'Brasil',
        } as any, mockUserId);

        const textSearchCall = (googlePlaces.textSearch as jest.Mock).mock.calls[0][0];
        expect(textSearchCall.regionCode).toBe('BR');
        expect(textSearchCall.languageCode).toBe('pt-BR');
    });

    it('should pass US locale when country code is US', async () => {
        (redis.getCached as jest.Mock).mockResolvedValue(null);
        (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
        (googlePlaces.textSearch as jest.Mock).mockResolvedValue({
            places: [{ id: 'us2', displayName: { text: 'Cleaning Service' } }],
        });

        await runSearch({
            textQuery: 'cleaning service',
            country: 'US',
        } as any, mockUserId);

        const textSearchCall = (googlePlaces.textSearch as jest.Mock).mock.calls[0][0];
        expect(textSearchCall.regionCode).toBe('US');
        expect(textSearchCall.languageCode).toBe('en');
    });

    describe('runSearchAllPages', () => {
        const { runSearchAllPages } = require('../modules/search/application/search.service');

        it('should fetch multiple pages and persist', async () => {
            (googlePlaces.textSearchAllPages as jest.Mock).mockResolvedValue({ places: [{ id: 'ap1', displayName: { text: 'All Pages Place' } }] });

            const result = await runSearchAllPages({ textQuery: 'all' } as any, mockUserId, 10);
            expect(result.places).toHaveLength(1);
            expect(googlePlaces.textSearchAllPages).toHaveBeenCalled();
            expect(prisma.workspace.update).toHaveBeenCalled();
            expect(searchHistoryQueue.enqueueSearchHistoryWrite).toHaveBeenCalled();
        });

        it('should coalesce concurrent identical runSearchAllPages requests', async () => {
            let resolveSearchAllPages: ((value: { places: Array<{ id: string; displayName: { text: string } }> }) => void) | undefined;
            (googlePlaces.textSearchAllPages as jest.Mock).mockImplementation(
                () =>
                    new Promise((resolve) => {
                        resolveSearchAllPages = resolve as typeof resolveSearchAllPages;
                    })
            );

            const p1 = runSearchAllPages({ textQuery: 'all-coalesce' } as any, mockUserId, 20);
            const p2 = runSearchAllPages({ textQuery: 'all-coalesce' } as any, mockUserId, 20);

            await new Promise((resolve) => setImmediate(resolve));

            expect(googlePlaces.textSearchAllPages).toHaveBeenCalledTimes(1);
            resolveSearchAllPages!({ places: [{ id: 'ap-coalesce', displayName: { text: 'All Coalesced Place' } }] });

            const [r1, r2] = await Promise.all([p1, p2]);
            expect(r1.places).toHaveLength(1);
            expect(r2.places).toHaveLength(1);
            expect(r1.places?.[0].id).toBe('ap-coalesce');
            expect(r2.places?.[0].id).toBe('ap-coalesce');
        });

        it('should apply locationBias when city is provided', async () => {
            (geocode.geocodeAddress as jest.Mock).mockResolvedValue({ latitude: -22.9, longitude: -43.2 });
            (googlePlaces.textSearchAllPages as jest.Mock).mockResolvedValue({
                places: [{ id: 'rp1', displayName: { text: 'Rio Place' } }],
            });

            const result = await runSearchAllPages({
                textQuery: 'restaurant',
                city: 'Rio de Janeiro',
                state: 'RJ',
            } as any, mockUserId, 20);

            expect(geocode.geocodeAddress).toHaveBeenCalledWith('Rio de Janeiro', 'RJ', 'Brasil');
            expect(result.places).toHaveLength(1);
            const callArg = (googlePlaces.textSearchAllPages as jest.Mock).mock.calls[0][0];
            expect(callArg.locationBias).toBeDefined();
            expect(callArg.locationBias?.center).toEqual({ latitude: -22.9, longitude: -43.2 });
        });
    });
});
