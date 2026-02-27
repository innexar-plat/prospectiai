/**
 * Search module — application layer (use-case).
 * Orchestrates cache, DB, external API, history and usage.
 * Route (api) only validates, authenticates and calls runSearch.
 */

import { prisma } from '@/lib/prisma';
import { textSearch, textSearchAllPages, PLACES_PAGE_SIZE_MAX } from '@/lib/google-places';
import { geocodeAddress } from '@/lib/geocode';
import { getCached } from '@/lib/redis';
import { syncLeads } from '@/lib/db-sync';
import { logger } from '@/lib/logger';
import { recordUsageEvent } from '@/lib/usage';
import type { SearchInput } from '@/lib/validations/schemas';
import type { SearchResult, PlaceLike } from '../domain/types';

/** UI sempre em km; conversão para metros só na chamada à API (locationBias.radius). */
const RADIUS_KM_TO_M = 1000;
const DEFAULT_LOCATION_RADIUS_KM = 15;
/** Places API locationBias circle max radius (meters) = 50km */
const MAX_LOCATION_RADIUS_M = 50000;
/** Delay antes de usar nextPageToken (API pode rejeitar ou repetir se imediato). */
const NEXT_PAGE_TOKEN_DELAY_MS = 400;

export class SearchHttpError extends Error {
    constructor(
        public readonly status: number,
        public readonly body: Record<string, unknown>
    ) {
        super(typeof body.error === 'string' ? body.error : 'Request failed');
        this.name = 'SearchHttpError';
    }
}

function filterPlaces<T extends PlaceLike>(
    places: T[],
    hasWebsite?: string | null,
    hasPhone?: string | null
): T[] {
    return places.filter((place): place is T => {
        const website = place.websiteUri || place.website;
        const phone = place.nationalPhoneNumber || place.internationalPhoneNumber || place.phone;
        if (hasWebsite === 'yes' && !website) return false;
        if (hasWebsite === 'no' && website) return false;
        if (hasPhone === 'yes' && !phone) return false;
        if (hasPhone === 'no' && phone) return false;
        return true;
    });
}

