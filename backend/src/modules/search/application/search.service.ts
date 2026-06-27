/**
 * Search module — application layer (use-case).
 * Orchestrates cache, DB, external API, history and usage.
 * Route (api) only validates, authenticates and calls runSearch.
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import { checkMemberLimits, MemberLimitExceededError } from '@/lib/team-credits';
import { textSearch, textSearchAllPages, PLACES_PAGE_SIZE_MAX, type PlaceResult } from '@/lib/google-places';
import { geocodeAddress } from '@/lib/geocode';
import { resolveCountryLocale } from '@/lib/country-locale';
import { acquireRedisLock, getCached, releaseRedisLock, setCached, waitForCached } from '@/lib/redis';
import { enqueueLeadSync } from '@/lib/lead-sync-queue';
import { enqueueSearchHistoryWrite } from '@/lib/search-history-queue';
import { computeOpportunityScore } from '@/lib/db-sync';
import { withSearchBulkhead } from '@/lib/search-bulkhead';
import { logger } from '@/lib/logger';
import { recordUsageEvent } from '@/lib/usage';
import { searchSerper, searchSerperRich, type SerperRichResponse } from '@/lib/web-search/serper';
import type { SearchInput } from '@/lib/validations/schemas';
import type { SearchResult, PlaceLike } from '../domain/types';
import { applyTrialExpiryIfNeeded, assertWorkspaceCanUseProduct } from '@/lib/trial';

/** UI sempre em km; conversão para metros só na chamada à API (locationBias.radius). */
const RADIUS_KM_TO_M = 1000;

type SaveHistoryFn = (resultsCount: number, places?: PlaceResult[]) => Promise<void>;

/** Page token from request (optional or null). */
type PageTokenParam = string | undefined | null;

