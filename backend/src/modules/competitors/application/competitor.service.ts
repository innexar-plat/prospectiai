/**
 * Competitors module — application layer.
 * Runs search then aggregates ranking, gaps, digital presence,
 * opportunity scoring and AI-generated playbook.
 */

import {
  runSearchAllPages,
  SEARCH_ALL_PAGES_MAX_PLACES,
  SearchHttpError,
} from '@/modules/search';
import { scoreAndRankPlaces, type PlaceLikeForScoring } from '@/modules/scoring';
import { generateCompletionForRole, resolveAiForRole } from '@/lib/ai';
import { getWebContextForRole } from '@/lib/web-search/resolve';
import { recordUsageEvent } from '@/lib/usage';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { SearchInput } from '@/lib/validations/schemas';
import type { CompetitorAnalysisResult, CompetitorPlace, AiPlaybook } from '../domain/types';

function toCompetitorPlace(place: Record<string, unknown>): CompetitorPlace {
  const displayName = place.displayName as { text?: string } | undefined;
  return {
    id: String(place.id ?? ''),
    name: displayName?.text ?? '',
    formattedAddress: place.formattedAddress as string | undefined,
    websiteUri: (place.websiteUri ?? place.website) as string | undefined,
    nationalPhoneNumber: (place.nationalPhoneNumber ?? place.phone) as string | undefined,
    rating: place.rating as number | undefined,
    userRatingCount: (place.userRatingCount ?? place.reviewCount) as number | undefined,
    primaryType: place.primaryType as string | undefined,
  };
}

export { SearchHttpError };

