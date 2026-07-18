import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import { acquireRedisLock, getCached, releaseRedisLock, setCached, waitForCached } from '@/lib/redis';
import { enqueueLeadSync } from '@/lib/lead-sync-queue';
import { enqueueSearchHistoryWrite } from '@/lib/search-history-queue';
import { computeOpportunityScore } from '@/lib/db-sync';
import type { PlaceResult as GooglePlaceResult, TextSearchResponse } from '@/lib/google-places';
import { logger } from '@/lib/logger';
import { recordUsageEvent } from '@/lib/usage';
import { geocodeAddress } from '@/lib/geocode';
import { resolveCountryLocale } from '@/lib/country-locale';
import { PLACES_PAGE_SIZE_MAX } from '@/lib/google-places';
import { checkMemberLimits, MemberLimitExceededError } from '@/lib/team-credits';
import { applyTrialExpiryIfNeeded, assertWorkspaceCanUseProduct } from '@/lib/trial';
import type { SearchInput } from '@/lib/validations/schemas';
import type { SearchResult, PlaceResult, PlaceLike } from '../domain/types';
import {
    buildCacheKey,
    runCoalescedTextSearch,
    runCoalescedTextSearchAllPages,
    SEARCH_CACHE_TTL_SECONDS,
} from './search-cache';
import { crossWithReceitaIfEligible } from './search-rf-integration';
import { enrichMissingWebsitesWithSerper } from './search-enrichment';

const RADIUS_KM_TO_M = 1000;
const DEFAULT_LOCATION_RADIUS_KM = 15;
const MAX_LOCATION_RADIUS_M = 50000;
const NEXT_PAGE_TOKEN_DELAY_MS = 400;
const DB_LEAD_FRESHNESS_DAYS = 14;
const ASYNC_HISTORY_WRITES = String(process.env.SEARCH_HISTORY_ASYNC ?? 'true').toLowerCase() === 'true';
const SEARCH_USER_CONTEXT_CACHE_TTL_MS = Number.parseInt(process.env.SEARCH_USER_CONTEXT_CACHE_TTL_MS ?? '5000', 10);
const IS_TEST_ENV = process.env.NODE_ENV === 'test';
const SEARCH_DISTRIBUTED_LOCK_ENABLED = String(process.env.SEARCH_DISTRIBUTED_LOCK_ENABLED ?? 'true').toLowerCase() === 'true';
const SEARCH_LOCK_TTL_MS = Number.parseInt(process.env.SEARCH_LOCK_TTL_MS ?? '12000', 10);
const SEARCH_LOCK_WAIT_MS = Number.parseInt(process.env.SEARCH_LOCK_WAIT_MS ?? '2500', 10);
const SEARCH_LOCK_POLL_MS = Number.parseInt(process.env.SEARCH_LOCK_POLL_MS ?? '75', 10);

type PageTokenParam = string | undefined | null;
type FiltersPayload = { includedType: string | null; hasWebsite: string | null; hasPhone: string | null };
type LocationBias = { center: { latitude: number; longitude: number }; radius: number };
type SaveHistoryFn = (resultsCount: number, places?: PlaceResult[]) => Promise<void>;
type SearchUserContextCacheEntry = {
    expiresAt: number;
    context: {
        onboardingCompletedAt: Date | null;
        membership: {
            dailyLeadsLimit: number | null;
            weeklyLeadsLimit: number | null;
            monthlyLeadsLimit: number | null;
            workspace: {
                id: string;
                plan: string;
                leadsUsed: number;
                leadsLimit: number;
                subscriptionStatus: string | null;
                currentPeriodEnd: Date | null;
            };
        };
    };
};

const searchUserContextCache = new Map<string, SearchUserContextCacheEntry>();

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

