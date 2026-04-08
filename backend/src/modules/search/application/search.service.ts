/**
 * Search module — application layer (use-case).
 * Orchestrates cache, DB, external API, history and usage.
 * Route (api) only validates, authenticates and calls runSearch.
 */

import { prisma } from '@/lib/prisma';
import { checkMemberLimits, MemberLimitExceededError } from '@/lib/team-credits';
import { textSearch, textSearchAllPages, PLACES_PAGE_SIZE_MAX, type PlaceResult } from '@/lib/google-places';
import { geocodeAddress } from '@/lib/geocode';
import { resolveCountryLocale } from '@/lib/country-locale';
import { getCached, setCached } from '@/lib/redis';
import { syncLeads } from '@/lib/db-sync';
import { computeOpportunityScore } from '@/lib/db-sync';
import { logger } from '@/lib/logger';
import { recordUsageEvent } from '@/lib/usage';
import type { SearchInput } from '@/lib/validations/schemas';
import type { SearchResult, PlaceLike } from '../domain/types';

/** UI sempre em km; conversão para metros só na chamada à API (locationBias.radius). */
const RADIUS_KM_TO_M = 1000;

type SaveHistoryFn = (resultsCount: number, places?: PlaceResult[]) => Promise<void>;

/** Page token from request (optional or null). */
type PageTokenParam = string | undefined | null;

type TryCacheOrDbSearchParams = {
    textQuery: string;
    includedType?: string | null;
    effectivePageSize: number;
    hasWebsite?: string | null;
    hasPhone?: string | null;
    city?: string | null;
};

type ExecuteSearchInput = {
    textQuery: string;
    includedType: string | null;
    pageToken: string | undefined;
    hasWebsite: string | null;
    hasPhone: string | null;
    effectivePageSize: number;
};

type LocationBias = { center: { latitude: number; longitude: number }; radius: number };
type FiltersPayload = { includedType: string | null; hasWebsite: string | null; hasPhone: string | null };

const DEFAULT_LOCATION_RADIUS_KM = 15;
/** Places API locationBias circle max radius (meters) = 50km */
const MAX_LOCATION_RADIUS_M = 50000;
/** Delay antes de usar nextPageToken (API pode rejeitar ou repetir se imediato). */
const NEXT_PAGE_TOKEN_DELAY_MS = 400;
/** Cache TTL for search results (5 minutes). */
const SEARCH_CACHE_TTL_SECONDS = 300;
/** Max age in days for DB lead fallback to be considered fresh. */
const DB_LEAD_FRESHNESS_DAYS = 14;

function enrichWithOpportunityScore(places: PlaceResult[]): PlaceResult[] {
    return places
        .map((place) => {
            const { score } = computeOpportunityScore(place);
            return { ...place, opportunityScore: score } as PlaceResult;
        })
        .sort((a, b) => {
            const aScore = Number((a as PlaceResult & { opportunityScore?: number }).opportunityScore ?? 0);
            const bScore = Number((b as PlaceResult & { opportunityScore?: number }).opportunityScore ?? 0);
            return bScore - aScore;
        });
}

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

async function getSearchUserAndWorkspaceOrThrow(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            onboardingCompletedAt: true,
            workspaces: {
                include: { workspace: true },
                take: 1,
            },
        },
    });
    if (!user || user.workspaces.length === 0) throw new SearchHttpError(404, { error: 'Workspace not found' });
    if (user.onboardingCompletedAt == null) {
        throw new SearchHttpError(403, { error: 'Complete onboarding before searching', code: 'REQUIRES_ONBOARDING' });
    }
    const membership = user.workspaces[0];
    const activeWorkspace = membership.workspace;
    if (activeWorkspace.leadsUsed >= activeWorkspace.leadsLimit) {
        throw new SearchHttpError(403, {
            error: 'Limit reached',
            code: 'LIMIT_EXCEEDED',
            limit: activeWorkspace.leadsLimit,
            used: activeWorkspace.leadsUsed,
        });
    }
    try {
        await checkMemberLimits(
            prisma,
            {
                dailyLeadsLimit: membership.dailyLeadsLimit,
                weeklyLeadsLimit: membership.weeklyLeadsLimit,
                monthlyLeadsLimit: membership.monthlyLeadsLimit,
            },
            activeWorkspace.id,
            userId,
        );
    } catch (err) {
        if (err instanceof MemberLimitExceededError) {
            throw new SearchHttpError(403, {
                error: err.message,
                code: err.code,
                period: err.period,
                used: err.used,
                limit: err.limit,
            });
        }
        throw err;
    }
    return { activeWorkspace };
}