type TryCacheOrDbSearchParams = {
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
const ASYNC_HISTORY_WRITES = String(process.env.SEARCH_HISTORY_ASYNC ?? 'true').toLowerCase() === 'true';
const SEARCH_USER_CONTEXT_CACHE_TTL_MS = Number.parseInt(process.env.SEARCH_USER_CONTEXT_CACHE_TTL_MS ?? '5000', 10);
const IS_TEST_ENV = process.env.NODE_ENV === 'test';
const SEARCH_DISTRIBUTED_LOCK_ENABLED = String(process.env.SEARCH_DISTRIBUTED_LOCK_ENABLED ?? 'true').toLowerCase() === 'true';
const SEARCH_LOCK_TTL_MS = Number.parseInt(process.env.SEARCH_LOCK_TTL_MS ?? '12000', 10);
const SEARCH_LOCK_WAIT_MS = Number.parseInt(process.env.SEARCH_LOCK_WAIT_MS ?? '2500', 10);
const SEARCH_LOCK_POLL_MS = Number.parseInt(process.env.SEARCH_LOCK_POLL_MS ?? '75', 10);
const SEARCH_RF_CROSS_ENABLED = String(process.env.SEARCH_RF_CROSS_ENABLED ?? 'true').toLowerCase() === 'true';
const SEARCH_RF_MAX_RESULTS = Number.parseInt(process.env.SEARCH_RF_MAX_RESULTS ?? '20', 10);
const SEARCH_RF_AUTO_CNAE_LIMIT = Number.parseInt(process.env.SEARCH_RF_AUTO_CNAE_LIMIT ?? '5', 10);
const SEARCH_RF_AUTO_CNAE_LOOKUPS = Number.parseInt(process.env.SEARCH_RF_AUTO_CNAE_LOOKUPS ?? '12', 10);
const SEARCH_RF_CROSS_TIMEOUT_MS = Number.parseInt(process.env.SEARCH_RF_CROSS_TIMEOUT_MS ?? '15000', 10);
const SEARCH_RF_CACHE_ENABLED = String(process.env.SEARCH_RF_CACHE_ENABLED ?? 'true').toLowerCase() === 'true';
const SEARCH_RF_CACHE_TTL_SECONDS = Number.parseInt(process.env.SEARCH_RF_CACHE_TTL_SECONDS ?? '900', 10);
const SEARCH_RF_MAX_IN_FLIGHT = Number.parseInt(process.env.SEARCH_RF_MAX_IN_FLIGHT ?? '2', 10);
const SEARCH_RF_BULKHEAD_ACQUIRE_TIMEOUT_MS = Number.parseInt(process.env.SEARCH_RF_BULKHEAD_ACQUIRE_TIMEOUT_MS ?? '350', 10);
const SEARCH_SITE_ENRICH_ENABLED = String(process.env.SEARCH_SITE_ENRICH_ENABLED ?? 'true').toLowerCase() === 'true';
const SEARCH_SITE_ENRICH_MAX_PLACES = Number.parseInt(process.env.SEARCH_SITE_ENRICH_MAX_PLACES ?? '20', 10);
const SEARCH_SITE_ENRICH_RESULTS_PER_QUERY = Number.parseInt(process.env.SEARCH_SITE_ENRICH_RESULTS_PER_QUERY ?? '5', 10);
const SEARCH_SITE_ENRICH_TIMEOUT_MS = Number.parseInt(process.env.SEARCH_SITE_ENRICH_TIMEOUT_MS ?? '8000', 10);
const SEARCH_SITE_ENRICH_CACHE_TTL_SECONDS = Number.parseInt(process.env.SEARCH_SITE_ENRICH_CACHE_TTL_SECONDS ?? '604800', 10);
const SEARCH_SITE_ENRICH_ONLY_BR = String(process.env.SEARCH_SITE_ENRICH_ONLY_BR ?? 'true').toLowerCase() === 'true';

const SEARCH_RF_STOP_WORDS = new Set([
    'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'no', 'na', 'nos', 'nas',
    'a', 'o', 'as', 'os', 'um', 'uma', 'negocios', 'negocio', 'empresa', 'empresas',
    'servicos', 'servico', 'brasil', 'estado', 'mato', 'grosso', 'sul', 'norte',
]);

const SEARCH_RF_CNAE_HINTS_BY_TYPE: Record<string, string[]> = {
    // Agro / Rural
    farm: ['agricultura', 'pecuaria', 'cultivo', 'fazenda', '0111', '0151'],
    ranch: ['pecuaria', 'bovino', 'gado', 'fazenda', '0151', '0152', '0141'],
    // Saúde
    pharmacy: ['farmacia', 'drogaria', 'medicamentos', '4771'],
    dentist: ['odontologia', 'dentista', 'clinica odontologica', '8630506'],
    doctor: ['clinica medica', 'consultorio medico', 'atividade medica', '8630'],
    hospital: ['hospital', 'pronto socorro', '8610'],
    medical_lab: ['laboratorio', 'analises clinicas', '8640'],
    physiotherapist: ['fisioterapia', 'fisioterapeuta', '8650006'],
    // Alimentação
    restaurant: ['restaurante', 'alimentacao', 'lanchonete', '5611'],
    cafe: ['cafeteria', 'padaria', '5611203', '1091'],
    bakery: ['padaria', 'confeitaria', '1091'],
    bar: ['bar', 'pub', '5611204'],
    fast_food_restaurant: ['fast food', 'hamburgueria', 'lanchonete', '5611'],
    pizza_restaurant: ['pizzaria', '5611201'],
    ice_cream_shop: ['sorveteria', 'acai', '4721104'],
    supermarket: ['supermercado', 'mercearia', '4711'],
    // Beleza
    beauty_salon: ['salao de beleza', 'cabeleireiro', 'estetica', '9602'],
    barber_shop: ['barbearia', '9602501'],
    skin_care_clinic: ['estetica', 'clinica estetica', '9602503'],
    spa: ['spa', 'day spa', '9609207'],
    // Serviços profissionais
    lawyer: ['advogado', 'advocacia', '6911'],
    accounting: ['contabilidade', 'contador', '6920'],
    real_estate_agency: ['imobiliaria', '6821'],
    marketing_consultant: ['marketing', 'publicidade', '7311', '7312'],
    insurance_agency: ['seguradora', 'seguros', '6622', '6621'],
    consultant: ['consultoria', 'consultor', '7020'],
    coworking_space: ['coworking', 'escritorio compartilhado', '8211300'],
    // Comércio
    store: ['loja', 'comercio', '4712', '4713'],
    pet_store: ['pet shop', 'veterinario', '4789004', '7500'],
    clothing_store: ['moda', 'roupas', 'boutique', '4781'],
    jewelry_store: ['joalheria', 'relojoaria', '4783'],
    book_store: ['livraria', 'papelaria', '4761'],
    bicycle_store: ['bicicleta', '4763602'],
    electronics_store: ['eletronicos', 'informatica', '4751', '4753'],
    furniture_store: ['moveis', 'marcenaria', '3101', '3102'],
    // Automotivo
    car_repair: ['oficina mecanica', 'auto center', '4520'],
    car_wash: ['lava rapido', 'lavagem', '4520005'],
    car_dealer: ['concessionaria', 'revenda veiculos', '4511'],
    auto_parts_store: ['auto pecas', 'pecas automotivas', '4530'],
    gas_station: ['posto gasolina', 'combustivel', '4731'],
    tire_shop: ['pneu', 'borracharia', '4530705'],
    // Educação
    school: ['escola', 'colegio', '8511', '8512', '8513'],
    university: ['faculdade', 'universidade', '8531', '8532'],
    preschool: ['creche', 'maternal', '8511200'],
    // Hospedagem
    hotel: ['hotel', 'pousada', '5510'],
    inn: ['pousada', 'chale', '5510802'],
    travel_agency: ['agencia viagens', 'turismo', '7911', '7912'],
    hostel: ['hostel', 'albergue', '5510803'],
    resort_hotel: ['resort', '5510801'],
    // Construção
    general_contractor: ['construtora', 'construcao civil', '4120', '4110'],
    hardware_store: ['material construcao', 'ferragem', '4744'],
    electrician: ['eletricista', 'instalacao eletrica', '4321'],
    plumber: ['encanador', 'hidraulica', '4322'],
    // Transporte
    moving_company: ['mudanca', 'frete', '4930204'],
    courier_service: ['motoboy', 'entregas', '5320202'],
    // Outros
    florist: ['floricultura', 'flores', '4789001'],
    laundry: ['lavanderia', 'limpeza', '9601'],
    banquet_hall: ['buffet', 'casa festas', '5620'],
    event_venue: ['espaco eventos', 'salao festas', '8230'],
    wedding_venue: ['casamento', 'cerimonial', '8230'],
    bank: ['banco', 'agencia bancaria', '6421', '6422'],
    veterinary_care: ['veterinaria', 'veterinario', '7500'],
    manufacturer: ['fabrica', 'industria', 'fabricacao', '1099'],
    gym: ['academia', 'condicionamento fisico', '9313', '9319'],
    fitness_center: ['academia', 'fitness', 'condicionamento fisico', '9313'],
};

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

type GoogleTextSearchResult = Awaited<ReturnType<typeof textSearch>>;
type GoogleTextSearchAllPagesResult = Awaited<ReturnType<typeof textSearchAllPages>>;

const inFlightGoogleTextSearch = new Map<string, Promise<GoogleTextSearchResult>>();
const inFlightGoogleTextSearchAllPages = new Map<string, Promise<GoogleTextSearchAllPagesResult>>();
const inFlightRfCrossSearch = new Map<string, Promise<PlaceResult[]>>();
let rfCrossInFlightCount = 0;

function cloneJson<T>(value: T): T {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value)) as T;
}

function stringifyLocationBias(locationBias: LocationBias | undefined): string {
    if (!locationBias) return 'none';
    return [
        locationBias.center.latitude.toFixed(6),
        locationBias.center.longitude.toFixed(6),
        String(locationBias.radius),
    ].join(':');
}