function enrichWithOpportunityScore(places: PlaceResult[]): PlaceResult[] {
    return places
        .map((place) => {
            const { score } = computeOpportunityScore(place as GooglePlaceResult);
            return { ...place, opportunityScore: score };
        })
        .sort((a, b) => {
            const aScore = Number(a.opportunityScore ?? 0);
            const bScore = Number(b.opportunityScore ?? 0);
            return bScore - aScore;
        });
}

/** Strip non-digit chars for phone comparison (keeps only digits). */
function normalizePhoneForDedup(phone: string): string {
    return phone.replace(/\D/g, '');
}

/** Normalize website URL for deduplication. */
function normalizeWebsiteForDedup(url: string): string {
    try {
        const normalized = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
        const parsed = new URL(normalized);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        const path = parsed.pathname.replace(/\/+$/, '');
        return `${host}${path}`;
    } catch {
        return url.trim().toLowerCase();
    }
}

/**
 * Deduplicate contact values from multiple sources.
 * Keeps original (raw) values but removes duplicates based on a normalizer.
 * Returns unique raw values ordered by first occurrence.
 */
function deduplicateContacts(
    values: (string | null | undefined)[],
    normalizer: (v: string) => string,
): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const v of values) {
        const raw = v?.trim();
        if (!raw) continue;
        const norm = normalizer(raw);
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        result.push(raw);
    }
    return result;
}

function collectAllContacts(places: PlaceResult[]): PlaceResult[] {
    return places.map((p) => {
        const phones = p.phones?.length
            ? p.phones
            : deduplicateContacts([
                p.nationalPhoneNumber,
                p.internationalPhoneNumber,
                p.phone,
                p.recommendedPhone,
            ], normalizePhoneForDedup);

        const emails = p.emails?.length
            ? p.emails
            : deduplicateContacts([
                p.email,
                p.recommendedEmail,
            ], (v) => v.toLowerCase().trim());

        const websites = p.websites?.length
            ? p.websites
            : deduplicateContacts([
                p.websiteUri,
                p.website,
                p.recommendedWebsite,
            ], normalizeWebsiteForDedup);

        return { ...p, phones, emails, websites };
    });
}