async function tryCacheOrDbSearch(
    pageToken: PageTokenParam,
    params: TryCacheOrDbSearchParams,
    saveHistory: SaveHistoryFn,
): Promise<SearchResult | null> {
    if (pageToken) return null;
    const { textQuery, includedType, effectivePageSize, hasWebsite, hasPhone, city } = params;
    const cacheKey = buildCacheKey(textQuery, includedType, effectivePageSize, hasWebsite, hasPhone, city);
    const cached = await getCached<{ places: PlaceResult[]; nextPageToken?: string }>(cacheKey);
    const cachedCount = cached?.places?.length ?? 0;
    const minAcceptableFromCache = Math.min(5, effectivePageSize);
    if (cached?.places && cachedCount >= minAcceptableFromCache) {
        logger.info('Search: cache hit', { cachedCount });
        await saveHistory(cachedCount, cached.places);
        return { ...cached, fromCache: true };
    }
    if (cachedCount > 0) logger.info('Search: cache skipped (below minimum)', { cachedCount, minAcceptableFromCache });

    // Build smarter DB query: filter by city in address if available, freshness check
    const freshnessDate = new Date();
    freshnessDate.setDate(freshnessDate.getDate() - DB_LEAD_FRESHNESS_DAYS);

    const dbWhereConditions: Record<string, unknown>[] = [
        { name: { contains: textQuery, mode: 'insensitive' } },
        { address: { contains: textQuery, mode: 'insensitive' } },
    ];

    // Build the where clause with optional city filter and freshness
    const dbWhere: Record<string, unknown> = {
        OR: dbWhereConditions,
        lastSearchedAt: { gte: freshnessDate },
    };

    // If city is provided, also require city in address for relevance
    if (city?.trim()) {
        dbWhere.address = { contains: city.trim(), mode: 'insensitive' };
    }

    // Filter by includedType in the DB query to avoid category mismatch
    if (includedType?.trim()) {
        dbWhere.types = { array_contains: [includedType.trim()] };
    }

    // Push hasWebsite/hasPhone filters to the DB query instead of filtering in-memory
    if (hasWebsite === 'yes') dbWhere.website = { not: null };
    if (hasWebsite === 'no') dbWhere.website = null;
    if (hasPhone === 'yes') dbWhere.phone = { not: null };
    if (hasPhone === 'no') dbWhere.phone = null;

    const dbLeads = await prisma.lead.findMany({
        where: dbWhere,
        take: effectivePageSize + 5, // slight overfetch to check if enough
        orderBy: { lastSearchedAt: 'desc' },
    });
    if (dbLeads.length < 5) {
        logger.info('Search: local DB skip', { dbLeadsCount: dbLeads.length });
        return null;
    }
    const mapped: PlaceResult[] = dbLeads.map((l) => ({
        id: l.placeId,
        displayName: { text: l.name, languageCode: 'pt-BR' },
        formattedAddress: l.address ?? undefined,
        nationalPhoneNumber: l.phone ?? undefined,
        websiteUri: l.website ?? undefined,
        cnpj: l.cnpj ?? undefined,
        companyLegalName: l.companyLegalName ?? undefined,
        companyTradeName: l.companyTradeName ?? undefined,
        cnpjStatus: l.cnpjStatus ?? undefined,
        rating: l.rating ?? undefined,
        userRatingCount: l.reviewCount ?? undefined,
        types: (l.types as string[] | null) ?? undefined,
        businessStatus: l.businessStatus ?? undefined,
        opportunityScore: l.opportunityScore ?? undefined,
    }));
    const slice = enrichWithOpportunityScore(mapped).slice(0, effectivePageSize);
    logger.info('Search: local DB used', { dbTotal: dbLeads.length, returned: slice.length });
    await saveHistory(slice.length, slice);
    return { places: slice, fromLocalDb: true };
}

