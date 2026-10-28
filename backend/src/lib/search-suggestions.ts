/**
 * Turns a seller profile ("what I sell / who buys it") into concrete local search terms.
 * New users describe their ideal customer ("pequenas empresas", "consórcio para empresas");
 * Google Places needs a business category ("clínicas odontológicas"). Without this the first
 * search returns the user's own competitors or a vague list — and they never come back.
 */
import { getCached, setCached } from '@/lib/redis';
import { logger } from '@/lib/logger';

const CACHE_TTL_S = 30 * 24 * 3600;
const AI_TIMEOUT_MS = 8000;
export const MAX_SUGGESTIONS = 4;

export interface SearchSuggestionInput {
    productService?: string | null;
    targetAudience?: string | null;
    locale?: 'pt' | 'en';
}

function normalize(text: string): string {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Without AI: split the target audience into categories ("dentistas, clínicas e academias"). */
export function heuristicSuggestions(input: SearchSuggestionInput): string[] {
    const source = input.targetAudience?.trim() || '';
    return source
        .split(/,|;|\/|\be\b|\bou\b|\band\b|\bor\b/i)
        .map((s) => s.replace(/\b(pequen[ao]s?|médi[ao]s?|grandes?|empresas? de|negócios? de|com até \d+ funcion[aá]rios)\b/gi, '').trim())
        .filter((s) => s.length >= 4)
        .slice(0, MAX_SUGGESTIONS);
}

function sanitize(list: unknown): string[] {
    if (!Array.isArray(list)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of list) {
        if (typeof item !== 'string') continue;
        const term = item.replace(/[^\p{L}\p{N}\s&-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60);
        const key = normalize(term);
        if (term.length < 3 || seen.has(key)) continue;
        seen.add(key);
        out.push(term);
        if (out.length >= MAX_SUGGESTIONS) break;
    }
    return out;
}

export async function suggestSearchTerms(input: SearchSuggestionInput): Promise<string[]> {
    const product = input.productService?.trim() ?? '';
    const audience = input.targetAudience?.trim() ?? '';
    if (!product && !audience) return [];
    const en = input.locale === 'en';
    const cacheKey = `search:suggest:${en ? 'en' : 'pt'}:${normalize(product)}|${normalize(audience)}`;
    const cached = await getCached<string[]>(cacheKey);
    if (cached?.length) return cached;

    try {
        const { generateCompletionForRole, extractJsonFromLlm } = await import('@/lib/ai');
        const result = await Promise.race([
            generateCompletionForRole('lead_analysis', {
                systemPrompt: (en
                    ? [
                        'You help a B2B seller find local businesses to sell to on Google Maps.',
                        'Given what the seller offers and who buys it, return the business categories the seller should prospect.',
                        'Each term must be a concrete business category as people search on Google Maps (e.g. "dental clinics", "restaurants").',
                        'NEVER return the seller\'s own category (those are competitors, not customers). No company sizes, no cities.',
                        'Return ONLY JSON: {"terms": ["...", "..."]} with 2 to 4 terms.',
                    ]
                    : [
                        'Você ajuda um vendedor B2B a encontrar empresas locais para prospectar no Google Maps.',
                        'Com base no que o vendedor oferece e em quem compra, liste as categorias de negócio que ele deve prospectar.',
                        'Cada termo deve ser uma categoria concreta como as pessoas buscam no Google Maps (ex.: "clínicas odontológicas", "restaurantes", "academias").',
                        'NUNCA devolva a própria categoria do vendedor (são concorrentes, não clientes). Sem porte, sem cidade.',
                        'Retorne SOMENTE JSON: {"terms": ["...", "..."]} com 2 a 4 termos.',
                    ]).join('\n'),
                prompt: `${en ? 'Seller offers' : 'O vendedor oferece'}: "${product || '-'}"\n${en ? 'Ideal customer' : 'Cliente ideal'}: "${audience || '-'}"`,
                jsonMode: true,
                maxOutputTokens: 200,
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SUGGEST_TIMEOUT')), AI_TIMEOUT_MS)),
        ]);
        const terms = sanitize(extractJsonFromLlm<{ terms?: unknown }>(result.text)?.terms);
        if (terms.length > 0) {
            await setCached(cacheKey, terms, CACHE_TTL_S);
            return terms;
        }
    } catch (err) {
        logger.warn('Search suggestions via AI failed — using heuristic', { error: err instanceof Error ? err.message : 'Unknown' });
    }
    return heuristicSuggestions(input);
}