async function getSearchUserAndWorkspaceOrThrow(userId: string) {
    const now = Date.now();
    const cached = IS_TEST_ENV ? undefined : searchUserContextCache.get(userId);
    const user = cached && cached.expiresAt > now
        ? {
            onboardingCompletedAt: cached.context.onboardingCompletedAt,
            workspaces: [cached.context.membership],
        }
        : await prisma.user.findUnique({
            where: { id: userId },
            select: {
                onboardingCompletedAt: true,
                workspaces: {
                    select: {
                        dailyLeadsLimit: true,
                        weeklyLeadsLimit: true,
                        monthlyLeadsLimit: true,
                        workspace: {
                            select: {
                                id: true,
                                plan: true,
                                leadsUsed: true,
                                leadsLimit: true,
                                subscriptionStatus: true,
                                currentPeriodEnd: true,
                            },
                        },
                    },
                    take: 1,
                },
            },
        });

    if (!IS_TEST_ENV && user?.workspaces?.[0]) {
        searchUserContextCache.set(userId, {
            expiresAt: now + Math.max(1000, SEARCH_USER_CONTEXT_CACHE_TTL_MS),
            context: {
                onboardingCompletedAt: user.onboardingCompletedAt,
                membership: user.workspaces[0],
            },
        });
    }

    if (!user || user.workspaces.length === 0) throw new SearchHttpError(404, { error: 'Workspace not found' });
    if (user.onboardingCompletedAt == null) {
        throw new SearchHttpError(403, { error: 'Complete onboarding before searching', code: 'REQUIRES_ONBOARDING' });
    }
    const membership = user.workspaces[0]!;
    const activeWorkspace = membership.workspace;
    await applyTrialExpiryIfNeeded(activeWorkspace.id);
    const trialGate = assertWorkspaceCanUseProduct(activeWorkspace);
    if (!trialGate.ok) {
        throw new SearchHttpError(403, {
            error: trialGate.message,
            code: trialGate.code,
        });
    }
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
    params: {
        workspaceId: string;
        userId: string;
        textQuery: string;
        includedType?: string | null;
        effectivePageSize: number;
        hasWebsite?: string | null;
        hasPhone?: string | null;
        city?: string | null;
        state?: string | null;
        country?: string | null;
    },
    saveHistory: SaveHistoryFn,
): Promise<SearchResult | null> {
    if (pageToken) return null;
    const { workspaceId, userId, textQuery, includedType, effectivePageSize, hasWebsite, hasPhone, city, state, country } = params;
    const cacheKey = buildCacheKey(textQuery, includedType, effectivePageSize, hasWebsite, hasPhone, city, state, country);
    const cached = await getCached<{ places: PlaceResult[]; nextPageToken?: string }>(cacheKey);
    const cachedCount = cached?.places?.length ?? 0;
    const minAcceptableFromCache = Math.min(5, effectivePageSize);
    if (cached?.places && cachedCount >= minAcceptableFromCache) {
        logger.info('Search: cache hit', { cachedCount });
        const crossedPlaces = await crossWithReceitaIfEligible(cached.places, textQuery, includedType, city, state, country);
        const unified = collectAllContacts(crossedPlaces);
        await saveHistory(unified.length, unified);
        return { ...cached, places: unified, fromCache: true };
    }
    if (cachedCount > 0) logger.info('Search: cache skipped (below minimum)', { cachedCount, minAcceptableFromCache });

    const freshnessDate = new Date();
    freshnessDate.setDate(freshnessDate.getDate() - DB_LEAD_FRESHNESS_DAYS);

    const dbWhereConditions: Record<string, unknown>[] = [
        { name: { contains: textQuery, mode: 'insensitive' } },
        { address: { contains: textQuery, mode: 'insensitive' } },
    ];

    const dbWhere: Record<string, unknown> = {
        OR: dbWhereConditions,
        lastSearchedAt: { gte: freshnessDate },
    };

    if (city?.trim()) {
        dbWhere.address = { contains: city.trim(), mode: 'insensitive' };
    } else if (state?.trim() && state !== 'Todos') {
        dbWhere.address = { contains: state.trim(), mode: 'insensitive' };
    }

    if (includedType?.trim()) {
        dbWhere.types = { array_contains: [includedType.trim()] };
    }

    if (hasWebsite === 'yes') dbWhere.website = { not: null };
    if (hasWebsite === 'no') dbWhere.website = null;
    if (hasPhone === 'yes') dbWhere.phone = { not: null };
    if (hasPhone === 'no') dbWhere.phone = null;

    const dbLeads = await prisma.lead.findMany({
        where: dbWhere,
        take: effectivePageSize + 5,
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
        nationalPhoneNumber: l.recommendedPhone ?? l.phone ?? undefined,
        websiteUri: l.recommendedWebsite ?? l.website ?? undefined,
        email: l.recommendedEmail ?? l.email ?? undefined,
        cnpj: l.cnpj ?? undefined,
        companyLegalName: l.companyLegalName ?? undefined,
        companyTradeName: l.companyTradeName ?? undefined,
        cnpjStatus: l.cnpjStatus ?? undefined,
        rating: l.rating ?? undefined,
        userRatingCount: l.reviewCount ?? undefined,
        types: (l.types as string[] | null) ?? undefined,
        businessStatus: l.businessStatus ?? undefined,
        opportunityScore: l.opportunityScore ?? undefined,
        recommendedPhone: l.recommendedPhone ?? undefined,
        recommendedEmail: l.recommendedEmail ?? undefined,
        recommendedWebsite: l.recommendedWebsite ?? undefined,
        contactsHealthScore: l.contactsHealthScore ?? undefined,
    }));
    const slice = enrichWithOpportunityScore(mapped).slice(0, effectivePageSize);
    logger.info('Search: local DB used', { dbTotal: dbLeads.length, returned: slice.length });
    const crossedPlaces = await crossWithReceitaIfEligible(slice, textQuery, includedType, city, state, country);
    const unified = collectAllContacts(crossedPlaces);
    await saveHistory(unified.length, unified);
    return { places: unified, fromLocalDb: true };
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
    enqueueLeadSync(places as GooglePlaceResult[]);

    const scopedCacheKey = buildCacheKey(
        textQuery,
        filters.includedType,
        pageSize,
        filters.hasWebsite,
        filters.hasPhone,
        location?.city,
        location?.state,
        location?.country,
    );
    setCached(scopedCacheKey, { places }, SEARCH_CACHE_TTL_SECONDS).catch(() => {});

    await prisma.workspace.update({
        where: { id: activeWorkspace.id },
        data: { leadsUsed: { increment: 1 } },
    });
    import('@/lib/credit-alerts').then(({ maybeSendLowCreditsAlert }) => maybeSendLowCreditsAlert(activeWorkspace.id)).catch(() => {});

    enqueueSearchHistoryWrite({
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
    });
}