function normalizeSearchKeyPart(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function buildRfCrossCacheKey(cnaes: string[], state?: string | null, city?: string | null): string {
    const normalizedCnaes = [...cnaes].map((code) => code.trim()).filter(Boolean).sort().join(',');
    return [
        'search:rf-cross',
        normalizedCnaes,
        normalizeSearchKeyPart(state),
        normalizeSearchKeyPart(city),
    ].join(':');
}

function normalizeRfTerm(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function tokenizeRfTerm(value: string): string[] {
    return normalizeRfTerm(value)
        .split(/[^a-z0-9]+/)
        .filter((part) => part.length >= 4 && !SEARCH_RF_STOP_WORDS.has(part));
}

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

/**
 * Populate phones/emails/websites arrays on every PlaceResult
 * by collecting all available fields per place. Called after RF merge
 * so that merged places already have fields from both sources.
 */
function collectAllContacts(places: PlaceResult[]): PlaceResult[] {
    return places.map((p) => {
        // If phones/emails/websites already populated (from merge), keep them;
        // otherwise build from single fields.
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
    const name = normalizeSearchKeyPart(place.displayName?.text ?? '');
    const address = normalizeSearchKeyPart(place.formattedAddress ?? '');
    const city = normalizeSearchKeyPart(location?.city ?? '');
    const state = normalizeSearchKeyPart(location?.state ?? '');
    const country = normalizeSearchKeyPart(location?.country ?? '');
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

/** Legacy single-key resolver (used by other callers if any). */
async function resolveSerperApiKeyForSearch(): Promise<string | null> {
    const keys = await resolveSerperApiKeysForSearch();
    return keys[0] ?? null;
}

function extractBestWebsiteFromSerper(
    rich: SerperRichResponse,
    placeName: string,
): string | null {
    // 1. Knowledge Graph — most reliable if title matches
    if (rich.knowledgeGraph?.website && isAllowedBusinessWebsite(rich.knowledgeGraph.website)) {
        const kgTitle = (rich.knowledgeGraph.title ?? '').toLowerCase();
        const pName = placeName.toLowerCase();
        if (kgTitle && (kgTitle.includes(pName) || pName.includes(kgTitle) || levenshteinSimilarity(kgTitle, pName) > 0.5)) {
            return rich.knowledgeGraph.website.trim();
        }
    }
    // 2. Serper places — match by name
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
    // 3. First allowed organic result
    const best = rich.organic.find((item) => isAllowedBusinessWebsite(item.link));
    return best?.link?.trim() || null;
}

function extractBestPhoneFromSerper(
    rich: SerperRichResponse,
    placeName: string,
): string | null {
    // 1. Knowledge Graph
    if (rich.knowledgeGraph?.phone) {
        const kgTitle = (rich.knowledgeGraph.title ?? '').toLowerCase();
        const pName = placeName.toLowerCase();
        if (kgTitle && (kgTitle.includes(pName) || pName.includes(kgTitle) || levenshteinSimilarity(kgTitle, pName) > 0.5)) {
            return normalizeSerperPhone(rich.knowledgeGraph.phone);
        }
    }
    // 2. Serper places — match by name
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

function normalizeSerperPhone(phone: string): string | null {
    const cleaned = phone.replace(/[^\d+() -]/g, '').trim();
    // Must have at least 8 digits to be a valid phone
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length < 8) return null;
    return cleaned;
}

/** Simple Levenshtein-based similarity: 0..1 */
function levenshteinSimilarity(a: string, b: string): number {
    const na = a.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const nb = b.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (na === nb) return 1;
    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return 1;
    // Only compute for short strings (performance)
    if (maxLen > 80) {
        return na.includes(nb) || nb.includes(na) ? 0.7 : 0;
    }
    const matrix: number[][] = [];
    for (let i = 0; i <= na.length; i++) {
        matrix[i] = [i];
        for (let j = 1; j <= nb.length; j++) {
            if (i === 0) { matrix[0][j] = j; continue; }
            const cost = na[i - 1] === nb[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
    }
    return 1 - matrix[na.length][nb.length] / maxLen;
}

interface SerperEnrichCacheEntry {
    website: string | null;
    phone: string | null;
}

async function enrichMissingWebsitesWithSerper(
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
    // Candidate: missing website OR missing phone
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
            // Skip if already cached with null results
            if (cached !== null && cached !== undefined) continue;

            const query = buildSerperWebsiteQuery(place, location);
            const num = Math.max(1, Math.min(5, SEARCH_SITE_ENRICH_RESULTS_PER_QUERY));

            let rich: SerperRichResponse | null = null;
            while (activeKeyIndex < apiKeys.length) {
                try {
                    rich = await withTimeout(
                        searchSerperRich(apiKeys[activeKeyIndex], query, num, isBr ? 'br' : undefined, isBr ? 'pt-br' : undefined),
                        SEARCH_SITE_ENRICH_TIMEOUT_MS,
                        'SEARCH_SITE_ENRICH_TIMEOUT',
                    );
                    break;
                } catch (keyErr) {
                    const errMsg = keyErr instanceof Error ? keyErr.message : String(keyErr);
                    // 400 = usually "Not enough credits", try next key
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
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

/**
 * Maps informal/popular business terms (PT-BR) to CNAE-matchable terms that
 * appear in CnaeCode.description.  This bridges the gap between what users
 * type ("fazenda", "despachante") and the formal IBGE descriptions ("Criação
 * de bovinos", "Atividades de despachantes aduaneiros").
 */
const CNAE_KEYWORD_SYNONYMS: Record<string, string[]> = {
    // Agro / Rural
    fazenda: ['criacao de bovinos', 'cultivo', 'pecuaria', 'agricultura', '0111', '0115', '0151'],
    agropecuaria: ['criacao de bovinos', 'cultivo', 'pecuaria', 'agricultura', 'suinos', '0151', '0154'],
    pecuaria: ['criacao de bovinos', 'criacao de bufalinos', 'suinos', '0151', '0152', '0154'],
    gado: ['criacao de bovinos', '0151'],
    sitio: ['cultivo', 'horticultura', 'criacao', '0161'],
    granja: ['criacao de frangos', 'criacao de aves', 'ovos', '0155'],
    laticinio: ['laticinio', 'laticinios', 'leite', '1051'],
    frigorifico: ['abate de bovinos', 'abate de suinos', 'abate de aves', '1011', '1012', '1013'],
    soja: ['cultivo de soja', '0115'],
    cafe: ['cultivo de cafe', '0134', 'torrefacao', '1081'],
    cana: ['cultivo de cana', '0113'],
    algodao: ['cultivo de algodao', '0112'],
    // Serviços / Documentação
    despachante: ['despachante', 'documentacao', 'servicos combinados de escritorio', '8211', '6911', '5250801'],
    cartorio: ['cartorio', 'tabelionato', 'servicos notariais', '6912'],
    contabilidade: ['contabilidade', 'auditoria', '6920'],
    contador: ['contabilidade', 'auditoria', '6920'],
    advocacia: ['advocacia', 'advogado', '6911'],
    advogado: ['advocacia', '6911'],
    // Alimentação
    restaurante: ['restaurante', 'alimentacao', 'refeicoes', '5611'],
    lanchonete: ['lanchonete', 'restaurante', '5611'],
    pizzaria: ['pizzaria', '5611201'],
    hamburgueria: ['lanchonete', 'fast food', '5611'],
    churrascaria: ['restaurante', '5611'],
    padaria: ['padaria', 'confeitaria', 'panificacao', '1091', '4721102'],
    acougue: ['acougue', 'carnes', '4722901'],
    sorveteria: ['sorvete', '4721104'],
    doceria: ['confeitaria', 'doces', '1091102'],
    // Saúde
    clinica: ['clinica medica', 'atividade medica', 'saude', '8630'],
    hospital: ['hospital', 'pronto socorro', '8610'],
    laboratorio: ['laboratorio', 'analises clinicas', '8640'],
    dentista: ['odontologia', 'dentista', '8630506'],
    farmacia: ['farmacia', 'drogaria', '4771'],
    otica: ['otica', 'optometria', '4774'],
    psicologia: ['psicologia', 'psicanalise', '8650004'],
    fisioterapia: ['fisioterapia', '8650006'],
    veterinaria: ['veterinaria', 'veterinario', '7500'],
    // Beleza
    salao: ['cabeleireiro', 'salao de beleza', 'estetica', '9602'],
    barbearia: ['barbearia', '9602501'],
    estetica: ['estetica', 'clinica estetica', '9602503'],
    // Comércio
    loja: ['comercio varejista', 'loja', '4712', '4713'],
    mercado: ['supermercado', 'mercearia', 'minimercado', '4711'],
    papelaria: ['papelaria', '4761003'],
    floricultura: ['floricultura', '4789001'],
    petshop: ['pet shop', '4789004'],
    'pet shop': ['pet shop', '4789004'],
    boutique: ['roupas', 'vestuario', 'moda', '4781'],
    livraria: ['livros', 'livraria', '4761001'],
    joalheria: ['joalheria', 'relojoaria', '4783'],
    moveis: ['moveis', 'movelaria', '4754', '3101'],
    eletronicos: ['eletronicos', 'informatica', '4751', '4753'],
    celular: ['telefonia', 'comunicacao', '4752100'],
    materiais: ['material construcao', 'ferragem', '4744'],
    ferragem: ['ferragem', 'ferramentas', '4744'],
    // Automotivo
    oficina: ['oficina mecanica', 'reparacao de veiculos', '4520'],
    mecanica: ['oficina mecanica', 'reparacao', '4520'],
    funilaria: ['funilaria', 'pintura', '4520002'],
    borracharia: ['borracharia', 'pneu', '4530705'],
    concessionaria: ['concessionaria', 'revenda veiculos', '4511'],
    autopecas: ['auto pecas', 'pecas automotivas', '4530'],
    'auto pecas': ['auto pecas', '4530'],
    posto: ['posto gasolina', 'combustivel', '4731'],
    lava: ['lavagem', 'lava rapido', '4520005'],
    estacionamento: ['estacionamento', '5223100'],
    autoescola: ['auto escola', 'formacao de condutores', '8599604'],
    // Educação
    escola: ['escola', 'ensino', 'educacao', '8511', '8512', '8513'],
    colegio: ['ensino fundamental', 'ensino medio', '8512', '8513'],
    faculdade: ['faculdade', 'universidade', 'ensino superior', '8531', '8532'],
    curso: ['curso', 'ensino', 'instrucao', '8599'],
    creche: ['creche', 'educacao infantil', '8511200'],
    idioma: ['idioma', 'lingua', '8593700'],
    // Construção / Imóveis
    construtora: ['construtora', 'construcao civil', '4120', '4110'],
    engenharia: ['engenharia', 'servicos de engenharia', '7112'],
    arquitetura: ['arquitetura', '7111'],
    imobiliaria: ['imobiliaria', 'corretagem de imoveis', '6821'],
    eletricista: ['eletricista', 'instalacao eletrica', '4321'],
    encanador: ['encanador', 'hidraulica', '4322'],
    pintor: ['pintura', '4330401'],
    serralheria: ['serralheria', '2542'],
    vidracaria: ['vidracaria', 'vidros', '2311700'],
    // Tecnologia
    informatica: ['informatica', 'tecnologia', 'software', '6201', '6202', '6203'],
    software: ['software', 'desenvolvimento de sistemas', '6201'],
    tecnologia: ['tecnologia', 'informatica', '6201', '6209'],
    marketing: ['marketing', 'publicidade', 'propaganda', '7311', '7312'],
    agencia: ['publicidade', 'propaganda', 'marketing', '7311'],
    // Transporte / Logística
    transportadora: ['transporte', 'carga', 'frete', '4930'],
    frete: ['frete', 'transporte', 'mudanca', '4930'],
    mudanca: ['mudanca', 'transporte', '4930204'],
    motoboy: ['motoboy', 'entregas', '5320202'],
    taxi: ['taxi', 'transporte de passageiros', '4923002'],
    // Hospedagem / Turismo
    hotel: ['hotel', 'hospedagem', '5510'],
    pousada: ['pousada', 'hospedagem', '5510802'],
    turismo: ['turismo', 'agencia viagens', '7911', '7912'],
    // Indústria
    fabrica: ['fabricacao', 'industria', 'manufatura'],
    industria: ['fabricacao', 'industria'],
    metalurgica: ['metalurgica', 'siderurgia', '2431', '2443'],
    textil: ['textil', 'confeccao', 'tecelagem', '1311', '1412'],
    grafica: ['grafica', 'impressao', '1811'],
    // Financeiro / Seguros
    banco: ['banco', 'instituicao financeira', '6421', '6422'],
    seguradora: ['seguradora', 'seguros', '6511', '6512'],
    corretora: ['corretora', 'corretagem', '6612'],
    financeira: ['financeira', 'credito', '6431'],
    // Entretenimento / Eventos
    buffet: ['buffet', 'alimentacao', '5620'],
    festas: ['festas', 'eventos', '8230'],
    cinema: ['cinema', 'exibicao cinematografica', '5914'],
    teatro: ['teatro', 'artes cenicas', '9001901'],
    academia: ['academia', 'condicionamento fisico', '9313'],
    // Serviços Gerais
    lavanderia: ['lavanderia', 'limpeza', '9601'],
    seguranca: ['seguranca', 'vigilancia', '8011'],
    limpeza: ['limpeza', 'conservacao', '8121'],
    funeraria: ['funeraria', 'servicos funerarios', '9603'],
    cemiterio: ['sepultamento', 'cemiterio', '9603303'],
    coworking: ['coworking', 'escritorio compartilhado', '8211'],
    consultoria: ['consultoria', 'gestao empresarial', '7020'],
    contato: ['consultoria', '7020'],
    fotografia: ['fotografia', 'fotografo', '7420'],
    grafico: ['design grafico', '7410'],
};

const SEARCH_RF_AI_CNAE_ENABLED = String(process.env.SEARCH_RF_AI_CNAE_ENABLED ?? 'true').toLowerCase() === 'true';
const SEARCH_RF_AI_CNAE_CACHE_TTL = Number.parseInt(process.env.SEARCH_RF_AI_CNAE_CACHE_TTL ?? '604800', 10); // 7 days
const SEARCH_RF_AI_CNAE_TIMEOUT_MS = Number.parseInt(process.env.SEARCH_RF_AI_CNAE_TIMEOUT_MS ?? '8000', 10);

/**
 * AI-based CNAE inference.  Asks the LLM to map a free-text business
 * description to up to 5 CNAE prefixes.  Results are cached in Redis for
 * 7 days so each unique query only cost one AI call.
 */
async function inferCnaesWithAI(textQuery: string): Promise<string[]> {
    if (!SEARCH_RF_AI_CNAE_ENABLED) return [];

    const cacheKey = `search:ai-cnae:${normalizeRfTerm(textQuery)}`;
    const cached = await getCached<string[]>(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

    try {
        const { generateCompletionForRole } = await import('@/lib/ai');
        const result = await withTimeout(
            generateCompletionForRole('lead_analysis', {
                systemPrompt: [
                    'Você é um classificador brasileiro de CNAE (Classificação Nacional de Atividades Econômicas).',
                    'O usuário vai descrever um tipo de negócio ou atividade.',
                    'Retorne SOMENTE um JSON com a chave "codes" contendo um array de até 5 prefixos CNAE (4-7 dígitos) mais relevantes.',
                    'Prefira prefixos curtos (4 dígitos) quando cobrirem a atividade.',
                    'Exemplo: {"codes":["0151","0152","0111"]}',
                    'Se não conseguir identificar nenhum CNAE, retorne {"codes":[]}.',
                    'NUNCA retorne texto fora do JSON.',
                ].join('\n'),
                prompt: `Tipo de negócio: "${textQuery}"`,
                jsonMode: true,
                maxOutputTokens: 256,
            }),
            SEARCH_RF_AI_CNAE_TIMEOUT_MS,
            'AI_CNAE_INFERENCE_TIMEOUT',
        );

        const { extractJsonFromLlm } = await import('@/lib/ai');
        const parsed = extractJsonFromLlm<{ codes?: string[] }>(result.text);
        const codes = (parsed?.codes ?? [])
            .map((c: string) => String(c).replace(/\D/g, '').trim())
            .filter((c: string) => c.length >= 4 && c.length <= 7)
            .slice(0, 5);

        await setCached(cacheKey, codes, SEARCH_RF_AI_CNAE_CACHE_TTL);
        logger.info('AI CNAE inference', { textQuery, codes, provider: result.provider, model: result.model });
        return codes;
    } catch (err) {
        logger.warn('AI CNAE inference failed', {
            textQuery,
            error: err instanceof Error ? err.message : String(err),
        });
        return [];
    }
}

async function inferCnaesForSearch(textQuery: string, includedType?: string | null): Promise<string[]> {
    const terms: string[] = [textQuery];
    if (includedType) {
        terms.push(...(SEARCH_RF_CNAE_HINTS_BY_TYPE[includedType] ?? []));
    }

    // ── Step 1: expand via synonym map ──
    const queryNorm = normalizeRfTerm(textQuery);
    const queryTokens = tokenizeRfTerm(textQuery);
    // Match full query first, then individual tokens
    const synonymExpansion: string[] = [];
    for (const key of [queryNorm, ...queryTokens]) {
        const syn = CNAE_KEYWORD_SYNONYMS[key];
        if (syn) synonymExpansion.push(...syn);
    }
    if (synonymExpansion.length > 0) {
        terms.push(...synonymExpansion);
    }

    // ── Step 2: tokenize + dedupe all terms ──
    const allRaw = terms.flatMap((term) => [term, ...tokenizeRfTerm(term)]);
    const seen = new Set<string>();
    const expandedTerms: string[] = [];
    for (const raw of allRaw) {
        const norm = normalizeRfTerm(raw);
        if (norm.length < 2 || seen.has(norm)) continue;
        seen.add(norm);
        expandedTerms.push(norm);
    }

    // ── Step 3: lookup in CnaeCode table ──
    const found = new Set<string>();
    let lookups = 0;
    for (const term of expandedTerms) {
        if (lookups >= Math.max(1, SEARCH_RF_AUTO_CNAE_LOOKUPS)) break;
        lookups += 1;

        let matches: { code: string }[];
        if (/^\d+$/.test(term)) {
            matches = await prisma.cnaeCode.findMany({
                where: { code: { startsWith: term } },
                take: 8,
                select: { code: true },
            });
        } else {
            matches = await prisma.$queryRawUnsafe<{ code: string }[]>(
                `SELECT code FROM "CnaeCode" WHERE unaccent(lower(description)) LIKE $1 LIMIT 8`,
                `%${term}%`,
            );
        }
        for (const match of matches) {
            if (match.code?.trim()) found.add(match.code.trim());
            if (found.size >= Math.max(1, SEARCH_RF_AUTO_CNAE_LIMIT)) break;
        }
        if (found.size >= Math.max(1, SEARCH_RF_AUTO_CNAE_LIMIT)) break;
    }

    if (found.size > 0) {
        return Array.from(found).slice(0, Math.max(1, SEARCH_RF_AUTO_CNAE_LIMIT));
    }

    // ── Step 4: AI fallback when keyword search found nothing ──
    const aiCodes = await inferCnaesWithAI(textQuery);
    return aiCodes.slice(0, Math.max(1, SEARCH_RF_AUTO_CNAE_LIMIT));
}

async function searchRfPlacesForCross(
    cnaes: string[],
    state?: string | null,
    city?: string | null,
): Promise<PlaceResult[]> {
    if (cnaes.length === 0) return [];

    const maxResults = Math.max(10, Math.min(200, SEARCH_RF_MAX_RESULTS || 20));

    // Build UNION ALL query — each CNAE gets its own sub-query so PostgreSQL
    // can use a single Index Scan (uf, cnaePrincipal) per branch instead of
    // BitmapOr across all CNAEs. On 27M rows this avoids expensive bitmap
    // heap scans and expensive planning.
    const stateTrim = state?.trim();
    const hasState = stateTrim && stateTrim !== 'Todos';
    const cityTrim = city?.trim();
    const hasCity = !!cityTrim;

    const cols = `cnpj, "razaoSocial", "nomeFantasia", "cnaePrincipal", uf, municipio, bairro, logradouro, numero, ddd, telefone, porte`;
    const params: (string | number)[] = [];
    let paramIdx = 1;

    // Per-CNAE LIMIT: distribute the total limit across branches
    const perCnaeLimit = Math.max(5, Math.ceil(maxResults / cnaes.length));

    const branches: string[] = [];
    for (const code of cnaes) {
        const branchConds: string[] = [];

        if (hasState) {
            branchConds.push(`uf = $${paramIdx}`);
            params.push(stateTrim!.toUpperCase());
            paramIdx += 1;
        }

        if (code.length >= 7) {
            branchConds.push(`"cnaePrincipal" = $${paramIdx}`);
            params.push(code);
            paramIdx += 1;
        } else {
            const upper = code.slice(0, -1) + String.fromCharCode(code.charCodeAt(code.length - 1) + 1);
            branchConds.push(`"cnaePrincipal" >= $${paramIdx} AND "cnaePrincipal" < $${paramIdx + 1}`);
            params.push(code, upper);
            paramIdx += 2;
        }

        if (hasCity) {
            branchConds.push(`lower(municipio) LIKE $${paramIdx}`);
            params.push(`%${cityTrim!.toLowerCase()}%`);
            paramIdx += 1;
        }

        branches.push(
            `(SELECT ${cols} FROM "RfCompany" WHERE ${branchConds.join(' AND ')} LIMIT ${perCnaeLimit})`,
        );
    }

    params.push(maxResults);
    const sql = `SELECT * FROM (${branches.join(' UNION ALL ')}) sub LIMIT $${paramIdx}`;

    const companies = await prisma.$queryRawUnsafe<Array<{
        cnpj: string; razaoSocial: string; nomeFantasia: string | null; cnaePrincipal: string;
        uf: string; municipio: string | null; bairro: string | null; logradouro: string | null;
        numero: string | null; ddd: string | null; telefone: string | null; porte: string | null;
    }>>(sql, ...params);

    if (companies.length === 0) return [];

    const cnaeCodes = [...new Set(companies.map((item) => item.cnaePrincipal))];
    const cnaeRows = await prisma.cnaeCode.findMany({
        where: { code: { in: cnaeCodes } },
        select: { code: true, description: true },
    });
    const cnaeByCode = new Map(cnaeRows.map((row) => [row.code, row.description]));

    return companies.map((item) => {
        const phone = item.ddd && item.telefone ? `(${item.ddd}) ${item.telefone}` : item.telefone || undefined;
        const address = [item.logradouro, item.numero, item.bairro, item.municipio, item.uf].filter(Boolean).join(', ');
        const porteScore = item.porte === 'DEMAIS' ? 60 : item.porte === 'EPP' ? 50 : 40;

        return {
            id: `rf_${item.cnpj}`,
            displayName: { text: item.nomeFantasia || item.razaoSocial, languageCode: 'pt-BR' },
            formattedAddress: address || undefined,
            nationalPhoneNumber: phone,
            cnpj: item.cnpj,
            companyLegalName: item.razaoSocial,
            companyTradeName: item.nomeFantasia || undefined,
            companyMainCnae: cnaeByCode.get(item.cnaePrincipal) || item.cnaePrincipal,
            cnpjStatus: 'ATIVA',
            businessStatus: 'OPERATIONAL',
            opportunityScore: porteScore,
        } as PlaceResult;
    });
}

async function acquireRfCrossSlot(): Promise<() => void> {
    const maxInFlight = Math.max(1, SEARCH_RF_MAX_IN_FLIGHT);
    const deadline = Date.now() + Math.max(50, SEARCH_RF_BULKHEAD_ACQUIRE_TIMEOUT_MS);

    while (rfCrossInFlightCount >= maxInFlight) {
        if (Date.now() >= deadline) {
            throw new Error('RF_BULKHEAD_TIMEOUT');
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
    }

    rfCrossInFlightCount += 1;
    return () => {
        rfCrossInFlightCount = Math.max(0, rfCrossInFlightCount - 1);
    };
}

async function runRfCrossSearchCached(cnaes: string[], state?: string | null, city?: string | null): Promise<PlaceResult[]> {
    const cacheKey = buildRfCrossCacheKey(cnaes, state, city);
    if (SEARCH_RF_CACHE_ENABLED) {
        const cached = await getCached<PlaceResult[]>(cacheKey);
        if (cached && cached.length > 0) {
            return cloneJson(cached);
        }
    }

    const inFlight = inFlightRfCrossSearch.get(cacheKey);
    if (inFlight) {
        return cloneJson(await inFlight);
    }

    const requestPromise = searchRfPlacesForCross(cnaes, state, city)
        .finally(() => {
            inFlightRfCrossSearch.delete(cacheKey);
        });
    inFlightRfCrossSearch.set(cacheKey, requestPromise);

    const result = cloneJson(await requestPromise);
    if (SEARCH_RF_CACHE_ENABLED) {
        await setCached(cacheKey, result, Math.max(60, SEARCH_RF_CACHE_TTL_SECONDS));
    }
    return result;
}

/** Suffixes commonly found in RF company names that should be stripped for matching. */
const RF_NAME_SUFFIXES = /\b(ltda|me|eireli|epp|sa|s\.a|s\/a|ss|ltd|inc|co|cia|filial|matriz)\b/gi;

/** Normalize company name for fuzzy matching: strip suffixes, punctuation, extra spaces. */
function normalizeCompanyName(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(RF_NAME_SUFFIXES, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Token overlap ratio between two normalized names (0..1). */
function tokenOverlap(a: string, b: string): number {
    const tokA = new Set(a.split(' ').filter((t) => t.length >= 3));
    const tokB = new Set(b.split(' ').filter((t) => t.length >= 3));
    if (tokA.size === 0 || tokB.size === 0) return 0;
    let overlap = 0;
    for (const t of tokA) {
        if (tokB.has(t)) overlap++;
    }
    const minLen = Math.min(tokA.size, tokB.size);
    return overlap / minLen;
}

/** Try to find matching RF place for a Google place using fuzzy name matching. */
function findRfMatchForGooglePlace(
    gpNameNorm: string,
    rfIndex: Map<string, PlaceResult>,
    rfNormNames: Map<string, string>,
): PlaceResult | null {
    // 1. Exact match on normalized name
    const exactKey = rfIndex.get(gpNameNorm);
    if (exactKey) return exactKey;

    // 2. Token overlap ≥ 60% (handles "Agência XYZ Marketing" vs "XYZ MARKETING DIGITAL LTDA")
    for (const [rfNorm, rfOrigKey] of rfNormNames) {
        if (tokenOverlap(gpNameNorm, rfNorm) >= 0.6) {
            return rfIndex.get(rfOrigKey) ?? null;
        }
        // Substring match (one name contains the other)
        if (gpNameNorm.length >= 5 && rfNorm.length >= 5) {
            if (gpNameNorm.includes(rfNorm) || rfNorm.includes(gpNameNorm)) {
                return rfIndex.get(rfOrigKey) ?? null;
            }
        }
    }
    return null;
}

function mergeRfAndGooglePlaces(rfPlaces: PlaceResult[], googlePlaces: PlaceResult[]): PlaceResult[] {
    const result: PlaceResult[] = [];
    const seenKeys = new Set<string>();
    const matchedRfKeys = new Set<string>();

    // Build RF indexes: by original lowercase key + by normalized name
    const rfByOrigKey = new Map<string, PlaceResult>();
    const rfNormToOrigKey = new Map<string, string>(); // normalized → original key

    for (const rf of rfPlaces) {
        const origKey = (rf.displayName?.text ?? '').toLowerCase().trim();
        if (!origKey) continue;
        rfByOrigKey.set(origKey, rf);
        const norm = normalizeCompanyName(rf.displayName?.text ?? '');
        if (norm) rfNormToOrigKey.set(norm, origKey);
        // Also index by companyTradeName and companyLegalName
        if (rf.companyTradeName) {
            const tradeNorm = normalizeCompanyName(rf.companyTradeName);
            if (tradeNorm) rfNormToOrigKey.set(tradeNorm, origKey);
        }
        if (rf.companyLegalName) {
            const legalNorm = normalizeCompanyName(rf.companyLegalName);
            if (legalNorm) rfNormToOrigKey.set(legalNorm, origKey);
        }
    }

    // Walk Google results; try fuzzy match with RF
    for (const gp of googlePlaces) {
        const gpKey = (gp.displayName?.text ?? '').toLowerCase().trim();
        if (!gpKey || seenKeys.has(gpKey)) continue;
        seenKeys.add(gpKey);

        const gpNorm = normalizeCompanyName(gp.displayName?.text ?? '');
        const rfMatch = findRfMatchForGooglePlace(gpNorm, rfByOrigKey, rfNormToOrigKey);
        if (rfMatch) {
            const rfKey = (rfMatch.displayName?.text ?? '').toLowerCase().trim();
            matchedRfKeys.add(rfKey);

            // Collect ALL unique phones from both sources
            const allPhones = deduplicateContacts([
                gp.nationalPhoneNumber,
                gp.internationalPhoneNumber,
                gp.phone,
                rfMatch.nationalPhoneNumber,
                rfMatch.phone,
            ], normalizePhoneForDedup);

            // Collect ALL unique emails from both sources
            const allEmails = deduplicateContacts([
                gp.email,
                rfMatch.email,
            ], (v) => v.toLowerCase().trim());

            // Collect ALL unique websites from both sources
            const allWebsites = deduplicateContacts([
                gp.websiteUri,
                gp.website,
                rfMatch.websiteUri,
                rfMatch.website,
            ], normalizeWebsiteForDedup);

            result.push({
                ...gp,
                nationalPhoneNumber: gp.nationalPhoneNumber || gp.internationalPhoneNumber || rfMatch.nationalPhoneNumber,
                email: gp.email || rfMatch.email,
                cnpj: rfMatch.cnpj ?? gp.cnpj,
                companyLegalName: rfMatch.companyLegalName ?? gp.companyLegalName,
                companyTradeName: rfMatch.companyTradeName ?? gp.companyTradeName,
                companyMainCnae: rfMatch.companyMainCnae ?? gp.companyMainCnae,
                cnpjStatus: rfMatch.cnpjStatus ?? gp.cnpjStatus,
                phones: allPhones,
                emails: allEmails,
                websites: allWebsites,
            });
        } else {
            result.push(gp);
        }
    }

    // Append RF-only results not matched
    for (const rf of rfPlaces) {
        const rfKey = (rf.displayName?.text ?? '').toLowerCase().trim();
        if (!rfKey || seenKeys.has(rfKey) || matchedRfKeys.has(rfKey)) continue;
        seenKeys.add(rfKey);
        result.push(rf);
    }

    logger.info('Search RF merge', {
        googleCount: googlePlaces.length,
        rfCount: rfPlaces.length,
        merged: matchedRfKeys.size,
        rfOnlyAppended: result.length - googlePlaces.length,
        totalResult: result.length,
    });

    return result;
}

async function crossWithReceitaIfEligible(
    places: PlaceResult[],
    textQuery: string,
    includedType?: string | null,
    city?: string | null,
    state?: string | null,
    country?: string | null,
): Promise<PlaceResult[]> {
    if (!SEARCH_RF_CROSS_ENABLED || !isBrazilCountry(country)) return places;

    try {
        const releaseSlot = await acquireRfCrossSlot();
        try {
        const cnaes = await withTimeout(
            inferCnaesForSearch(textQuery, includedType),
            SEARCH_RF_CROSS_TIMEOUT_MS,
            'RF_CNAE_INFERENCE_TIMEOUT',
        );
        if (cnaes.length === 0) {
            logger.info('Search RF cross: no inferred CNAE', { textQuery, includedType: includedType ?? null });
            return places;
        }

        const rfPlaces = await withTimeout(
            runRfCrossSearchCached(cnaes, state, city),
            SEARCH_RF_CROSS_TIMEOUT_MS,
            'RF_SEARCH_TIMEOUT',
        );
        logger.info('Search RF cross', {
            textQuery,
            includedType: includedType ?? null,
            inferredCnaes: cnaes,
            rfCount: rfPlaces.length,
            baseCount: places.length,
        });
        if (rfPlaces.length === 0) return places;
        return mergeRfAndGooglePlaces(rfPlaces, places);
        } finally {
            releaseSlot();
        }
    } catch (error) {
        logger.info('Search RF cross failed', {
            textQuery,
            includedType: includedType ?? null,
            error: error instanceof Error ? error.message : 'Unknown',
        });
        return places;
    }
}

function buildTextSearchDedupKey(
    input: ExecuteSearchInput,
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
    input: SearchInput,
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

async function runCoalescedTextSearch(
    input: ExecuteSearchInput,
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

async function runCoalescedTextSearchAllPages(
    input: SearchInput,
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
            // Merge lead DB contacts into the dedup arrays
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
        } as PlaceResult;
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
    const membership = user.workspaces[0];
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
    params: TryCacheOrDbSearchParams,
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
    } else if (state?.trim() && state !== 'Todos') {
        // State-level constraint when no city is provided.
        dbWhere.address = { contains: state.trim(), mode: 'insensitive' };
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

/** Build a deterministic cache key for search results (includes city for location correctness). */
function buildCacheKey(
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
    enqueueLeadSync(places);

    // Write-through cache: store results for subsequent identical queries
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
    setCached(scopedCacheKey, { places }, SEARCH_CACHE_TTL_SECONDS).catch(() => { /* cache is optional */ });

    await prisma.workspace.update({
        where: { id: activeWorkspace.id },
        data: { leadsUsed: { increment: 1 } },
    });

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
    // State-only (no city): use max radius (50km) since it's a bias, not restriction.
    // Google Places still respects the textQuery which includes the state name.
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
            // First page: cross-reference with RF (Serper moved to individual lead analysis)
            const crossed = await crossWithReceitaIfEligible(
                googlePlaces,
                input.textQuery,
                input.includedType,
                location?.city,
                location?.state,
                country,
            );
            result.places = collectAllContacts(crossed);
        } else {
            // Pagination: skip RF cross + Serper to save CPU
            result.places = googlePlaces;
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
        result.places = await hydratePlacesWithLeadSnapshot(result.places);
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
        city: city ?? null,
        state: state ?? null,
        country: country ?? null,
    });

    const { activeWorkspace } = await getSearchUserAndWorkspaceOrThrow(userId);
    const locationInfo = { city: city ?? null, state: state ?? null, country: country ?? null };
    const saveHistory = createSaveHistoryForSearch(activeWorkspace, userId, textQuery, effectivePageSize, filtersPayload, locationInfo);

    const earlyResult = await tryCacheOrDbSearch(
        pageToken,
        { workspaceId: activeWorkspace.id, userId, textQuery, includedType, effectivePageSize, hasWebsite, hasPhone, city, state, country },
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
