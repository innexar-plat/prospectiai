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
            if (uf.length === 2 && city.length > 2) return city.toUpperCase();
        }
    }
    // Fallback: try second-to-last comma segment before CEP
    if (parts.length >= 3) {
        const candidate = parts[parts.length - 3]?.split(' - ')[0]?.trim();
        if (candidate && candidate.length > 2) return candidate.toUpperCase();
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
    return name
        .toUpperCase()
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

/**
 * Try to find an RfCompany match by name + city using trigram similarity.
 * Returns up to 5 candidates sorted by similarity, then refines with address.
 */
export async function fuzzyMatchRfCompany(
    businessName: string,
    address: string,
): Promise<RfFuzzyMatchResult | null> {
    const city = extractCityFromAddress(address);
    const streetNumber = extractStreetNumber(address);
    const normalizedName = normalizeName(businessName);

    if (normalizedName.length < 3) return null;

    try {
        // Step 1: Try exact nomeFantasia match in city (fast, uses index)
        if (city) {
            const exactMatches = await prisma.$queryRaw<Array<{
                cnpj: string; razaoSocial: string; nomeFantasia: string | null;
                municipio: string | null; logradouro: string | null; numero: string | null;
                email: string | null; ddd: string | null; telefone: string | null;
                porte: string | null; capitalSocial: number | null;
                cnaePrincipal: string | null; dataAbertura: string | null;
            }>>`
                SELECT cnpj, "razaoSocial", "nomeFantasia", municipio, logradouro, numero,
                       email, ddd, telefone, porte, "capitalSocial", "cnaePrincipal", "dataAbertura"
                FROM "RfCompany"
                WHERE UPPER("nomeFantasia") = ${normalizedName}
                  AND UPPER(municipio) = ${city}
                LIMIT 5
            `;

            if (exactMatches.length === 1) {
                return { ...exactMatches[0]!, matchConfidence: 95, matchMethod: 'name_exact_city' } satisfies RfFuzzyMatchResult;
            }
            if (exactMatches.length > 1 && streetNumber) {
                const withAddress = exactMatches.find(m => m.numero === streetNumber);
                if (withAddress) return { ...withAddress, matchConfidence: 98, matchMethod: 'name_exact_city_address' } satisfies RfFuzzyMatchResult;
            }
            if (exactMatches.length > 1) {
                return { ...exactMatches[0]!, matchConfidence: 75, matchMethod: 'name_exact_city_multiple' } satisfies RfFuzzyMatchResult;
            }
        }

        // Step 2: Trigram fuzzy match on nomeFantasia + city (uses GIN index)
        if (city) {
            const fuzzyMatches = await prisma.$queryRaw<Array<{
                cnpj: string; razaoSocial: string; nomeFantasia: string | null;
                municipio: string | null; logradouro: string | null; numero: string | null;
                email: string | null; ddd: string | null; telefone: string | null;
                porte: string | null; capitalSocial: number | null;
                cnaePrincipal: string | null; dataAbertura: string | null;
                sim: number;
            }>>`
                SELECT cnpj, "razaoSocial", "nomeFantasia", municipio, logradouro, numero,
                       email, ddd, telefone, porte, "capitalSocial", "cnaePrincipal", "dataAbertura",
                       similarity(UPPER("nomeFantasia"), ${normalizedName}) as sim
                FROM "RfCompany"
                WHERE UPPER(municipio) = ${city}
                  AND "nomeFantasia" % ${normalizedName}
                ORDER BY sim DESC
                LIMIT 5
            `;

            if (fuzzyMatches.length > 0) {
                const best = fuzzyMatches[0]!;
                const sim = Number(best.sim);
                if (sim >= 0.6) {
                    let confidence = Math.round(sim * 80);
                    let method = 'name_fuzzy_city';
                    if (streetNumber && best.numero === streetNumber) {
                        confidence = Math.min(95, confidence + 15);
                        method = 'name_fuzzy_city_address';
                    }
                    const { sim: _s, ...rest } = best;
                    return { ...rest, matchConfidence: confidence, matchMethod: method } satisfies RfFuzzyMatchResult;
                }
            }
        }

        // Step 3: Try razaoSocial match (fallback)
        if (city) {
            const razaoMatches = await prisma.$queryRaw<Array<{
                cnpj: string; razaoSocial: string; nomeFantasia: string | null;
                municipio: string | null; logradouro: string | null; numero: string | null;
                email: string | null; ddd: string | null; telefone: string | null;
                porte: string | null; capitalSocial: number | null;
                cnaePrincipal: string | null; dataAbertura: string | null;
                sim: number;
            }>>`
                SELECT cnpj, "razaoSocial", "nomeFantasia", municipio, logradouro, numero,
                       email, ddd, telefone, porte, "capitalSocial", "cnaePrincipal", "dataAbertura",
                       similarity(UPPER("razaoSocial"), ${normalizedName}) as sim
                FROM "RfCompany"
                WHERE UPPER(municipio) = ${city}
                  AND "razaoSocial" % ${normalizedName}
                ORDER BY sim DESC
                LIMIT 3
            `;

            if (razaoMatches.length > 0 && Number(razaoMatches[0]!.sim) >= 0.5) {
                const best = razaoMatches[0]!;
                const sim = Number(best.sim);
                let confidence = Math.round(sim * 65);
                if (streetNumber && best.numero === streetNumber) confidence = Math.min(85, confidence + 15);
                const { sim: _s, ...rest } = best;
                return { ...rest, matchConfidence: confidence, matchMethod: 'razao_fuzzy_city' } satisfies RfFuzzyMatchResult;
            }
        }

        return null;
    } catch (error) {
        // Gracefully fail — don't block lead sync
        return null;
    }
}