async function resolveSearchLocationBias(
    cityTrim: string | undefined,
    _pageToken: PageTokenParam,
    state: string | undefined | null,
    country: string | undefined | null,
    radiusKm: number | undefined | null,
): Promise<LocationBias | undefined> {
    const stateTrim = state?.trim();
    const hasState = Boolean(stateTrim && stateTrim !== 'Todos');
    const geoCity = cityTrim && cityTrim.length > 0 ? cityTrim : (hasState ? stateTrim : undefined);
    if (!geoCity) return undefined;
    const geoState = cityTrim ? (hasState ? stateTrim : null) : null;
    const coords = await geocodeAddress(geoCity, geoState, country ?? 'Brasil');
    if (!coords) {
        logger.info('Search: geocode failed, no locationBias', { city: cityTrim, state: stateTrim, country: country ?? 'Brasil' });
        return undefined;
    }
    const isStateOnly = !cityTrim && hasState;
    const radiusKmNum = isStateOnly ? (MAX_LOCATION_RADIUS_M / RADIUS_KM_TO_M) : (radiusKm ?? DEFAULT_LOCATION_RADIUS_KM);
    const radiusM = Math.min(
        MAX_LOCATION_RADIUS_M,
        Math.round(radiusKmNum * RADIUS_KM_TO_M) || Math.round(DEFAULT_LOCATION_RADIUS_KM * RADIUS_KM_TO_M)
    );
    logger.info('Search: locationBias applied', { city: cityTrim ?? null, state: stateTrim ?? null, country: country ?? 'Brasil', radiusKm: radiusKmNum, radiusM });
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
        const payload = {
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
        };

        if (ASYNC_HISTORY_WRITES) {
            enqueueSearchHistoryWrite(payload);
            return;
        }

        await prisma.searchHistory.create({ data: payload }).catch((err) =>
            logger.error('SearchHistory create error', {
                error: err instanceof Error ? err.message : 'Unknown',
            })
        );
    };
}

