/**
 * US city autocomplete via Google Places API (New) — places:autocomplete.
 * Reuses GOOGLE_PLACES_API_KEY (Geocoding / Places must be enabled).
 */

import { fetchWithRetry } from '@/lib/fetch-http';
import { getCached, setCached } from '@/lib/redis';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const REQUEST_TIMEOUT_MS = 12000;
const CACHE_TTL_SECONDS = 60 * 60 * 6; // 6h

type AutocompleteResponse = {
    suggestions?: Array<{
        placePrediction?: {
            text?: { text?: string };
            structuredFormat?: {
                mainText?: { text?: string };
                secondaryText?: { text?: string };
            };
        };
    }>;
};

function buildCacheKey(state: string, query: string): string {
    return `cities:us:${state.toUpperCase()}:${query.toLowerCase().trim()}`;
}

function extractCityName(suggestion: NonNullable<AutocompleteResponse['suggestions']>[number]): string | null {
    const main = suggestion.placePrediction?.structuredFormat?.mainText?.text?.trim();
    if (main) return main;

    const full = suggestion.placePrediction?.text?.text?.trim();
    if (!full) return null;

    const firstPart = full.split(',')[0]?.trim();
    return firstPart || null;
}

function matchesState(
    suggestion: NonNullable<AutocompleteResponse['suggestions']>[number],
    stateCode: string,
): boolean {
    const secondary = suggestion.placePrediction?.structuredFormat?.secondaryText?.text ?? '';
    const full = suggestion.placePrediction?.text?.text ?? '';
    const haystack = `${secondary} ${full}`.toUpperCase();
    const code = stateCode.toUpperCase();
    return haystack.includes(`, ${code},`) || haystack.includes(`, ${code} `) || haystack.startsWith(`${code},`);
}

export async function getUsCitySuggestions(state: string, query: string): Promise<string[]> {
    const stateCode = state.trim().toUpperCase();
    const q = query.trim();
    if (!stateCode || stateCode === 'TODOS' || q.length < 2) return [];

    const cacheKey = buildCacheKey(stateCode, q);
    const cached = await getCached<string[]>(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return [];

    const input = q.length >= 3 ? `${q}, ${stateCode}, USA` : `${stateCode}, USA`;

    const res = await fetchWithRetry(
        AUTOCOMPLETE_URL,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
            },
            body: JSON.stringify({
                input,
                includedRegionCodes: ['us'],
                includedPrimaryTypes: ['locality', 'administrative_area_level_3'],
                languageCode: 'en',
            }),
        },
        { timeoutMs: REQUEST_TIMEOUT_MS, maxRetries: 1 },
    );

    if (!res.ok) return [];

    const data = (await res.json()) as AutocompleteResponse;
    const seen = new Set<string>();
    const cities: string[] = [];

    for (const suggestion of data.suggestions ?? []) {
        if (!matchesState(suggestion, stateCode)) continue;
        const city = extractCityName(suggestion);
        if (!city) continue;
        const key = city.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        cities.push(city);
        if (cities.length >= 20) break;
    }

    if (cities.length > 0) {
        setCached(cacheKey, cities, CACHE_TTL_SECONDS).catch(() => {
            // Cache is optional.
        });
    }

    return cities;
}
