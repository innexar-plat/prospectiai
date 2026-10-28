/**
 * Fuzzy name+address matching against the RfCompany table (27M+ records).
 * Uses pg_trgm (trigram) extension for efficient similarity search.
 * Returns matched CNPJ + confidence score (0-100).
 */
import { prisma } from './prisma';

export interface RfFuzzyMatchResult {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    municipio: string | null;
    logradouro: string | null;
    numero: string | null;
    email: string | null;
    ddd: string | null;
    telefone: string | null;
    porte: string | null;
    capitalSocial: number | null;
    cnaePrincipal: string | null;
    dataAbertura: string | null;
    matchConfidence: number;       // 0-100
    matchMethod: string;           // e.g. 'cnpj_direct', 'name_exact_city', 'name_fuzzy_city', 'name_fuzzy_address'
}

/**
 * Extract city name from a Google Places formatted address.
 * Typical format: "Rua X, 123 - Bairro, Cidade - UF, CEP, Brasil"
 */
/** Uppercase without accents — the Receita Federal base stores names and cities this way. */
export function toRfText(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

/**
 * Splits a Brazilian phone into (ddd, number) as stored in the RF base:
 * "(47) 3322-1100" / "+55 47 99911-2233" → { ddd: "47", number: "33221100" }.
 */
export function splitBrPhone(phone: string | null | undefined): { ddd: string; number: string } | null {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length < 10 || digits.length > 11) return null;
    return { ddd: digits.slice(0, 2), number: digits.slice(2) };
}

function extractCityFromAddress(address: string): string | null {
    if (!address) return null;
    // Try pattern: "Bairro, Cidade - UF" or "Cidade - UF"
    const parts = address.split(',').map(p => p.trim());
    for (const part of parts) {
        const dashSplit = part.split(' - ');
        if (dashSplit.length === 2) {
            const city = dashSplit[0]!.trim();
            const uf = dashSplit[1]!.trim();
            // UF is 2 chars
            if (uf.length === 2 && city.length > 2) return toRfText(city);
        }
    }
    // Fallback: try second-to-last comma segment before CEP
    if (parts.length >= 3) {
        const candidate = parts[parts.length - 3]?.split(' - ')[0]?.trim();
        if (candidate && candidate.length > 2) return toRfText(candidate);
    }
    return null;
}

/**
 * Extract street number from address text.
 */
function extractStreetNumber(address: string): string | null {
    if (!address) return null;
    // "Rua Vitorio Morbim, 10" → "10"
    const match = address.match(/,\s*(\d+)/);
    return match?.[1] ?? null;
}

/**
 * Normalize a business name for comparison: uppercase, remove common suffixes, trim.
 */
