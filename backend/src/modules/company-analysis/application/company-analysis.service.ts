/**
 * Company analysis module — application layer.
 * Uses workspace profile, Serper (reviews, social), optional Google Places (reviews), and IA.
 */

import { generateCompletionForRole, resolveAiForRole } from '@/lib/ai';
import { getWebContextForRole } from '@/lib/web-search/resolve';
import { geocodeAddress } from '@/lib/geocode';
import { textSearch, getPlaceDetails } from '@/lib/google-places';
import { recordUsageEvent } from '@/lib/usage';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { Market } from '@/lib/market';
import { MARKET } from '@/lib/market';
import type { CompanyAnalysisInput, CompanyAnalysisReport } from '../domain/types';
import {
    buildCompanyAnalysisPrompt,
    buildPlacesBlock,
    buildProfileBlock,
    buildSerperQueries,
    getPlacesLocale,
} from './company-analysis-locale';
import { resolveCountryLocale } from '@/lib/country-locale';

const MAX_REVIEW_SNIPPETS = 5;
const PLACES_RADIUS_M = 10000;

/** Normalise text for fuzzy comparison: lowercase, trim, remove accents and common suffixes. */
function normalise(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(ltda|me|eireli|s\.?a\.?|epp|ei|s\/s|ss|s\/a|llc|inc|corp|co)\b/gi, '')
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Check if two business names are similar enough (token overlap ≥ 40%). */
function nameMatches(searched: string, found: string): boolean {
    const a = normalise(searched).split(' ').filter(Boolean);
    const b = normalise(found).split(' ').filter(Boolean);
    if (a.length === 0 || b.length === 0) return false;
    const matches = a.filter((tok) => b.some((bt) => bt.includes(tok) || tok.includes(bt)));
    return matches.length / a.length >= 0.4;
}

async function fetchGooglePlacesContext(
    companyName: string,
    city: string | undefined,
    state: string | undefined,
    address: string | undefined,
    workspaceId: string,
    market: Market,
    country?: string,
    locale?: string,
): Promise<{ matchedName?: string; rating?: number; userRatingCount?: number; reviewsSnippets: string[] } | null> {
    const cityOrAddress = city?.trim() || address?.trim();
    if (!cityOrAddress) return null;

    const geocodeCountry = country?.trim()
        ? resolveCountryLocale(country).queryLabel
        : (market === 'US' ? 'United States' : 'Brasil');
    const placesLocale = getPlacesLocale(market, locale);

    try {
        const coords = await geocodeAddress(
            city?.trim() || address?.trim() || '',
            state ?? null,
            geocodeCountry,
        );
        if (!coords) return null;

        const textQuery = `${companyName} ${city?.trim() || ''}`.trim();
        const { places } = await textSearch({
            textQuery,
            pageSize: 5,
            languageCode: placesLocale.languageCode,
            regionCode: placesLocale.regionCode,
            locationBias: {
                center: { latitude: coords.latitude, longitude: coords.longitude },
                radius: PLACES_RADIUS_M,
            },
        });
        recordUsageEvent({ workspaceId, type: 'GOOGLE_PLACES_SEARCH', quantity: 1 });

        const matched = places.find((p) => p.displayName?.text && nameMatches(companyName, p.displayName.text));
        const first = matched ?? places[0];
        if (!first?.id) return null;

        if (!matched && first.displayName?.text && !nameMatches(companyName, first.displayName.text)) {
            logger.info('Google Places: no name match found, skipping', {
                searched: companyName,
                firstResult: first.displayName.text,
                market,
            });
            return null;
        }

        const details = await getPlaceDetails(first.id);
        recordUsageEvent({ workspaceId, type: 'GOOGLE_PLACES_DETAILS', quantity: 1 });
        const reviews = details.reviews ?? [];
        const reviewsSnippets = reviews
            .slice(0, MAX_REVIEW_SNIPPETS)
            .map((r) => (r.text?.text ?? '').slice(0, 300))
            .filter(Boolean);

        return {
            matchedName: first.displayName?.text ?? companyName,
            rating: details.rating,
            userRatingCount: details.userRatingCount,
            reviewsSnippets,
        };
    } catch (err) {
        logger.warn('Google Places context failed', {
            error: err instanceof Error ? err.message : 'Unknown',
            market,
        });
        return null;
    }
}

async function getWorkspaceIdForUser(userId: string): Promise<string | undefined> {
    const user = await prisma.user.findFirst({
        where: { id: userId },
        include: { workspaces: { include: { workspace: true }, orderBy: { workspace: { createdAt: 'asc' } }, take: 1 } },
    });
    return user?.workspaces?.length ? user.workspaces[0]!.workspace.id : undefined;
}

function parseSocialNetworks(sn: unknown): CompanyAnalysisReport['socialNetworks'] {
    if (!sn || typeof sn !== 'object' || Array.isArray(sn)) return { presence: '' };
    const o = sn as Record<string, unknown>;
    return {
        presence: typeof o.presence === 'string' ? o.presence : '',
        perNetwork: Array.isArray(o.perNetwork) ? (o.perNetwork as CompanyAnalysisReport['socialNetworks']['perNetwork']) : undefined,
        consistency: typeof o.consistency === 'string' ? o.consistency : undefined,
        recommendations: Array.isArray(o.recommendations) ? (o.recommendations as string[]) : undefined,
    };
}