export async function runSearch(input: SearchInput, userId: string): Promise<SearchResult> {
    const { textQuery, includedType, pageSize, pageToken, hasWebsite, hasPhone, city, state, country, radiusKm } = input;
    const effectivePageSize = Math.min(PLACES_PAGE_SIZE_MAX, Math.max(1, pageSize ?? PLACES_PAGE_SIZE_MAX));
    const filtersPayload = {
        includedType: includedType ?? null,
        hasWebsite: hasWebsite ?? null,
        hasPhone: hasPhone ?? null,
    };

    logger.info('Search request', {
        textQuery,
        includedType: includedType ?? null,
        effectivePageSize,
        hasWebsite: hasWebsite ?? null,
        hasPhone: hasPhone ?? null,
    });

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            onboardingCompletedAt: true,
            workspaces: { include: { workspace: true }, take: 1 },
        },
    });

    if (!user || user.workspaces.length === 0) {
        throw new SearchHttpError(404, { error: 'Workspace not found' });
    }

    if (user.onboardingCompletedAt == null) {
        throw new SearchHttpError(403, {
            error: 'Complete onboarding before searching',
            code: 'REQUIRES_ONBOARDING',
        });
    }

    const activeWorkspace = user.workspaces[0].workspace;

    if (activeWorkspace.leadsUsed >= activeWorkspace.leadsLimit) {
        throw new SearchHttpError(403, {
            error: 'Limit reached',
            code: 'LIMIT_EXCEEDED',
            limit: activeWorkspace.leadsLimit,
            used: activeWorkspace.leadsUsed,
        });
    }

    const saveHistory = async (resultsCount: number, places?: unknown[]): Promise<void> => {
        await prisma.searchHistory
            .create({
                data: {
                    workspaceId: activeWorkspace.id,
                    userId,
                    textQuery,
                    pageSize: effectivePageSize,
                    filters: filtersPayload,
                    resultsCount,
                    resultsData: places ? JSON.parse(JSON.stringify(places)) : undefined,
                },
            })
            .catch((err) =>
                logger.error('SearchHistory create error', {
                    error: err instanceof Error ? err.message : 'Unknown',
                })
            );
    };

    if (!pageToken) {
        const cacheKey = `search:${textQuery}:${includedType || ''}:${effectivePageSize}:${hasWebsite || 'any'}:${hasPhone || 'any'}`;
        const cached = await getCached<{ places: unknown[]; nextPageToken?: string }>(cacheKey);
        const cachedCount = cached?.places?.length ?? 0;
        const minAcceptableFromCache = Math.min(5, effectivePageSize);
        if (cachedCount >= minAcceptableFromCache) {
            logger.info('Search: cache hit', { cachedCount });
            await saveHistory(cachedCount, cached!.places);
            return { ...cached!, fromCache: true };
        }
        if (cachedCount > 0) {
            logger.info('Search: cache skipped (below minimum)', { cachedCount, minAcceptableFromCache });
        }

        const dbLeads = await prisma.lead.findMany({
            where: {
                OR: [
                    { name: { contains: textQuery, mode: 'insensitive' } },
                    { address: { contains: textQuery, mode: 'insensitive' } },
                ],
            },
            take: 100,
            orderBy: { lastSearchedAt: 'desc' },
        });

        if (dbLeads.length >= 10) {
            const mapped = dbLeads.map((l) => ({
                id: l.placeId,
                displayName: { text: l.name },
                formattedAddress: l.address,
                nationalPhoneNumber: l.phone,
                websiteUri: l.website,
                rating: l.rating,
                userRatingCount: l.reviewCount,
                types: l.types,
                businessStatus: l.businessStatus,
            }));

            const filtered = filterPlaces(mapped, hasWebsite, hasPhone);
            const slice = filtered.slice(0, effectivePageSize);
            if (slice.length >= 5) {
                logger.info('Search: local DB used', { dbTotal: dbLeads.length, afterFilter: filtered.length, returned: slice.length });
                await saveHistory(slice.length, slice);
                return { places: slice, fromLocalDb: true };
            }
        }
        logger.info('Search: local DB skip', { dbLeadsCount: dbLeads.length });
    }

    let locationBias: { center: { latitude: number; longitude: number }; radius: number } | undefined;
    const cityTrim = city?.trim();
    if (cityTrim && !pageToken) {
        const coords = await geocodeAddress(cityTrim, state ?? null, country ?? 'Brasil');
        if (coords) {
            const radiusKmNum = radiusKm ?? DEFAULT_LOCATION_RADIUS_KM;
            const radiusM = Math.min(
                MAX_LOCATION_RADIUS_M,
                Math.round(radiusKmNum * RADIUS_KM_TO_M) || Math.round(DEFAULT_LOCATION_RADIUS_KM * RADIUS_KM_TO_M)
            );
            locationBias = { center: coords, radius: radiusM };
            logger.info('Search: locationBias applied', { city: cityTrim, radiusKm: radiusKmNum, radiusM });
        } else {
            logger.info('Search: geocode failed, no locationBias', { city: cityTrim });
        }
    }

    if (pageToken) {
        await new Promise((r) => setTimeout(r, NEXT_PAGE_TOKEN_DELAY_MS));
    }

    logger.info('Search: calling Google Places API', { textQuery, includedType: includedType ?? null, hasLocationBias: !!locationBias, hasPageToken: !!pageToken });
    const result = await textSearch({
        textQuery,
        includedType: includedType || undefined,
        pageSize: effectivePageSize,
        pageToken: pageToken || undefined,
        locationBias,
    });

    const rawCount = result.places?.length ?? 0;
    if (result.places) {
        result.places = filterPlaces(result.places, hasWebsite, hasPhone).slice(0, effectivePageSize);
    }
    const finalCount = result.places?.length ?? 0;
    logger.info('Search: Google Places response', { rawCount, afterFilter: finalCount, hasWebsite: hasWebsite ?? null, hasPhone: hasPhone ?? null });

    if (result.places && result.places.length > 0) {
        recordUsageEvent({
            workspaceId: activeWorkspace.id,
            userId,
            type: 'GOOGLE_PLACES_SEARCH',
            quantity: 1,
        });

        syncLeads(result.places).catch((err) =>
            logger.error('Background sync error', {
                error: err instanceof Error ? err.message : 'Unknown',
            })
        );

        await prisma.$transaction([
            prisma.workspace.update({
                where: { id: activeWorkspace.id },
                data: { leadsUsed: { increment: 1 } },
            }),
            prisma.searchHistory.create({
                data: {
                    workspaceId: activeWorkspace.id,
                    userId,
                    textQuery,
                    pageSize: effectivePageSize,
                    filters: filtersPayload,
                    resultsCount: result.places.length,
                    resultsData: JSON.parse(JSON.stringify(result.places)),
                },
            }),
        ]);
    }

    logger.info('Search: result', { resultCount: finalCount });
    return result;
}

