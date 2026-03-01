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
            lastSearchedAt: new Date(),
        }));
        (prisma.lead.findMany as jest.Mock).mockResolvedValue(mockLeads);

        const result = await runSearch({ textQuery: 'test', pageSize: 12 } as any, mockUserId);
        expect(result.fromLocalDb).toBe(true);
        expect(result.places).toHaveLength(12);
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

    describe('runSearchAllPages', () => {
        const { runSearchAllPages } = require('../modules/search/application/search.service');

        it('should fetch multiple pages and persist', async () => {
            (googlePlaces.textSearchAllPages as jest.Mock).mockResolvedValue({ places: [{ id: 'ap1', displayName: { text: 'All Pages Place' } }] });

            const result = await runSearchAllPages({ textQuery: 'all' } as any, mockUserId, 10);
            expect(result.places).toHaveLength(1);
            expect(googlePlaces.textSearchAllPages).toHaveBeenCalled();
            expect(prisma.$transaction).toHaveBeenCalled(); // via persistUnifiedSearchResult
        });
    });
});
