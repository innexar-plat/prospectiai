/**
 * Viability module — application layer.
 * Combines competitor analysis + market report + AI for business viability scoring.
 * Enhanced with Go/No-Go verdict, segment breakdown, top leads with scores.
 */

import { generateCompletionForRole, resolveAiForRole } from '@/lib/ai';
import { extractJsonFromLlm } from '@/lib/ai/parse-json';
import { getWebContextForRole } from '@/lib/web-search/resolve';
import { runCompetitorAnalysis } from '@/modules/competitors';
import { runMarketReport } from '@/modules/market';
import { recordUsageEvent } from '@/lib/usage';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getWorkspaceIdForUser } from '@/lib/workspace';
import { normalizeAnalyzeLocale } from '@/lib/i18n/analysis-error-messages';
import {
    buildViabilityAnalysisPrompt,
    buildViabilityFallbackReport,
    buildViabilityTextQuery,
    reviewsCountLabel,
    viabilityDefaultOffer,
    viabilityDefaultTicket,
    viabilityNotEstimated,
} from '@/lib/ai/prompts/intelligence';
import type { ScoredPlace } from '@/modules/scoring';
import type { ViabilityInput, ViabilityReport, SegmentBreakdown } from '../domain/types';

type PromptContext = {
    businessType: string;
    city: string;
    state: string | undefined;
    totalCompetitors: number;
    top3ByRating: string;
    top3ByReviews: string;
    withWebsite: number;
    withoutWebsite: number;
    withPhone: number;
    withoutPhone: number;
    opportunitiesCount: number;
    segments: string;
    digitalMaturityPercent: number;
    saturationIndex: number;
    avgRating: number | null;
    topScoredCount: number;
    avgScore: number;
};

function buildSegmentBreakdownWithOpportunity(marketData: { segments: Array<{ type: string; count: number; avgRating: number | null }>; digitalMaturity: { total: number; withWebsite: number } }): SegmentBreakdown[] {
    const digitalWeakPct = marketData.digitalMaturity.total > 0
        ? Math.round(((marketData.digitalMaturity.total - marketData.digitalMaturity.withWebsite) / marketData.digitalMaturity.total) * 100)
        : 0;
    return marketData.segments.slice(0, 10).map((s) => {
        let opportunityLevel: 'alta' | 'media' | 'baixa' = 'media';
        if (digitalWeakPct > 50 && (s.avgRating == null || s.avgRating < 4.0)) opportunityLevel = 'alta';
        else if (digitalWeakPct < 20 && s.avgRating != null && s.avgRating >= 4.5) opportunityLevel = 'baixa';
        return { segment: s.type, count: s.count, avgRating: s.avgRating, opportunityLevel };
    });
}

function parseViabilityAiReport(
    rawText: string,
    city: string,
    locale: string,
): {
    score: number;
    verdict: string;
    verdictKey?: 'HIGHLY_VIABLE' | 'VIABLE_WITH_CAVEATS' | 'MODERATE' | 'RISKY' | 'NOT_RECOMMENDED';
    goNoGo: string;
    summary: string;
    strengths: string[];
    risks: string[];
    recommendations: string[];
    estimatedInvestment: string;
    bestLocations: string[];
    dailyLeadsTarget: number;
    suggestedOffer: string;
    suggestedTicket: string;
} {
    const verdictKeys = ['HIGHLY_VIABLE', 'VIABLE_WITH_CAVEATS', 'MODERATE', 'RISKY', 'NOT_RECOMMENDED'] as const;
    try {
        const parsed = extractJsonFromLlm(rawText) as { verdictKey?: string };
        const verdictKey = verdictKeys.includes(parsed.verdictKey as typeof verdictKeys[number])
            ? (parsed.verdictKey as typeof verdictKeys[number])
            : undefined;
        return { ...parsed, verdictKey } as ReturnType<typeof parseViabilityAiReport>;
    } catch {
        return buildViabilityFallbackReport(locale, city) as ReturnType<typeof parseViabilityAiReport>;
    }
}

function buildViabilityContext(
    input: ViabilityInput,
    locale: string,
    competitorData: { totalCount: number; rankingByRating: Array<{ name: string; rating: number }>; rankingByReviews: Array<{ name: string; reviewCount: number }>; digitalPresence: { withWebsite: number; withoutWebsite: number; withPhone: number; withoutPhone: number }; opportunities: unknown[]; topOpportunities: Array<{ score: number }> },
    marketData: { segments: Array<{ type: string; count: number; avgRating: number | null }>; digitalMaturity: { withWebsitePercent: number }; saturationIndex: number; avgRating: number | null },
): PromptContext {
    const reviewsLabel = reviewsCountLabel(locale);
    const avgScore = competitorData.topOpportunities.length > 0
        ? Math.round(competitorData.topOpportunities.reduce((a, b) => a + b.score, 0) / competitorData.topOpportunities.length)
        : 0;
    return {
        businessType: input.businessType,
        city: input.city,
        state: input.state,
        totalCompetitors: competitorData.totalCount,
        top3ByRating: competitorData.rankingByRating.slice(0, 3).map((c) => `${c.name} (${c.rating}★)`).join(', '),
        top3ByReviews: competitorData.rankingByReviews.slice(0, 3).map((c) => `${c.name} (${c.reviewCount} ${reviewsLabel})`).join(', '),
        withWebsite: competitorData.digitalPresence.withWebsite,
        withoutWebsite: competitorData.digitalPresence.withoutWebsite,
        withPhone: competitorData.digitalPresence.withPhone,
        withoutPhone: competitorData.digitalPresence.withoutPhone,
        opportunitiesCount: competitorData.opportunities.length,
        segments: marketData.segments.slice(0, 10).map((s) => `${s.type}: ${s.count} (avg ${s.avgRating ?? 'n/a'}★)`).join('; '),
        digitalMaturityPercent: marketData.digitalMaturity.withWebsitePercent,
        saturationIndex: marketData.saturationIndex,
        avgRating: marketData.avgRating,
        topScoredCount: competitorData.topOpportunities.length,
        avgScore,
    };
}

