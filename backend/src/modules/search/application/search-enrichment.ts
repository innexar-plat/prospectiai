import { prisma } from '@/lib/prisma';
import { getCached, setCached } from '@/lib/redis';
import { searchSerperRich, type SerperRichResponse } from '@/lib/web-search/serper';
import { logger } from '@/lib/logger';
import { recordUsageEvent } from '@/lib/usage';
import type { PlaceResult } from '../domain/types';

const SEARCH_SITE_ENRICH_ENABLED = String(process.env.SEARCH_SITE_ENRICH_ENABLED ?? 'true').toLowerCase() === 'true';
const SEARCH_SITE_ENRICH_MAX_PLACES = Number.parseInt(process.env.SEARCH_SITE_ENRICH_MAX_PLACES ?? '20', 10);
const SEARCH_SITE_ENRICH_RESULTS_PER_QUERY = Number.parseInt(process.env.SEARCH_SITE_ENRICH_RESULTS_PER_QUERY ?? '5', 10);
const SEARCH_SITE_ENRICH_TIMEOUT_MS = Number.parseInt(process.env.SEARCH_SITE_ENRICH_TIMEOUT_MS ?? '8000', 10);
const SEARCH_SITE_ENRICH_CACHE_TTL_SECONDS = Number.parseInt(process.env.SEARCH_SITE_ENRICH_CACHE_TTL_SECONDS ?? '604800', 10);
const SEARCH_SITE_ENRICH_ONLY_BR = String(process.env.SEARCH_SITE_ENRICH_ONLY_BR ?? 'true').toLowerCase() === 'true';

const SEARCH_SITE_BLOCKED_HOST_PATTERNS = [
    /(^|\.)instagram\.com$/i,
    /(^|\.)facebook\.com$/i,
    /(^|\.)linkedin\.com$/i,
    /(^|\.)youtube\.com$/i,
    /(^|\.)x\.com$/i,
    /(^|\.)twitter\.com$/i,
    /(^|\.)tiktok\.com$/i,
    /(^|\.)maps\.google\.com$/i,
    /(^|\.)google\.com$/i,
    /(^|\.)tripadvisor\./i,
    /(^|\.)yelp\./i,
    /(^|\.)apontador\./i,
    /(^|\.)lista\./i,
    /(^|\.)mercadolivre\./i,
];

function isBrazilCountry(country?: string | null): boolean {
    const normalized = (country ?? '').trim().toUpperCase();
    return normalized === '' || normalized === 'BR' || normalized === 'BRAZIL' || normalized === 'BRASIL';
}

function normalizeHostFromUrl(url: string): string | null {
    try {
        const normalized = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
        const host = new URL(normalized).hostname.trim().toLowerCase();
        return host.startsWith('www.') ? host.slice(4) : host;
    } catch {
        return null;
    }
}

