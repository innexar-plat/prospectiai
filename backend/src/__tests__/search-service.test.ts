import { describe, it, expect, beforeEach } from '@jest/globals';
import { runSearch, SearchHttpError } from '../modules/search/application/search.service';
import { prisma } from '@/lib/prisma';
import * as googlePlaces from '@/lib/google-places';
import * as redis from '@/lib/redis';
import * as geocode from '@/lib/geocode';

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
        searchHistory: {
            create: jest.fn(),
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
}));

jest.mock('@/lib/geocode', () => ({
    geocodeAddress: jest.fn(),
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
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.searchHistory.create as jest.Mock).mockResolvedValue({});
        (prisma.workspace.update as jest.Mock).mockResolvedValue({});
        (googlePlaces.textSearch as jest.Mock).mockResolvedValue({ places: [] });
    });

    it('should throw 403 if onboarding is not completed', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, onboardingCompletedAt: null });
        await expect(runSearch({ textQuery: 'test' } as any, mockUserId)).rejects.toThrow(SearchHttpError);
    });

    it('should return cached results if available', async () => {
        const mockCachedResults = { places: Array(10).fill({ id: 'p1', displayName: { text: 'Place 1' } }) };
        (redis.getCached as jest.Mock).mockResolvedValue(mockCachedResults);

        const result = await runSearch({ textQuery: 'test' } as any, mockUserId);
        expect(result.fromCache).toBe(true);
        expect(result.places).toHaveLength(10);
        expect(prisma.searchHistory.create).toHaveBeenCalled();
    });

    it('should return from local DB if enough results available', async () => {
        (redis.getCached as jest.Mock).mockResolvedValue(null);
        const mockLeads = Array(12).fill(null).map((_, i) => ({
            placeId: `id-${i}`,
            name: `Lead ${i}`,
            address: 'Address',
            website: 'https://example.com',
            phone: '+5511999999999',
            lastSearchedAt: new Date(),
        }));
        (prisma.lead.findMany as jest.Mock).mockResolvedValue(mockLeads);

        const result = await runSearch({ textQuery: 'test', pageSize: 12 } as any, mockUserId);
        expect(result.fromLocalDb).toBe(true);
        expect(result.places).toHaveLength(12);
    });

    it('should skip local DB and use Google when DB has 10+ leads but fewer than 5 after filter', async () => {
        (redis.getCached as jest.Mock).mockResolvedValue(null);
        const tenLeads = Array(10).fill(null).map((_, i) => ({
            placeId: `id-${i}`,
            name: `Lead ${i}`,
            address: 'Address',
            website: i < 3 ? 'https://x.com' : null,
            phone: i < 3 ? '+5511111111' : null,
            lastSearchedAt: new Date(),
        }));
        (prisma.lead.findMany as jest.Mock).mockResolvedValue(tenLeads);
        (googlePlaces.textSearch as jest.Mock).mockResolvedValue({
            places: [{
                id: 'g1',
                displayName: { text: 'Google Place' },
                websiteUri: 'https://example.com',
                nationalPhoneNumber: '+5511999999999',
            }],
        });

        const result = await runSearch({
            textQuery: 'test',
            pageSize: 10,
            hasWebsite: 'yes',
            hasPhone: 'yes',
        } as any, mockUserId);

        expect(result.places).toHaveLength(1);
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
        expect(result.places[0]).toMatchObject({ id: 'g1' });
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
        expect(result.places[0]).toMatchObject({ id: 'g1' });
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

    describe('runSearchAllPages', () => {
        const { runSearchAllPages } = require('../modules/search/application/search.service');

        it('should fetch multiple pages and persist', async () => {
            (googlePlaces.textSearchAllPages as jest.Mock).mockResolvedValue({ places: [{ id: 'ap1', displayName: { text: 'All Pages Place' } }] });

            const result = await runSearchAllPages({ textQuery: 'all' } as any, mockUserId, 10);
            expect(result.places).toHaveLength(1);
            expect(googlePlaces.textSearchAllPages).toHaveBeenCalled();
            expect(prisma.$transaction).toHaveBeenCalled(); // via persistUnifiedSearchResult
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