async function executeGoogleSearchAndPersist(
    input: { textQuery: string; includedType: string | null; pageToken: string | undefined; hasWebsite: string | null; hasPhone: string | null; effectivePageSize: number; bypassDbAndRf?: boolean },
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
    const cacheKey = buildCacheKey(
        input.textQuery,
        input.includedType,
        input.effectivePageSize,
        input.hasWebsite,
        input.hasPhone,
        location?.city,
        location?.state,
        location?.country,
    );
    const lockKey = `search-lock:${cacheKey}`;
    const lockToken = randomUUID();
    const shouldUseDistributedLock = SEARCH_DISTRIBUTED_LOCK_ENABLED && !input.pageToken;
    let lockAcquired = false;

    if (shouldUseDistributedLock) {
        lockAcquired = await acquireRedisLock(lockKey, lockToken, SEARCH_LOCK_TTL_MS);
        if (!lockAcquired) {
            const peerCached = await waitForCached<{ places: PlaceResult[]; nextPageToken?: string }>(
                cacheKey,
                SEARCH_LOCK_WAIT_MS,
                SEARCH_LOCK_POLL_MS,
            );
            const peerCachedCount = peerCached?.places?.length ?? 0;
            const minAcceptableFromCache = Math.min(5, input.effectivePageSize);
            if (peerCached?.places && peerCachedCount >= minAcceptableFromCache) {
                logger.info('Search: distributed cache hit after lock wait', { peerCachedCount });
                await persistUnifiedSearchResult(
                    activeWorkspace,
                    userId,
                    peerCached.places,
                    input.textQuery,
                    input.effectivePageSize,
                    filtersPayload,
                    peerCachedCount,
                    location,
                );
                return {
                    places: await hydratePlacesWithLeadSnapshot(peerCached.places),
                    nextPageToken: peerCached.nextPageToken,
                    fromCache: true,
                };
            }
        }
    }

    logger.info('Search: calling Google Places API', {
        textQuery: input.textQuery,
        includedType: input.includedType,
        hasLocationBias: !!locationBias,
        hasPageToken: !!input.pageToken,
        regionCode: locale.regionCode,
        languageCode: locale.languageCode,
    });
    const result = await runCoalescedTextSearch(input, locationBias, locale)
        .catch((err: unknown) => {
            if (err instanceof Error && err.message === 'SEARCH_BULKHEAD_TIMEOUT') {
                throw new SearchHttpError(503, {
                    error: 'Search is busy, please retry in a few seconds',
                    code: 'SEARCH_BUSY',
                });
            }
            throw err;
        })
        .finally(async () => {
            if (shouldUseDistributedLock && lockAcquired) {
                await releaseRedisLock(lockKey, lockToken);
            }
        });
    const rawCount = result.places?.length ?? 0;
    if (result.places) {
        const googlePlaces = enrichWithOpportunityScore(
            filterPlaces(result.places, input.hasWebsite, input.hasPhone).slice(0, input.effectivePageSize)
        );

        if (!input.pageToken) {
            if (input.bypassDbAndRf) {
                logger.info('Search: skipping RF cross due to bypass flag');
                result.places = collectAllContacts(googlePlaces) as GooglePlaceResult[];
            } else {
                const crossed = await crossWithReceitaIfEligible(
                    googlePlaces,
                    input.textQuery,
                    input.includedType,
                    location?.city,
                    location?.state,
                    country,
                );
                result.places = collectAllContacts(crossed) as GooglePlaceResult[];
            }
        } else {
            result.places = googlePlaces as GooglePlaceResult[];
        }
    }
    const finalCount = result.places?.length ?? 0;
    logger.info('Search: Google Places response', {
        rawCount,
        afterFilter: finalCount,
        hasWebsite: input.hasWebsite,
        hasPhone: input.hasPhone,
    });
    if (result.places && result.places.length > 0) {
        await persistUnifiedSearchResult(
            activeWorkspace,
            userId,
            result.places,
            input.textQuery,
            input.effectivePageSize,
            filtersPayload,
            result.places.length,
            location,
        );
        result.places = await hydratePlacesWithLeadSnapshot(result.places) as GooglePlaceResult[];
    }
    logger.info('Search: result', { resultCount: finalCount });
    return result;
}