function isAllowedBusinessWebsite(url: string): boolean {
    const host = normalizeHostFromUrl(url);
    if (!host) return false;
    return !SEARCH_SITE_BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

function sanitizeSerperText(value: string): string {
    return value.replace(/"/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildSerperWebsiteQuery(place: PlaceResult, location?: { city?: string | null; state?: string | null; country?: string | null }): string {
    const name = sanitizeSerperText(place.displayName?.text ?? '');
    const address = sanitizeSerperText(place.formattedAddress ?? '');
    const city = sanitizeSerperText(location?.city ?? '');
    const state = sanitizeSerperText(location?.state ?? '');
    const base = [name, address, city, state].filter(Boolean).map((part) => `"${part}"`).join(' ');
    const country = location?.country ?? null;
    const domainHint = !SEARCH_SITE_ENRICH_ONLY_BR || isBrazilCountry(country) ? ' site:.br OR site:.com.br ' : ' ';
    return `${base}${domainHint}-site:instagram.com -site:facebook.com -site:linkedin.com -site:maps.google.com`;
}

function buildSerperSiteCacheKey(place: PlaceResult, location?: { city?: string | null; state?: string | null; country?: string | null }): string {
    const name = (place.displayName?.text ?? '').trim().toLowerCase();
    const address = (place.formattedAddress ?? '').trim().toLowerCase();
    const city = (location?.city ?? '').trim().toLowerCase();
    const state = (location?.state ?? '').trim().toLowerCase();
    const country = (location?.country ?? '').trim().toLowerCase();
    return `search:site:serper:${name}:${address}:${city}:${state}:${country}`;
}

async function resolveSerperApiKeysForSearch(): Promise<string[]> {
    const directKey = (process.env.SEARCH_SERPER_API_KEY ?? process.env.SERPER_API_KEY ?? '').trim();
    if (directKey) return [directKey];

    try {
        const findUnique = (prisma as unknown as {
            webSearchConfig?: {
                findMany?: (args: unknown) => Promise<Array<{
                    role: string;
                    provider: 'SERPER' | 'TAVILY';
                    enabled: boolean;
                    apiKeyEncrypted: string | null;
                }>>;
            };
        }).webSearchConfig?.findMany;

        if (!findUnique) return [];

        const rows = await findUnique({
            where: { provider: 'SERPER', enabled: true },
            orderBy: { role: 'asc' },
        });

        if (!rows || rows.length === 0) {
            logger.warn('Serper key resolve: no enabled SERPER configs in DB');
            return [];
        }

        const { decryptApiKey } = await import('@/lib/ai/encrypt');
        const keys: string[] = [];
        for (const row of rows) {
            if (!row.apiKeyEncrypted) continue;
            try {
                const decrypted = decryptApiKey(row.apiKeyEncrypted).trim();
                if (decrypted) keys.push(decrypted);
            } catch {
                logger.warn('Serper key decrypt failed', { role: row.role });
            }
        }
        return keys;
    } catch (err) {
        logger.error('Serper key resolve failed', { error: err instanceof Error ? err.message : String(err) });
        return [];
    }
}

function levenshteinSimilarity(a: string, b: string): number {
    const na = a.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const nb = b.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (na === nb) return 1;
    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return 1;
    if (maxLen > 80) {
        return na.includes(nb) || nb.includes(na) ? 0.7 : 0;
    }
    const matrix: number[][] = [];
    for (let i = 0; i <= na.length; i++) {
        matrix[i] = [i];
        const row = matrix[i]!;
        for (let j = 1; j <= nb.length; j++) {
            if (i === 0) { row[j] = j; continue; }
            const prevRow = matrix[i - 1]!;
            const cost = na[i - 1] === nb[j - 1] ? 0 : 1;
            row[j] = Math.min(prevRow[j]! + 1, row[j - 1]! + 1, prevRow[j - 1]! + cost);
        }
    }
    return 1 - matrix[na.length]![nb.length]! / maxLen;
}

function extractBestWebsiteFromSerper(
    rich: SerperRichResponse,
    placeName: string,
): string | null {
    if (rich.knowledgeGraph?.website && isAllowedBusinessWebsite(rich.knowledgeGraph.website)) {
        const kgTitle = (rich.knowledgeGraph.title ?? '').toLowerCase();
        const pName = placeName.toLowerCase();
        if (kgTitle && (kgTitle.includes(pName) || pName.includes(kgTitle) || levenshteinSimilarity(kgTitle, pName) > 0.5)) {
            return rich.knowledgeGraph.website.trim();
        }
    }
    if (rich.places) {
        for (const sp of rich.places) {
            if (sp.website && isAllowedBusinessWebsite(sp.website)) {
                const spTitle = (sp.title ?? '').toLowerCase();
                const pName = placeName.toLowerCase();
                if (spTitle && (spTitle.includes(pName) || pName.includes(spTitle) || levenshteinSimilarity(spTitle, pName) > 0.5)) {
                    return sp.website.trim();
                }
            }
        }
    }
    const best = rich.organic.find((item) => isAllowedBusinessWebsite(item.link));
    return best?.link?.trim() || null;
}

function normalizeSerperPhone(phone: string): string | null {
    const cleaned = phone.replace(/[^\d+() -]/g, '').trim();
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length < 8) return null;
    return cleaned;
}

function extractBestPhoneFromSerper(
    rich: SerperRichResponse,
    placeName: string,
): string | null {
    if (rich.knowledgeGraph?.phone) {
        const kgTitle = (rich.knowledgeGraph.title ?? '').toLowerCase();
        const pName = placeName.toLowerCase();
        if (kgTitle && (kgTitle.includes(pName) || pName.includes(kgTitle) || levenshteinSimilarity(kgTitle, pName) > 0.5)) {
            return normalizeSerperPhone(rich.knowledgeGraph.phone);
        }
    }
    if (rich.places) {
        for (const sp of rich.places) {
            if (sp.phone) {
                const spTitle = (sp.title ?? '').toLowerCase();
                const pName = placeName.toLowerCase();
                if (spTitle && (spTitle.includes(pName) || pName.includes(spTitle) || levenshteinSimilarity(spTitle, pName) > 0.5)) {
                    return normalizeSerperPhone(sp.phone);
                }
            }
        }
    }
    return null;
}

interface SerperEnrichCacheEntry {
    website: string | null;
    phone: string | null;
}

export async function enrichMissingWebsitesWithSerper(
    places: PlaceResult[],
    workspaceId: string,
    userId: string,
    location?: { city?: string | null; state?: string | null; country?: string | null },
): Promise<PlaceResult[]> {
    if (!SEARCH_SITE_ENRICH_ENABLED || places.length === 0) return places;
    if (SEARCH_SITE_ENRICH_ONLY_BR && !isBrazilCountry(location?.country)) return places;

    const apiKeys = await resolveSerperApiKeysForSearch();
    if (apiKeys.length === 0) {
        logger.warn('Serper enrichment skipped: no API keys resolved');
        return places;
    }

    const maxCandidates = Math.max(1, Math.min(20, SEARCH_SITE_ENRICH_MAX_PLACES));
    const candidates = places
        .map((place, idx) => ({ place, idx }))
        .filter(({ place }) => !place.websiteUri?.trim() || !place.nationalPhoneNumber?.trim())
        .slice(0, maxCandidates);

    if (candidates.length === 0) return places;

    const nextPlaces = [...places];
    let serperQueriesUsed = 0;
    let websitesFound = 0;
    let phonesFound = 0;

    const isBr = isBrazilCountry(location?.country);
    let activeKeyIndex = 0;
    let allKeysExhausted = false;

    for (const { place, idx } of candidates) {
        if (allKeysExhausted) break;

        try {
            const cacheKey = buildSerperSiteCacheKey(place, location);
            const cached = await getCached<SerperEnrichCacheEntry>(cacheKey);
            if (cached && (cached.website || cached.phone)) {
                const patch: Partial<PlaceResult> = {};
                if (cached.website && !place.websiteUri?.trim()) patch.websiteUri = cached.website;
                if (cached.phone && !place.nationalPhoneNumber?.trim()) patch.nationalPhoneNumber = cached.phone;
                if (Object.keys(patch).length > 0) {
                    nextPlaces[idx] = { ...place, ...patch };
                    if (patch.websiteUri) websitesFound++;
                    if (patch.nationalPhoneNumber) phonesFound++;
                }
                continue;
            }
            if (cached !== null && cached !== undefined) continue;

            const query = buildSerperWebsiteQuery(place, location);
            const num = Math.max(1, Math.min(5, SEARCH_SITE_ENRICH_RESULTS_PER_QUERY));

            let rich: SerperRichResponse | null = null;
            while (activeKeyIndex < apiKeys.length) {
                try {
                    rich = await withTimeout(
                        searchSerperRich(apiKeys[activeKeyIndex]!, query, num, isBr ? 'br' : undefined, isBr ? 'pt-br' : undefined),
                        SEARCH_SITE_ENRICH_TIMEOUT_MS,
                        'SEARCH_SITE_ENRICH_TIMEOUT',
                    );
                    break;
                } catch (keyErr) {
                    const errMsg = keyErr instanceof Error ? keyErr.message : String(keyErr);
                    if (errMsg.includes('400') || errMsg.includes('credits') || errMsg.includes('401') || errMsg.includes('403')) {
                        logger.warn('Serper key exhausted, trying next', {
                            keyIndex: activeKeyIndex,
                            keysTotal: apiKeys.length,
                            error: errMsg.slice(0, 120),
                        });
                        activeKeyIndex++;
                        continue;
                    }
                    throw keyErr;
                }
            }

            if (!rich) {
                allKeysExhausted = true;
                logger.warn('Serper enrichment: all API keys exhausted');
                break;
            }

            serperQueriesUsed += 1;

            const placeName = place.displayName?.text ?? '';
            const discoveredWebsite = !place.websiteUri?.trim() ? extractBestWebsiteFromSerper(rich, placeName) : null;
            const discoveredPhone = !place.nationalPhoneNumber?.trim() ? extractBestPhoneFromSerper(rich, placeName) : null;

            await setCached(
                cacheKey,
                { website: discoveredWebsite, phone: discoveredPhone } satisfies SerperEnrichCacheEntry,
                Math.max(300, SEARCH_SITE_ENRICH_CACHE_TTL_SECONDS),
            );

            const patch: Partial<PlaceResult> = {};
            if (discoveredWebsite) { patch.websiteUri = discoveredWebsite; websitesFound++; }
            if (discoveredPhone) { patch.nationalPhoneNumber = discoveredPhone; phonesFound++; }
            if (Object.keys(patch).length > 0) {
                nextPlaces[idx] = { ...place, ...patch };
            }
        } catch (err) {
            logger.warn('Serper enrich error for place', {
                placeId: place.id,
                error: err instanceof Error ? err.message : String(err),
            });
            continue;
        }
    }

    if (serperQueriesUsed > 0) {
        recordUsageEvent({
            workspaceId,
            userId,
            type: 'SERPER_REQUEST',
            quantity: serperQueriesUsed,
        });
    }

    logger.info('Search Serper enrichment', {
        candidates: candidates.length,
        serperQueriesUsed,
        websitesFound,
        phonesFound,
        allKeysExhausted,
        totalBefore: { withWebsite: places.filter((p) => p.websiteUri?.trim()).length, withPhone: places.filter((p) => p.nationalPhoneNumber?.trim()).length },
        totalAfter: { withWebsite: nextPlaces.filter((p) => p.websiteUri?.trim()).length, withPhone: nextPlaces.filter((p) => p.nationalPhoneNumber?.trim()).length },
    });

    return nextPlaces;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    const safeTimeoutMs = Math.max(1000, timeoutMs);
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => {
            const timer = setTimeout(() => {
                clearTimeout(timer);
                reject(new Error(timeoutMessage));
            }, safeTimeoutMs);
        }),
    ]) as Promise<T>;
}