/** Build a deterministic cache key for search results (includes city for location correctness). */
function buildCacheKey(
    textQuery: string,
    includedType?: string | null,
    pageSize?: number,
    hasWebsite?: string | null,
    hasPhone?: string | null,
    city?: string | null,
): string {
    const c = (city ?? '').toLowerCase().trim();
    return `search:${textQuery.toLowerCase().trim()}:${includedType || ''}:${pageSize || 20}:${hasWebsite || 'any'}:${hasPhone || 'any'}:${c}`;
}

async function persistUnifiedSearchResult(
    activeWorkspace: { id: string },
    userId: string,
    places: PlaceResult[],
    textQuery: string,
    pageSize: number,
    filters: FiltersPayload,
    resultsCount: number,
    location?: { city?: string | null; state?: string | null; country?: string | null },
): Promise<void> {
    recordUsageEvent({
        workspaceId: activeWorkspace.id,
        userId,
        type: 'GOOGLE_PLACES_SEARCH',
        quantity: 1,
    });
    syncLeads(places).catch((err) =>
        logger.error('Background sync error', { error: err instanceof Error ? err.message : 'Unknown' })
    );

    // Write-through cache: store results for subsequent identical queries
    const cacheKey = buildCacheKey(textQuery, filters.includedType, pageSize, filters.hasWebsite, filters.hasPhone, location?.city);
    setCached(cacheKey, { places }, SEARCH_CACHE_TTL_SECONDS).catch(() => { /* cache is optional */ });

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
                pageSize,
                filters,
                resultsCount,
                resultsData: JSON.parse(JSON.stringify(places)),
                city: location?.city?.trim() || null,
                state: location?.state?.trim() || null,
                country: location?.country?.trim() || null,
            },
        }),
    ]);
}

async function resolveSearchLocationBias(
    cityTrim: string | undefined,
    pageToken: PageTokenParam,
    state: string | undefined | null,
    country: string | undefined | null,
    radiusKm: number | undefined | null,
): Promise<LocationBias | undefined> {
    if (!cityTrim || pageToken) return undefined;
    const coords = await geocodeAddress(cityTrim, state ?? null, country ?? 'Brasil');
    if (!coords) {
        logger.info('Search: geocode failed, no locationBias', { city: cityTrim });
        return undefined;
    }
    const radiusKmNum = radiusKm ?? DEFAULT_LOCATION_RADIUS_KM;
    const radiusM = Math.min(
        MAX_LOCATION_RADIUS_M,
        Math.round(radiusKmNum * RADIUS_KM_TO_M) || Math.round(DEFAULT_LOCATION_RADIUS_KM * RADIUS_KM_TO_M)
    );
    logger.info('Search: locationBias applied', { city: cityTrim, radiusKm: radiusKmNum, radiusM });
    return { center: coords, radius: radiusM };
}

function createSaveHistoryForSearch(
    activeWorkspace: { id: string },
    userId: string,
    textQuery: string,
    effectivePageSize: number,
    filtersPayload: FiltersPayload,
    location?: { city?: string | null; state?: string | null; country?: string | null },
): SaveHistoryFn {
    return async (resultsCount: number, places?: PlaceResult[]): Promise<void> => {
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
                    city: location?.city?.trim() || null,
                    state: location?.state?.trim() || null,
                    country: location?.country?.trim() || null,
                },
            })
            .catch((err) =>
                logger.error('SearchHistory create error', {
                    error: err instanceof Error ? err.message : 'Unknown',
                })
            );
    };
}