function parseCompanyAnalysisResult(parsed: Record<string, unknown>): CompanyAnalysisReport {
    return {
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'Análise gerada.',
        strengths: Array.isArray(parsed.strengths) ? (parsed.strengths as string[]) : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? (parsed.weaknesses as string[]) : [],
        opportunities: Array.isArray(parsed.opportunities) ? (parsed.opportunities as string[]) : [],
        reclameAquiSummary: typeof parsed.reclameAquiSummary === 'string' ? parsed.reclameAquiSummary : undefined,
        googlePresenceScore: typeof parsed.googlePresenceScore === 'number' ? parsed.googlePresenceScore : undefined,
        googleRating: typeof parsed.googleRating === 'number' ? parsed.googleRating : undefined,
        googleReviewCount: typeof parsed.googleReviewCount === 'number' ? parsed.googleReviewCount : undefined,
        googleReviewsSnippets: Array.isArray(parsed.googleReviewsSnippets) ? (parsed.googleReviewsSnippets as string[]) : undefined,
        socialNetworks: parseSocialNetworks(parsed.socialNetworks),
        suggestedNiche: typeof parsed.suggestedNiche === 'string' ? parsed.suggestedNiche : undefined,
        suggestedBusinessModel: typeof parsed.suggestedBusinessModel === 'string' ? parsed.suggestedBusinessModel : undefined,
        recommendations: Array.isArray(parsed.recommendations) ? (parsed.recommendations as string[]) : [],
    };
}

function fallbackReport(locale: string): CompanyAnalysisReport {
    const lang = locale === 'en' ? 'en' : locale === 'es' ? 'es' : 'pt';
    if (lang === 'en') {
        return {
            summary: 'Unable to generate the full analysis. Please try again.',
            strengths: [],
            weaknesses: [],
            opportunities: [],
            socialNetworks: { presence: '' },
            recommendations: ['Complete your company profile and run the analysis again.'],
        };
    }
    if (lang === 'es') {
        return {
            summary: 'No fue posible generar el análisis completo. Intente de nuevo.',
            strengths: [],
            weaknesses: [],
            opportunities: [],
            socialNetworks: { presence: '' },
            recommendations: ['Complete el perfil de la empresa y ejecute el análisis nuevamente.'],
        };
    }
    return {
        summary: 'Não foi possível gerar a análise completa. Tente novamente.',
        strengths: [],
        weaknesses: [],
        opportunities: [],
        socialNetworks: { presence: '' },
        recommendations: ['Preencha o perfil da empresa e execute novamente.'],
    };
}

export async function runCompanyAnalysis(
    input: CompanyAnalysisInput,
    userId: string,
    market: Market = MARKET,
    locale: string = market === 'US' ? 'en' : 'pt',
): Promise<CompanyAnalysisReport> {
    const workspaceId = await getWorkspaceIdForUser(userId);

    const queries = buildSerperQueries(input, market);
    const webContext = await getWebContextForRole('company_analysis', queries, {
        workspaceId: workspaceId ?? undefined,
        userId,
    });

    const city = input.city?.trim();
    const state = input.state?.trim();
    const placesContext =
        workspaceId && (city || input.address)
            ? await fetchGooglePlacesContext(
                  input.companyName,
                  city,
                  state,
                  input.address,
                  workspaceId,
                  market,
                  input.country,
                  locale,
              )
            : null;

    const profileBlock = buildProfileBlock(input, market);
    const placesBlock = buildPlacesBlock(placesContext, market);
    const noBusinessTypeDeclared =
        !input.productService?.trim() && !input.targetAudience?.trim() && !input.mainBenefit?.trim();
    const prompt = buildCompanyAnalysisPrompt(profileBlock, webContext, placesBlock, noBusinessTypeDeclared, market, locale);

    const { config } = await resolveAiForRole('company_analysis');
    const result = await generateCompletionForRole('company_analysis', {
        prompt,
        jsonMode: true,
        maxOutputTokens: 4096,
    });

    if (workspaceId && result.usage) {
        recordUsageEvent({
            workspaceId,
            userId,
            type: 'AI_TOKENS',
            quantity: 1,
            metadata: {
                provider: config.provider,
                model: config.model,
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
            },
        });
    }

    let aiReport: CompanyAnalysisReport;
    try {
        const { extractJsonFromLlm } = await import('@/lib/ai/parse-json');
        const parsed = extractJsonFromLlm<Record<string, unknown>>(result.text);
        aiReport = parseCompanyAnalysisResult(parsed);
    } catch {
        aiReport = fallbackReport(locale);
    }

    if (workspaceId) {
        prisma.intelligenceReport
            .create({
                data: {
                    workspaceId,
                    userId,
                    module: 'MY_COMPANY',
                    inputQuery: input.companyName,
                    inputCity: city || null,
                    inputState: state || null,
                    resultsData: JSON.parse(JSON.stringify(aiReport)),
                },
            })
            .catch((err) =>
                logger.error('Failed to persist company analysis report', {
                    error: err instanceof Error ? err.message : 'Unknown',
                })
            );
    }

    return aiReport;
}