function normalizeName(name: string): string {
    return toRfText(name)
        .replace(/\s+(LTDA|ME|EIRELI|S\.?A\.?|EPP|MEI|FILIAL|MATRIZ)\b/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculate a simple word-overlap similarity (0-1) between two strings.
 */
function wordSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.split(' ').filter(w => w.length > 2));
    const wordsB = new Set(b.split(' ').filter(w => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let overlap = 0;
    for (const w of wordsA) if (wordsB.has(w)) overlap++;
    return overlap / Math.max(wordsA.size, wordsB.size);
}

type RfRow = Omit<RfFuzzyMatchResult, 'matchConfidence' | 'matchMethod'>;
type RfRowWithSim = RfRow & { sim: number };

const RF_COLUMNS = `cnpj, "razaoSocial", "nomeFantasia", municipio, logradouro, numero,
       email, ddd, telefone, porte, "capitalSocial", "cnaePrincipal", "dataAbertura"`;

/** Per-lookup budget: a slow match is skipped, never allowed to hog the database. */
const RF_MATCH_TIMEOUT_MS = Number.parseInt(process.env.RF_MATCH_TIMEOUT_MS ?? '2000', 10);
const RF_TRGM_THRESHOLD = Number.parseFloat(process.env.RF_TRGM_THRESHOLD ?? '0.55');

/**
 * Runs a lookup with hard limits scoped to its transaction: statement timeout, no parallel
 * workers (one lead must not take 5 cores) and no JIT (pure overhead for these short queries).
 */
async function boundedQuery<T>(sql: string, params: unknown[]): Promise<T[]> {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${Math.max(300, RF_MATCH_TIMEOUT_MS)}`);
        await tx.$executeRawUnsafe('SET LOCAL max_parallel_workers_per_gather = 0');
        await tx.$executeRawUnsafe('SET LOCAL jit = off');
        await tx.$executeRawUnsafe(`SET LOCAL pg_trgm.similarity_threshold = ${RF_TRGM_THRESHOLD}`);
        return tx.$queryRawUnsafe<T[]>(sql, ...params);
    });
}

/**
 * Finds the RfCompany behind a Google Places result. Cheapest and most reliable first:
 *  1. phone exact (ddd + number index) — most Google results have a phone
 *  2. exact trade name in the city
 *  3. trigram on trade name, then legal name, inside the city
 * The trigram predicates use upper(...) so they hit the GIN indexes; the old `"nomeFantasia" %`
 * form missed them and scanned every company in the city (20 s / 5 cores in São Paulo).
 */
export async function fuzzyMatchRfCompany(
    businessName: string,
    address: string,
    phone?: string | null,
): Promise<RfFuzzyMatchResult | null> {
    const city = extractCityFromAddress(address);
    const streetNumber = extractStreetNumber(address);
    const normalizedName = normalizeName(businessName);
    if (normalizedName.length < 3) return null;

    try {
        const tel = splitBrPhone(phone);
        if (tel) {
            const byPhone = await boundedQuery<RfRow>(
                `SELECT ${RF_COLUMNS} FROM "RfCompany" WHERE ddd = $1 AND telefone = $2 LIMIT 5`,
                [tel.ddd, tel.number],
            );
            if (byPhone.length > 0) {
                // Shared numbers (accountants, franchises) → prefer the one whose name also matches.
                const best = byPhone.length === 1
                    ? byPhone[0]!
                    : byPhone.reduce((a, b) => (
                        wordSimilarity(normalizedName, normalizeName(b.nomeFantasia || b.razaoSocial))
                            > wordSimilarity(normalizedName, normalizeName(a.nomeFantasia || a.razaoSocial)) ? b : a));
                const nameSim = wordSimilarity(normalizedName, normalizeName(best.nomeFantasia || best.razaoSocial));
                return { ...best, matchConfidence: byPhone.length === 1 || nameSim > 0 ? 92 : 70, matchMethod: 'phone_exact' };
            }
        }

        if (!city) return null;

        const exactMatches = await boundedQuery<RfRow>(
            `SELECT ${RF_COLUMNS} FROM "RfCompany" WHERE municipio = $1 AND upper("nomeFantasia") = $2 LIMIT 5`,
            [city, normalizedName],
        );
        if (exactMatches.length === 1) {
            return { ...exactMatches[0]!, matchConfidence: 95, matchMethod: 'name_exact_city' };
        }
        if (exactMatches.length > 1) {
            const withAddress = streetNumber ? exactMatches.find((m) => m.numero === streetNumber) : undefined;
            if (withAddress) return { ...withAddress, matchConfidence: 98, matchMethod: 'name_exact_city_address' };
            return { ...exactMatches[0]!, matchConfidence: 75, matchMethod: 'name_exact_city_multiple' };
        }

        const fuzzy = await boundedQuery<RfRowWithSim>(
            `SELECT ${RF_COLUMNS}, similarity(upper("nomeFantasia"), $2) AS sim
             FROM "RfCompany" WHERE municipio = $1 AND upper("nomeFantasia") % $2
             ORDER BY sim DESC LIMIT 5`,
            [city, normalizedName],
        );
        if (fuzzy.length > 0 && Number(fuzzy[0]!.sim) >= 0.6) {
            const { sim, ...best } = fuzzy[0]!;
            let confidence = Math.round(Number(sim) * 80);
            let method = 'name_fuzzy_city';
            if (streetNumber && best.numero === streetNumber) {
                confidence = Math.min(95, confidence + 15);
                method = 'name_fuzzy_city_address';
            }
            return { ...best, matchConfidence: confidence, matchMethod: method };
        }

        const byLegal = await boundedQuery<RfRowWithSim>(
            `SELECT ${RF_COLUMNS}, similarity(upper("razaoSocial"), $2) AS sim
             FROM "RfCompany" WHERE municipio = $1 AND upper("razaoSocial") % $2
             ORDER BY sim DESC LIMIT 3`,
            [city, normalizedName],
        );
        if (byLegal.length > 0 && Number(byLegal[0]!.sim) >= 0.5) {
            const { sim, ...best } = byLegal[0]!;
            let confidence = Math.round(Number(sim) * 65);
            if (streetNumber && best.numero === streetNumber) confidence = Math.min(85, confidence + 15);
            return { ...best, matchConfidence: confidence, matchMethod: 'razao_fuzzy_city' };
        }
        return null;
    } catch {
        // Timeout or DB error: skip enrichment for this lead rather than block the sync.
        return null;
    }
}
