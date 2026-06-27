/**
 * Market module — application layer.
 * Runs search then aggregates by segment, digital maturity,
 * opportunity scoring and AI-generated market insights.
 */

import {
  runSearchAllPages,
  SEARCH_ALL_PAGES_MAX_PLACES,
  SearchHttpError,
} from '@/modules/search';
import { scoreAndRankPlaces, type PlaceLikeForScoring } from '@/modules/scoring';
import { generateCompletionForRole, resolveAiForRole } from '@/lib/ai';
import { extractJsonFromLlm } from '@/lib/ai/parse-json';
import { getWebContextForRole } from '@/lib/web-search/resolve';
import { recordUsageEvent } from '@/lib/usage';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getWorkspaceIdForUser } from '@/lib/workspace';
import type { SearchInput } from '@/lib/validations/schemas';
import type { MarketReportResult, MarketSegment, AiMarketInsights } from '../domain/types';
import { buildMarketInsightsPrompt } from '@/lib/ai/prompts/intelligence';
import { normalizeAnalyzeLocale } from '@/lib/i18n/analysis-error-messages';

function getPlaceType(place: Record<string, unknown>): string {
  const primaryType = place.primaryType as string | undefined;
  const types = place.types as string[] | undefined;
  if (primaryType) return primaryType;
  if (types?.length) return types[0];
  return 'establishment';
}

function aggregatePlacesByTypeAndContact(places: Array<Record<string, unknown>>): {
  byType: Map<string, { count: number; sumRating: number; countRating: number }>;
  withWebsite: number;
  withPhone: number;
} {
  const byType = new Map<string, { count: number; sumRating: number; countRating: number }>();
  let withWebsite = 0;
  let withPhone = 0;
  for (const p of places) {
    const type = getPlaceType(p);
    const entry = byType.get(type) ?? { count: 0, sumRating: 0, countRating: 0 };
    entry.count += 1;
    const rating = p.rating as number | undefined;
    if (rating != null && rating > 0) {
      entry.sumRating += rating;
      entry.countRating += 1;
    }
    byType.set(type, entry);
    if ((p.websiteUri ?? p.website)?.toString()?.trim()) withWebsite += 1;
    if ((p.nationalPhoneNumber ?? p.phone)?.toString()?.trim()) withPhone += 1;
  }
  return { byType, withWebsite, withPhone };
}

export { SearchHttpError };

async function generateMarketInsights(
  textQuery: string,
  locale: string,
  context: {
    totalBusinesses: number;
    segments: MarketSegment[];
    withWebsitePercent: number;
    withPhonePercent: number;
    saturationIndex: number;
    avgRating: number | null;
  },
  workspaceId?: string,
  userId?: string,
): Promise<AiMarketInsights | null> {
  try {
    const resolvedLocale = normalizeAnalyzeLocale(locale);
    const webQuerySuffix = resolvedLocale === 'en' ? 'market trends' : resolvedLocale === 'es' ? 'tendencias mercado' : 'mercado tendências';
    const webContext = await getWebContextForRole(
      'viability',
      [`${textQuery} ${webQuerySuffix}`],
      workspaceId && userId ? { workspaceId, userId } : undefined,
    );

    const prompt = buildMarketInsightsPrompt(resolvedLocale, textQuery, context, webContext || undefined);

    const { config } = await resolveAiForRole('viability');
    const result = await generateCompletionForRole('viability', {
      prompt,
      jsonMode: true,
      maxOutputTokens: 2500,
    });

    if (result.usage && workspaceId && userId) {
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

    return extractJsonFromLlm<AiMarketInsights>(result.text);
  } catch (err) {
    logger.error('Market AI insights generation failed', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return null;
  }
}

export async function runMarketReport(
  input: { textQuery: string; includedType?: string; pageSize?: number; city?: string; state?: string; country?: string },
  userId: string,
  locale = 'pt',
): Promise<MarketReportResult> {
  const resolvedLocale = normalizeAnalyzeLocale(locale);
  const maxPlaces = Math.min(input.pageSize ?? 60, SEARCH_ALL_PAGES_MAX_PLACES);
  const country = input.country?.trim() || undefined;
  const searchInput: SearchInput = {
    textQuery: input.textQuery,
    includedType: input.includedType,
    city: input.city,
    state: input.state,
    country,
  };

  const result = await runSearchAllPages(searchInput, userId, maxPlaces);
  const rawPlaces = result.places ?? [];
  const places = rawPlaces as unknown as Array<Record<string, unknown>>;
  const total = places.length;

  const { byType, withWebsite, withPhone } = aggregatePlacesByTypeAndContact(places);

  const segments: MarketSegment[] = Array.from(byType.entries())
    .map(([type, data]) => ({
      type,
      count: data.count,
      avgRating: data.countRating > 0 ? Math.round((data.sumRating / data.countRating) * 10) / 10 : null,
    }))
    .sort((a, b) => b.count - a.count);

  const segmentCount = segments.length;
  const saturationIndex = segmentCount > 0 ? Math.round(total / segmentCount) : 0;
  const withWebsitePercent = total > 0 ? Math.round((withWebsite / total) * 100) : 0;
  const withPhonePercent = total > 0 ? Math.round((withPhone / total) * 100) : 0;

  // Opportunity scoring
  const placesForScoring = places.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    formattedAddress: p.formattedAddress,
    websiteUri: p.websiteUri ?? p.website,
    nationalPhoneNumber: p.nationalPhoneNumber ?? p.phone,
    rating: p.rating,
    userRatingCount: p.userRatingCount ?? p.reviewCount,
    primaryType: p.primaryType,
    types: p.types,
    businessStatus: p.businessStatus,
  })) as PlaceLikeForScoring[];

  const { scored: topOpportunities, avgRating } = scoreAndRankPlaces(placesForScoring, 15);

  const workspaceId = await getWorkspaceIdForUser(userId);

  // AI insights
  const aiInsights = await generateMarketInsights(
    input.textQuery,
    resolvedLocale,
    { totalBusinesses: total, segments, withWebsitePercent, withPhonePercent, saturationIndex, avgRating },
    workspaceId,
    userId,
  );

  const reportResult: MarketReportResult = {
    totalBusinesses: total,
    segments,
    digitalMaturity: {
      withWebsite,
      withPhone,
      total,
      withWebsitePercent,
      withPhonePercent,
    },
    saturationIndex,
    avgRating,
    topOpportunities,
    aiInsights,
  };

  // Persist to IntelligenceReport
  if (workspaceId) {
    await prisma.intelligenceReport.create({
      data: {
        workspaceId,
        userId,
        module: 'MARKET',
        inputQuery: input.textQuery,
        inputCity: input.city,
        inputState: input.state,
        resultsData: JSON.parse(JSON.stringify(reportResult)),
      },
    }).catch((err) => logger.error('Failed to persist market report', { error: err instanceof Error ? err.message : 'Unknown' }));
  }

  return reportResult;
}