export async function runSearch(input: SearchInput, userId: string): Promise<SearchResult> {
    const { textQuery, includedType, pageSize, pageToken, hasWebsite, hasPhone, city, state, country, radiusKm, bypassDbAndRf } = input;
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
        city: city ?? null,
        state: state ?? null,
        country: country ?? null,
    });

    const { activeWorkspace } = await getSearchUserAndWorkspaceOrThrow(userId);
    const locationInfo = { city: city ?? null, state: state ?? null, country: country ?? null };
    const saveHistory = createSaveHistoryForSearch(activeWorkspace, userId, textQuery, effectivePageSize, filtersPayload, locationInfo);

    if (!bypassDbAndRf) {
        const earlyResult = await tryCacheOrDbSearch(
            pageToken,
            { workspaceId: activeWorkspace.id, userId, textQuery, includedType, effectivePageSize, hasWebsite, hasPhone, city, state, country },
            saveHistory,
        );
        if (earlyResult) return earlyResult;
    } else {
        logger.info('Search: skipping local DB search due to bypass flag');
    }

    const locationBias = await resolveSearchLocationBias(city?.trim(), pageToken, state, country, radiusKm);
    return executeGoogleSearchAndPersist(
        {
            textQuery,
            includedType: includedType ?? null,
            pageToken: pageToken ?? undefined,
            hasWebsite: hasWebsite ?? null,
            hasPhone: hasPhone ?? null,
            effectivePageSize,
            bypassDbAndRf,
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

    const { activeWorkspace } = await getSearchUserAndWorkspaceOrThrow(userId);

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
    const { places: rawPlaces } = await runCoalescedTextSearchAllPages(input, effectiveMax, locationBias, locale).catch((err: unknown) => {
        if (err instanceof Error && err.message === 'SEARCH_BULKHEAD_TIMEOUT') {
            throw new SearchHttpError(503, {
                error: 'Search is busy, please retry in a few seconds',
                code: 'SEARCH_BUSY',
            });
        }
        throw err;
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
    const hydratedPlaces = await hydratePlacesWithLeadSnapshot(places);
    return { places: hydratedPlaces, totalFetched };
}

async function hydratePlacesWithLeadSnapshot(places: PlaceResult[]): Promise<PlaceResult[]> {
    if (places.length === 0) return places;

    const placeIds = places.map((place) => place.id).filter(Boolean);
    if (placeIds.length === 0) return places;

    const leads = await prisma.lead.findMany({
        where: { placeId: { in: placeIds } },
        select: {
            placeId: true,
            phone: true,
            email: true,
            website: true,
            recommendedPhone: true,
            recommendedEmail: true,
            recommendedWebsite: true,
            contactsHealthScore: true,
        },
    });

    const byPlaceId = new Map(leads.map((lead) => [lead.placeId, lead]));

    return places.map((place) => {
        const snapshot = byPlaceId.get(place.id);
        if (!snapshot) return place;

        return {
            ...place,
            nationalPhoneNumber:
                snapshot.recommendedPhone
                ?? place.nationalPhoneNumber
                ?? place.internationalPhoneNumber
                ?? snapshot.phone
                ?? undefined,
            websiteUri:
                snapshot.recommendedWebsite
                ?? place.websiteUri
                ?? snapshot.website
                ?? undefined,
            email: snapshot.recommendedEmail ?? snapshot.email ?? undefined,
            recommendedPhone: snapshot.recommendedPhone ?? undefined,
            recommendedEmail: snapshot.recommendedEmail ?? undefined,
            recommendedWebsite: snapshot.recommendedWebsite ?? undefined,
            contactsHealthScore: snapshot.contactsHealthScore ?? undefined,
            phones: deduplicateContacts([
                ...(place.phones ?? []),
                snapshot.recommendedPhone,
                snapshot.phone,
                place.nationalPhoneNumber,
                place.internationalPhoneNumber,
            ], normalizePhoneForDedup),
            emails: deduplicateContacts([
                ...(place.emails ?? []),
                snapshot.recommendedEmail,
                snapshot.email,
                place.email,
            ], (v) => v.toLowerCase().trim()),
            websites: deduplicateContacts([
                ...(place.websites ?? []),
                snapshot.recommendedWebsite,
                snapshot.website,
                place.websiteUri,
            ], normalizeWebsiteForDedup),
        };
    });
}