async function executeGoogleSearchAndPersist(
    input: ExecuteSearchInput,
    locationBias: LocationBias | undefined,
    activeWorkspace: { id: string },
    userId: string,
    filtersPayload: FiltersPayload,
    country?: string | null,
    location?: { city?: string | null; state?: string | null; country?: string | null },
): Promise<SearchResult> {
    if (input.pageToken) {
        await new Promise((r) => setTimeout(r, NEXT_PAGE_TOKEN_DELAY_MS));
    }
    const locale = resolveCountryLocale(country);
    logger.info('Search: calling Google Places API', {
        textQuery: input.textQuery,
        includedType: input.includedType,
        hasLocationBias: !!locationBias,
        hasPageToken: !!input.pageToken,
        regionCode: locale.regionCode,
        languageCode: locale.languageCode,
    });
    const result = await textSearch({
        textQuery: input.textQuery,
        includedType: input.includedType || undefined,
        pageSize: input.effectivePageSize,
        pageToken: input.pageToken || undefined,
        locationBias,
        languageCode: locale.languageCode,
        regionCode: locale.regionCode,
    });
    const rawCount = result.places?.length ?? 0;
    if (result.places) {
        result.places = enrichWithOpportunityScore(
            filterPlaces(result.places, input.hasWebsite, input.hasPhone).slice(0, input.effectivePageSize)
        );
    }
    const finalCount = result.places?.length ?? 0;
    logger.info('Search: Google Places response', {
        rawCount,
        afterFilter: finalCount,
        hasWebsite: input.hasWebsite,
        hasPhone: input.hasPhone,
    });
    if (result.places && result.places.length > 0) {
        await persistUnifiedSearchResult(activeWorkspace, userId, result.places, input.textQuery, input.effectivePageSize, filtersPayload, result.places.length, location);
    }
    logger.info('Search: result', { resultCount: finalCount });
    return result;
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

    const { activeWorkspace } = await getSearchUserAndWorkspaceOrThrow(userId);
    const locationInfo = { city: city ?? null, state: state ?? null, country: country ?? null };
    const saveHistory = createSaveHistoryForSearch(activeWorkspace, userId, textQuery, effectivePageSize, filtersPayload, locationInfo);

    const earlyResult = await tryCacheOrDbSearch(
        pageToken,
        { textQuery, includedType, effectivePageSize, hasWebsite, hasPhone, city },
        saveHistory,
    );
    if (earlyResult) return earlyResult;

    const locationBias = await resolveSearchLocationBias(city?.trim(), pageToken, state, country, radiusKm);
    return executeGoogleSearchAndPersist(
        {
            textQuery,
            includedType: includedType ?? null,
            pageToken: pageToken ?? undefined,
            hasWebsite: hasWebsite ?? null,
            hasPhone: hasPhone ?? null,
            effectivePageSize,
        },
        locationBias,
        activeWorkspace,
        userId,
        filtersPayload,
        country,
        locationInfo,
    );
}

/** Max places to fetch in one runSearchAllPages call (intelligence modules). */
export const SEARCH_ALL_PAGES_MAX_PLACES = 60;

export interface SearchAllPagesResult {
    places: PlaceResult[];
    totalFetched: number;
}

async function getSearchAllPagesUserAndWorkspaceOrThrow(userId: string) {
    const { activeWorkspace } = await getSearchUserAndWorkspaceOrThrow(userId);
    return { activeWorkspace };
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

    const { activeWorkspace } = await getSearchAllPagesUserAndWorkspaceOrThrow(userId);

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

    const locale = resolveCountryLocale(country);

    logger.info('SearchAllPages: fetching up to N places', { textQuery, effectiveMax, regionCode: locale.regionCode });
    const { places: rawPlaces } = await textSearchAllPages({
        textQuery,
        includedType: includedType || undefined,
        locationBias,
        maxPlaces: effectiveMax,
        languageCode: locale.languageCode,
        regionCode: locale.regionCode,
    });

    const places = filterPlaces(rawPlaces, hasWebsite, hasPhone).slice(0, effectiveMax);
    const totalFetched = places.length;

    if (places.length > 0) {
        await persistUnifiedSearchResult(
            activeWorkspace,
            userId,
            places,
            textQuery,
            effectiveMax,
            { includedType: includedType ?? null, hasWebsite: hasWebsite ?? null, hasPhone: hasPhone ?? null },
            totalFetched
        );
    }

    logger.info('SearchAllPages: result', { totalFetched });
    return { places, totalFetched };
}