export async function runViabilityAnalysis(
    input: ViabilityInput,
    userId: string,
    locale = 'pt',
): Promise<ViabilityReport> {
    const resolvedLocale = normalizeAnalyzeLocale(input.locale ?? locale);
    const textQuery = buildViabilityTextQuery(resolvedLocale, input.businessType, input.city, input.state);
    const country = input.country?.trim() || undefined;

    const workspaceId = await getWorkspaceIdForUser(userId);

    const webQueries = resolvedLocale === 'en'
        ? [
            textQuery,
            `news ${input.businessType} ${input.city}`,
            `trends ${input.businessType} ${input.city}`,
            input.businessContext?.primaryCnaeDescription ? `${input.businessContext.primaryCnaeDescription} ${input.city}` : '',
        ].filter(Boolean)
        : resolvedLocale === 'es'
            ? [
                textQuery,
                `noticias ${input.businessType} ${input.city}`,
                `tendencias ${input.businessType} ${input.city}`,
                input.businessContext?.primaryCnaeDescription ? `${input.businessContext.primaryCnaeDescription} ${input.city}` : '',
            ].filter(Boolean)
            : [
                textQuery,
                `notícias ${input.businessType} ${input.city}`,
                `tendências ${input.businessType} ${input.city}`,
                input.businessContext?.primaryCnaeDescription ? `${input.businessContext.primaryCnaeDescription} ${input.city}` : '',
            ].filter(Boolean);
    const webContext = await getWebContextForRole('viability', webQueries, workspaceId ? { workspaceId, userId } : undefined);

    const searchParams = {
        textQuery,
        pageSize: 60,
        city: input.city,
        state: input.state,
        country,
    };

    const [competitorData, marketData] = await Promise.all([
        runCompetitorAnalysis(searchParams, userId, resolvedLocale),
        runMarketReport(searchParams, userId, resolvedLocale),
    ]);

    const segmentBreakdown = buildSegmentBreakdownWithOpportunity(marketData);
    const context = buildViabilityContext(input, resolvedLocale, competitorData, marketData);

    const prompt = buildViabilityAnalysisPrompt(resolvedLocale, input.mode, input, context, webContext || undefined);

    const { config } = await resolveAiForRole('viability');
    const result = await generateCompletionForRole('viability', {
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

    const aiReport = parseViabilityAiReport(result.text, input.city, resolvedLocale);
    const viabilityResult = buildViabilityReportResult(aiReport, competitorData, marketData, segmentBreakdown, resolvedLocale);

    if (workspaceId) {
        await persistViabilityReport(workspaceId, userId, input, viabilityResult);
    }

    return viabilityResult;
}

function buildViabilityReportResult(
    aiReport: { score: number; verdict: string; verdictKey?: ViabilityReport['verdictKey']; goNoGo: string; summary: string; strengths: string[]; risks: string[]; recommendations: string[]; estimatedInvestment: string; bestLocations: string[]; dailyLeadsTarget: number; suggestedOffer: string; suggestedTicket: string },
    competitorData: { totalCount: number; topOpportunities: ScoredPlace[] },
    marketData: { saturationIndex: number; digitalMaturity: { withWebsitePercent: number } },
    segmentBreakdown: SegmentBreakdown[],
    locale: string,
): ViabilityReport {
    const goNoGo = (['GO', 'CAUTION', 'NO_GO'].includes(aiReport.goNoGo) ? aiReport.goNoGo : 'CAUTION') as 'GO' | 'CAUTION' | 'NO_GO';
    return {
        score: Math.min(10, Math.max(0, aiReport.score)),
        verdict: aiReport.verdict,
        verdictKey: aiReport.verdictKey,
        goNoGo,
        summary: aiReport.summary,
        competitorDensity: competitorData.totalCount,
        saturationIndex: marketData.saturationIndex,
        digitalMaturityPercent: marketData.digitalMaturity.withWebsitePercent,
        strengths: aiReport.strengths || [],
        risks: aiReport.risks || [],
        recommendations: aiReport.recommendations || [],
        estimatedInvestment: aiReport.estimatedInvestment || viabilityNotEstimated(locale),
        bestLocations: aiReport.bestLocations || [],
        segmentBreakdown,
        dailyLeadsTarget: aiReport.dailyLeadsTarget || 5,
        suggestedOffer: aiReport.suggestedOffer || viabilityDefaultOffer(locale),
        suggestedTicket: aiReport.suggestedTicket || viabilityDefaultTicket(locale),
        topOpportunities: competitorData.topOpportunities.slice(0, 20),
    };
}

async function persistViabilityReport(workspaceId: string, userId: string, input: ViabilityInput, viabilityResult: ViabilityReport): Promise<void> {
    await prisma.intelligenceReport.create({
        data: {
            workspaceId,
            userId,
            module: 'VIABILITY',
            inputQuery: buildViabilityTextQuery(
                normalizeAnalyzeLocale(input.locale ?? 'pt'),
                input.businessType,
                input.city,
                input.state,
            ),
            inputCity: input.city,
            inputState: input.state,
            resultsData: JSON.parse(JSON.stringify(viabilityResult)),
        },
    }).catch((err) => logger.error('Failed to persist viability report', { error: err instanceof Error ? err.message : 'Unknown' }));
}