async function generatePlaybook(
  input: SearchInput,
  context: {
    totalCount: number;
    avgRating: number | null;
    medianReviews: number;
    withWebsite: number;
    withoutWebsite: number;
    topByRating: string;
    topByReviews: string;
    opportunitiesCount: number;
  },
  workspaceId?: string,
  userId?: string,
): Promise<AiPlaybook | null> {
  try {
    const webContext = await getWebContextForRole(
      'viability',
      [`${input.textQuery} concorrência mercado`],
      workspaceId && userId ? { workspaceId, userId } : undefined,
    );

    const basePrompt = `Você é um consultor de marketing digital e vendas B2B especializado em análise competitiva local.
Com base nos DADOS REAIS de mercado abaixo, gere um playbook de ataque para quem quer vender serviços digitais (site, SEO, marketing) para esse nicho/região.

DADOS DO MERCADO LOCAL:
- Busca: "${input.textQuery}"
- Total de concorrentes mapeados: ${context.totalCount}
- Rating médio: ${context.avgRating ?? 'N/A'}
- Mediana de reviews (top 10): ${context.medianReviews}
- Com website: ${context.withWebsite} / Sem website: ${context.withoutWebsite}
- Top 3 por rating: ${context.topByRating || 'N/A'}
- Top 3 por reviews: ${context.topByReviews || 'N/A'}
- Oportunidades (presença digital fraca): ${context.opportunitiesCount}

Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem backticks:
{
  "entryBarrier": "<alto | medio | baixo>",
  "entryBarrierExplanation": "<1-2 frases explicando por que a barreira é esse nível>",
  "marketSummary": "<parágrafo de 2-3 frases descrevendo o panorama competitivo>",
  "seoChecklist": ["<ação SEO 1>", "<ação SEO 2>", "<ação SEO 3>", "<ação SEO 4>", "<ação SEO 5>"],
  "reviewStrategy": ["<estratégia 1>", "<estratégia 2>", "<estratégia 3>"],
  "quickWins": ["<ação rápida 24-72h #1>", "<ação rápida #2>", "<ação rápida #3>", "<ação rápida #4>"]
}

REGRAS:
- Baseie-se nos dados fornecidos
- seoChecklist: ações práticas de SEO Local (Google Meu Negócio, NAP, schema, páginas)
- reviewStrategy: como conseguir mais reviews que os concorrentes
- quickWins: ações que dão resultado em 24-72 horas
- entryBarrier alto = top players muito fortes, muitas reviews, mercado saturado
- entryBarrier baixo = poucos concorrentes bons, muitos sem site, fácil se destacar
`;
    const webSuffix = webContext ? '\n\n' + webContext + '\n\n' : '';
    const prompt = basePrompt + webSuffix;

    const { config } = await resolveAiForRole('viability');
    const result = await generateCompletionForRole('viability', {
      prompt,
      jsonMode: true,
      maxTokens: 3000,
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

    const cleaned = result.text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    return JSON.parse(cleaned) as AiPlaybook;
  } catch (err) {
    logger.error('Competitor AI playbook generation failed', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return null;
  }
}

export async function runCompetitorAnalysis(
  input: SearchInput,
  userId: string
): Promise<CompetitorAnalysisResult> {
  const maxPlaces = Math.min(input.pageSize ?? 60, SEARCH_ALL_PAGES_MAX_PLACES);
  const result = await runSearchAllPages(
    { ...input },
    userId,
    maxPlaces
  );

  const rawPlaces = result.places ?? [];
  const places = rawPlaces.map((p) => toCompetitorPlace(p as Record<string, unknown>)).filter((p) => p.id && p.name);

  const withWebsite = places.filter((p) => !!p.websiteUri?.trim()).length;
  const withPhone = places.filter((p) => !!p.nationalPhoneNumber?.trim()).length;

  const byRating = [...places]
    .filter((p) => p.rating != null && p.rating > 0)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 10)
    .map((p, i) => ({
      position: i + 1,
      id: p.id,
      name: p.name,
      rating: p.rating!,
      reviewCount: p.userRatingCount,
    }));

  const byReviews = [...places]
    .filter((p) => (p.userRatingCount ?? 0) > 0)
    .sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0))
    .slice(0, 10)
    .map((p, i) => ({
      position: i + 1,
      id: p.id,
      name: p.name,
      reviewCount: p.userRatingCount ?? 0,
      rating: p.rating,
    }));

  const opportunities = places
    .filter((p) => !p.websiteUri?.trim() || !p.nationalPhoneNumber?.trim())
    .map((p) => ({
      id: p.id,
      name: p.name,
      missingWebsite: !p.websiteUri?.trim(),
      missingPhone: !p.nationalPhoneNumber?.trim(),
    }));

  // Opportunity scoring
  const placesForScoring = places.map((p) => ({
    id: p.id,
    name: p.name,
    formattedAddress: p.formattedAddress,
    websiteUri: p.websiteUri,
    nationalPhoneNumber: p.nationalPhoneNumber,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    primaryType: p.primaryType,
  })) as PlaceLikeForScoring[];

  const { scored: topOpportunities, medianReviews, avgRating } = scoreAndRankPlaces(placesForScoring, 20);

  // Get workspace for AI and persistence
  let workspaceId: string | undefined;
  const user = await prisma.user.findFirst({
    where: { id: userId },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });
  if (user?.workspaces?.length) {
    workspaceId = user.workspaces[0].workspace.id;
  }

  // AI Playbook (runs in parallel with nothing — just generate it)
  const aiPlaybook = await generatePlaybook(
    input,
    {
      totalCount: places.length,
      avgRating,
      medianReviews,
      withWebsite,
      withoutWebsite: places.length - withWebsite,
      topByRating: byRating.slice(0, 3).map((c) => `${c.name} (${c.rating}★)`).join(', '),
      topByReviews: byReviews.slice(0, 3).map((c) => `${c.name} (${c.reviewCount} avaliações)`).join(', '),
      opportunitiesCount: opportunities.length,
    },
    workspaceId,
    userId,
  );

  const analysisResult: CompetitorAnalysisResult = {
    totalCount: places.length,
    rankingByRating: byRating,
    rankingByReviews: byReviews,
    digitalPresence: {
      withWebsite,
      withoutWebsite: places.length - withWebsite,
      withPhone,
      withoutPhone: places.length - withPhone,
    },
    opportunities,
    avgRating,
    medianReviews,
    topOpportunities,
    aiPlaybook,
  };

  // Persist to IntelligenceReport
  if (workspaceId) {
    prisma.intelligenceReport.create({
      data: {
        workspaceId,
        userId,
        module: 'COMPETITORS',
        inputQuery: input.textQuery,
        inputCity: input.city,
        inputState: input.state,
        resultsData: JSON.parse(JSON.stringify(analysisResult)),
      },
    }).catch((err) => logger.error('Failed to persist competitor report', { error: err instanceof Error ? err.message : 'Unknown' }));
  }

  return analysisResult;
}