/** Max places to fetch in one runSearchAllPages call (intelligence modules). */
export const SEARCH_ALL_PAGES_MAX_PLACES = 60;

export interface SearchAllPagesResult {
    places: unknown[];
    totalFetched: number;
}

/**
 * Fetch multiple pages of search results (up to maxPlaces) for intelligence modules.
 * Uses a single usage credit regardless of how many API pages are fetched.
 */
export async function runSearchAllPages(
    input: SearchInput,
    userId: string,
    maxPlaces: number
): Promise<SearchAllPagesResult> {
    const { textQuery, includedType, hasWebsite, hasPhone, city, state, country, radiusKm } = input;
    const effectiveMax = Math.min(maxPlaces, SEARCH_ALL_PAGES_MAX_PLACES);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            onboardingCompletedAt: true,
            workspaces: { include: { workspace: true }, take: 1 },
        },
    });

    if (!user || user.workspaces.length === 0) {
        throw new SearchHttpError(404, { error: 'Workspace not found' });
    }

    if (user.onboardingCompletedAt == null) {
        throw new SearchHttpError(403, {
            error: 'Complete onboarding before searching',
            code: 'REQUIRES_ONBOARDING',
        });
    }

    const activeWorkspace = user.workspaces[0].workspace;

    if (activeWorkspace.leadsUsed >= activeWorkspace.leadsLimit) {
        throw new SearchHttpError(403, {
            error: 'Limit reached',
            code: 'LIMIT_EXCEEDED',
            limit: activeWorkspace.leadsLimit,
            used: activeWorkspace.leadsUsed,
        });
    }

    let locationBias: { center: { latitude: number; longitude: number }; radius: number } | undefined;
    const cityTrim = city?.trim();
    if (cityTrim) {
        const coords = await geocodeAddress(cityTrim, state ?? null, country ?? 'Brasil');
        if (coords) {
            const radiusKmNum = radiusKm ?? DEFAULT_LOCATION_RADIUS_KM;
            const radiusM = Math.min(
                MAX_LOCATION_RADIUS_M,
                Math.round(radiusKmNum * RADIUS_KM_TO_M) || Math.round(DEFAULT_LOCATION_RADIUS_KM * RADIUS_KM_TO_M)
            );
            locationBias = { center: coords, radius: radiusM };
            logger.info('SearchAllPages: locationBias applied', { city: cityTrim, radiusM });
        }
    }

    logger.info('SearchAllPages: fetching up to N places', { textQuery, effectiveMax });
    const { places: rawPlaces } = await textSearchAllPages({
        textQuery,
        includedType: includedType || undefined,
        locationBias,
        maxPlaces: effectiveMax,
    });

    const places = filterPlaces(rawPlaces, hasWebsite, hasPhone).slice(0, effectiveMax);
    const totalFetched = places.length;

    if (places.length > 0) {
        recordUsageEvent({
            workspaceId: activeWorkspace.id,
            userId,
            type: 'GOOGLE_PLACES_SEARCH',
            quantity: 1,
        });

        syncLeads(places).catch((err) =>
            logger.error('Background sync error', {
                error: err instanceof Error ? err.message : 'Unknown',
            })
        );

        const filtersPayload = {
            includedType: includedType ?? null,
            hasWebsite: hasWebsite ?? null,
            hasPhone: hasPhone ?? null,
        };

        await prisma.$transaction([
            prisma.workspace.update({
                where: { id: activeWorkspace.id },
                data: { leadsUsed: { increment: 1 } },
            }),
            prisma.searchHistory.create({
                data: {
                    workspaceId: activeWorkspace.id,
                    userId,
                    textQuery,
                    pageSize: effectiveMax,
                    filters: filtersPayload,
                    resultsCount: totalFetched,
                    resultsData: JSON.parse(JSON.stringify(places)),
                },
            }),
        ]);
    }

    logger.info('SearchAllPages: result', { totalFetched });
    return { places, totalFetched };
}
