import { fetchWithRetry } from '@/lib/fetch-http';

const PLACES_API_BASE = 'https://places.googleapis.com/v1/places';

/** Places API searchText max pageSize (doc: values above 20 are set to 20). */
export const PLACES_PAGE_SIZE_MAX = 20;
const PLACES_REQUEST_TIMEOUT_MS = 15000;
/** Delay before using nextPageToken (API may reject or repeat if immediate). */
const NEXT_PAGE_TOKEN_DELAY_MS = 400;

export interface PlaceResult {
    id: string;
    displayName: { text: string; languageCode: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    googleMapsUri?: string;
    rating?: number;
    userRatingCount?: number;
    types?: string[];
    businessStatus?: string;
    currentOpeningHours?: {
        openNow?: boolean;
        weekdayDescriptions?: string[];
    };
    reviews?: Array<{
        name: string;
        rating: number;
        text: { text: string };
        authorAttribution: { displayName: string };
        relativePublishTimeDescription: string;
    }>;
    primaryType?: string;
    primaryTypeDisplayName?: { text: string };
}

export interface TextSearchResponse {
    places: PlaceResult[];
    nextPageToken?: string;
}

/** locationBias circle: center = cidade (geocodificada), radius = raio a partir da cidade. API exige radius em metros (max 50000). UI usa km. */
export interface LocationBiasCircle {
    center: { latitude: number; longitude: number };
    /** Raio em metros (UI envia km; converter antes de chamar a API). */
    radius: number;
}

export interface TextSearchParams {
    textQuery: string;
    includedType?: string;
    pageSize?: number;
    pageToken?: string;
    languageCode?: string;
    regionCode?: string;
    /** Bias results to this region (Places API doc: locationBias.circle). */
    locationBias?: LocationBiasCircle;
}

const SEARCH_FIELD_MASK = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.nationalPhoneNumber',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.googleMapsUri',
    'places.rating',
    'places.userRatingCount',
    'places.types',
    'places.businessStatus',
    'places.primaryType',
    'places.primaryTypeDisplayName',
    'nextPageToken',
].join(',');

const DETAILS_FIELD_MASK = [
    'id',
    'displayName',
    'formattedAddress',
    'nationalPhoneNumber',
    'internationalPhoneNumber',
    'websiteUri',
    'googleMapsUri',
    'rating',
    'userRatingCount',
    'types',
    'businessStatus',
    'currentOpeningHours',
    'reviews',
    'primaryType',
    'primaryTypeDisplayName',
].join(',');

/**
 * In-memory cache of original request bodies keyed by nextPageToken.
 * Google Places API requires pagination requests to use identical params.
 * We store the original body (without pageToken) so we can replay it exactly.
 * TTL: entries auto-expire after 10 minutes via a simple cleanup.
 */
const pageTokenBodyCache = new Map<string, { body: Record<string, unknown>; ts: number }>();
const PAGE_TOKEN_CACHE_TTL_MS = 10 * 60 * 1000;

function cleanupPageTokenCache() {
    const now = Date.now();
    for (const [key, val] of pageTokenBodyCache) {
        if (now - val.ts > PAGE_TOKEN_CACHE_TTL_MS) pageTokenBodyCache.delete(key);
    }
}

function buildSearchBodyNoToken(
    params: TextSearchParams,
    pageSizeClamped: number,
): Record<string, unknown> {
    const body: Record<string, unknown> = {
        textQuery: params.textQuery,
        pageSize: pageSizeClamped,
        languageCode: params.languageCode || 'pt-BR',
        regionCode: params.regionCode || 'BR',
    };
    if (params.includedType) body.includedType = params.includedType;
    if (params.locationBias?.center && params.locationBias?.radius != null) {
        const radius = Math.min(50000, Math.max(0, params.locationBias.radius));
        body.locationBias = {
            circle: {
                center: {
                    latitude: params.locationBias.center.latitude,
                    longitude: params.locationBias.center.longitude,
                },
                radius,
            },
        };
    }
    return body;
}

function buildSearchBody(
    params: TextSearchParams,
    pageSizeClamped: number,
): Record<string, unknown> {
    if (params.pageToken) {
        const cached = pageTokenBodyCache.get(params.pageToken);
        if (cached) return { ...cached.body, pageToken: params.pageToken };
        return {
            textQuery: params.textQuery,
            pageSize: pageSizeClamped,
            languageCode: params.languageCode || 'pt-BR',
            regionCode: params.regionCode || 'BR',
            pageToken: params.pageToken,
        };
    }
    return buildSearchBodyNoToken(params, pageSizeClamped);
}

export async function textSearch(params: TextSearchParams): Promise<TextSearchResponse> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not configured');

    const pageSizeClamped = Math.min(
        PLACES_PAGE_SIZE_MAX,
        Math.max(1, params.pageSize ?? PLACES_PAGE_SIZE_MAX)
    );
    const body = buildSearchBody(params, pageSizeClamped);

    const res = await fetchWithRetry(
        `${PLACES_API_BASE}:searchText`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': SEARCH_FIELD_MASK,
            },
            body: JSON.stringify(body),
        },
        { timeoutMs: PLACES_REQUEST_TIMEOUT_MS, maxRetries: 3 }
    );

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Places API error (${res.status}): ${err}`);
    }

    const data = await res.json();

    // Cache the original body (without pageToken) for future pagination
    if (data.nextPageToken) {
        const bodyWithoutToken = { ...body };
        delete bodyWithoutToken.pageToken;
        pageTokenBodyCache.set(data.nextPageToken, { body: bodyWithoutToken, ts: Date.now() });
        // Periodic cleanup
        if (pageTokenBodyCache.size > 50) cleanupPageTokenCache();
    }

    return {
        places: data.places || [],
        nextPageToken: data.nextPageToken,
    };
}

/** Fetch multiple pages of search results up to maxPlaces (Places API returns max 20 per page). */
export async function textSearchAllPages(
    params: TextSearchParams & { maxPlaces: number }
): Promise<{ places: PlaceResult[] }> {
    const { maxPlaces, ...searchParams } = params;
    const cap = Math.max(1, Math.min(maxPlaces, 60));
    const all: PlaceResult[] = [];
    let pageToken: string | undefined;

    while (all.length < cap) {
        const res = await textSearch({
            ...searchParams,
            pageSize: Math.min(PLACES_PAGE_SIZE_MAX, cap - all.length),
            pageToken,
            // locationBias only on first page; subsequent pages use pageToken
            locationBias: pageToken ? undefined : searchParams.locationBias,
        });
        const batch = res.places ?? [];
        all.push(...batch);
        if (batch.length === 0 || !res.nextPageToken) break;
        if (all.length >= cap) break;
        pageToken = res.nextPageToken;
        await new Promise((r) => setTimeout(r, NEXT_PAGE_TOKEN_DELAY_MS));
    }

    return { places: all.slice(0, cap) };
}

export async function getPlaceDetails(placeId: string): Promise<PlaceResult> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not configured');

    const res = await fetchWithRetry(
        `${PLACES_API_BASE}/${placeId}`,
        {
            method: 'GET',
            headers: {
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': DETAILS_FIELD_MASK,
            },
        },
        { timeoutMs: PLACES_REQUEST_TIMEOUT_MS, maxRetries: 2 }
    );

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Place Details error (${res.status}): ${err}`);
    }

    return await res.json();
}
