import { textSearch, textSearchAllPages } from '@/lib/google-places';
import { withSearchBulkhead } from '@/lib/search-bulkhead';
import { logger } from '@/lib/logger';
import type { PlaceResult } from '../domain/types';

export const SEARCH_CACHE_TTL_SECONDS = 300;

type GoogleTextSearchResult = Awaited<ReturnType<typeof textSearch>>;
type GoogleTextSearchAllPagesResult = Awaited<ReturnType<typeof textSearchAllPages>>;

type LocationBias = { center: { latitude: number; longitude: number }; radius: number };

export const inFlightGoogleTextSearch = new Map<string, Promise<GoogleTextSearchResult>>();
export const inFlightGoogleTextSearchAllPages = new Map<string, Promise<GoogleTextSearchAllPagesResult>>();

export function cloneJson<T>(value: T): T {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value)) as T;
}

export function stringifyLocationBias(locationBias: LocationBias | undefined): string {
    if (!locationBias) return 'none';
    return [
        locationBias.center.latitude.toFixed(6),
        locationBias.center.longitude.toFixed(6),
        String(locationBias.radius),
    ].join(':');
}

export function normalizeSearchKeyPart(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

export function buildCacheKey(
    textQuery: string,
    includedType?: string | null,
    pageSize?: number,
    hasWebsite?: string | null,
    hasPhone?: string | null,
    city?: string | null,
    state?: string | null,
    country?: string | null,
): string {
    const c = (city ?? '').toLowerCase().trim();
    const s = (state ?? '').toLowerCase().trim();
    const k = (country ?? '').toLowerCase().trim();
    return `search:${textQuery.toLowerCase().trim()}:${includedType || ''}:${pageSize || 20}:${hasWebsite || 'any'}:${hasPhone || 'any'}:${c}:${s}:${k}`;
}

function buildTextSearchDedupKey(
    input: { textQuery: string; includedType: string | null; effectivePageSize: number; pageToken: string | undefined; hasWebsite: string | null; hasPhone: string | null },
    locationBias: LocationBias | undefined,
    locale: { languageCode: string; regionCode: string },
): string {
    return [
        normalizeSearchKeyPart(input.textQuery),
        normalizeSearchKeyPart(input.includedType),
        String(input.effectivePageSize),
        normalizeSearchKeyPart(input.pageToken),
        stringifyLocationBias(locationBias),
        locale.languageCode,
        locale.regionCode,
    ].join('|');
}

function buildTextSearchAllPagesDedupKey(
    input: { textQuery: string; includedType?: string | null; pageSize?: number; hasWebsite?: string | null; hasPhone?: string | null; city?: string | null; state?: string | null; country?: string | null; radiusKm?: number | null },
    effectiveMax: number,
    locationBias: LocationBias | undefined,
    locale: { languageCode: string; regionCode: string },
): string {
    return [
        normalizeSearchKeyPart(input.textQuery),
        normalizeSearchKeyPart(input.includedType),
        String(effectiveMax),
        stringifyLocationBias(locationBias),
        locale.languageCode,
        locale.regionCode,
    ].join('|');
}

export async function runCoalescedTextSearch(
    input: { textQuery: string; includedType: string | null; pageToken: string | undefined; hasWebsite: string | null; hasPhone: string | null; effectivePageSize: number },
    locationBias: LocationBias | undefined,
    locale: { languageCode: string; regionCode: string },
): Promise<GoogleTextSearchResult> {
    const dedupKey = buildTextSearchDedupKey(input, locationBias, locale);
    const existing = inFlightGoogleTextSearch.get(dedupKey);
    if (existing) {
        logger.info('Search: coalesced in-flight request', { dedupKey });
        return cloneJson(await existing);
    }

    const requestPromise = withSearchBulkhead(async () =>
        textSearch({
            textQuery: input.textQuery,
            includedType: input.includedType || undefined,
            pageSize: input.effectivePageSize,
            pageToken: input.pageToken || undefined,
            locationBias,
            languageCode: locale.languageCode,
            regionCode: locale.regionCode,
        })
    ).finally(() => {
        inFlightGoogleTextSearch.delete(dedupKey);
    });

    inFlightGoogleTextSearch.set(dedupKey, requestPromise);
    return cloneJson(await requestPromise);
}

export async function runCoalescedTextSearchAllPages(
    input: { textQuery: string; includedType?: string | null; pageSize?: number; hasWebsite?: string | null; hasPhone?: string | null; city?: string | null; state?: string | null; country?: string | null; radiusKm?: number | null },
    effectiveMax: number,
    locationBias: LocationBias | undefined,
    locale: { languageCode: string; regionCode: string },
): Promise<GoogleTextSearchAllPagesResult> {
    const dedupKey = buildTextSearchAllPagesDedupKey(input, effectiveMax, locationBias, locale);
    const existing = inFlightGoogleTextSearchAllPages.get(dedupKey);
    if (existing) {
        logger.info('SearchAllPages: coalesced in-flight request', { dedupKey });
        return cloneJson(await existing);
    }

    const requestPromise = withSearchBulkhead(async () =>
        textSearchAllPages({
            textQuery: input.textQuery,
            includedType: input.includedType || undefined,
            locationBias,
            maxPlaces: effectiveMax,
            languageCode: locale.languageCode,
            regionCode: locale.regionCode,
        })
    ).finally(() => {
        inFlightGoogleTextSearchAllPages.delete(dedupKey);
    });

    inFlightGoogleTextSearchAllPages.set(dedupKey, requestPromise);
    return cloneJson(await requestPromise);
}
