/**
 * Viability module — application layer.
 * Combines competitor analysis + market report + AI for business viability scoring.
 * Enhanced with Go/No-Go verdict, segment breakdown, top leads with scores.
 */

import { generateCompletionForRole, resolveAiForRole } from '@/lib/ai';
import { getWebContextForRole } from '@/lib/web-search/resolve';
import { runCompetitorAnalysis } from '@/modules/competitors';
import { runMarketReport } from '@/modules/market';
import { recordUsageEvent } from '@/lib/usage';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { ViabilityInput, ViabilityReport, SegmentBreakdown, ViabilityMode } from '../domain/types';

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

function buildViabilityPrompt(
    mode: ViabilityMode,
    input: ViabilityInput,
    context: PromptContext,
    webContext: string | undefined
): string {
    const statePart = input.state ? `, ${input.state}` : '';
    const cityState = `${input.city}${statePart}`;

    const modeInstructions: Record<ViabilityMode, string> = {
        new_business: `Análise de viabilidade para **abrir um novo negócio** do tipo "${input.businessType}" em ${cityState}.
Inclua: oportunidade de mercado, saturação, melhor modelo de negócio, investimento inicial sugerido, locais recomendados.
Para suggestedOffer/suggestedTicket: sugira modelo de negócio e faixa de investimento adequados para quem vai abrir esse negócio na região.`,
        expand: `Análise de viabilidade para **expandir o negócio / abrir filial** do tipo "${input.businessType}" em ${cityState}.
Inclua: atratividade da região para expansão, concorrência, riscos e recomendações para abertura de filial.
Para suggestedOffer/suggestedTicket: adapte ao contexto de expansão/filial (custos, ticket sugerido na nova cidade).`,
        my_business: `Análise de viabilidade **do negócio do usuário** (${input.businessType}) na cidade ${cityState}.
Use os dados de mercado para avaliar se a cidade é viável para esse negócio específico.
Para suggestedOffer/suggestedTicket: recomendações para o negócio do usuário atuar nessa cidade.`,
    };

    const intro = modeInstructions[mode];

    const basePrompt = `Você é um consultor de negócios especializado em análise de viabilidade local no Brasil.
${intro}

DADOS DO MERCADO LOCAL:
- Total de concorrentes mapeados: ${context.totalCompetitors}
- Rating médio: ${context.avgRating ?? 'N/A'}
- Top 3 por avaliação: ${context.top3ByRating || 'N/A'}
- Top 3 por volume de reviews: ${context.top3ByReviews || 'N/A'}
- Com website: ${context.withWebsite} / Sem website: ${context.withoutWebsite}
- Com telefone: ${context.withPhone} / Sem telefone: ${context.withoutPhone}
- Oportunidades (sem presença digital): ${context.opportunitiesCount}
- Top leads com score de oportunidade: ${context.topScoredCount} (score médio: ${context.avgScore}/100)
- Segmentos encontrados: ${context.segments || 'N/A'}
- Maturidade digital da região: ${context.digitalMaturityPercent}%
- Índice de saturação: ${context.saturationIndex}

Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem backticks:
{
  "score": <número 0-10, onde 10 = altamente viável>,
  "verdict": "<uma frase curta: Altamente Viável / Viável com Ressalvas / Moderado / Arriscado / Não Recomendado>",
  "goNoGo": "<GO | CAUTION | NO_GO>",
  "summary": "<parágrafo de 3-4 frases explicando a viabilidade geral com dados concretos>",
  "strengths": ["<ponto forte 1>", "<ponto forte 2>", "<ponto forte 3>"],
  "risks": ["<risco 1>", "<risco 2>", "<risco 3>"],
  "recommendations": ["<recomendação 1>", "<recomendação 2>", "<recomendação 3>", "<recomendação 4>"],
  "estimatedInvestment": "<faixa estimada de investimento inicial para esse tipo de negócio nessa região>",
  "bestLocations": ["<sugestão de bairro/região 1>", "<sugestão 2>"],
  "dailyLeadsTarget": <número inteiro: quantos leads por dia prospectar nesse nicho>,
  "suggestedOffer": "<oferta sugerida conforme o contexto do modo de análise>",
  "suggestedTicket": "<ticket mensal sugerido conforme o contexto>"
}

REGRAS CRÍTICAS:
- Baseie-se APENAS nos dados fornecidos acima
- score deve refletir a realidade: se há muitos concorrentes com alta avaliação, o score deve ser menor
- goNoGo: GO se score >= 7, CAUTION se 4-6, NO_GO se < 4
- dailyLeadsTarget: base no total de oportunidades e um ritmo realista
- suggestedTicket: baseado no nicho e na região
- Seja realista e honesto, não superestime a viabilidade
`;
    const webSuffix = webContext ? '\n\n' + webContext + '\n\n' : '';
    return basePrompt + webSuffix;
}

async function getViabilityWorkspaceId(userId: string): Promise<string | undefined> {
    const user = await prisma.user.findFirst({
        where: { id: userId },
        include: { workspaces: { include: { workspace: true }, take: 1 } },
    });
    return user?.workspaces?.length ? user.workspaces[0].workspace.id : undefined;
}

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
): {
    score: number;
    verdict: string;
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
    try {
        const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
        return JSON.parse(cleaned);
    } catch {
        return {
            score: 5,
            verdict: 'Análise parcial',
            goNoGo: 'CAUTION',
            summary: 'Não foi possível gerar análise completa. Tente novamente.',
            strengths: ['Dados de mercado coletados com sucesso'],
            risks: ['Análise de IA incompleta'],
            recommendations: ['Tente novamente com termos mais específicos'],
            estimatedInvestment: 'Não estimado',
            bestLocations: [city],
            dailyLeadsTarget: 5,
            suggestedOffer: 'Pacote Website + SEO Local',
            suggestedTicket: 'Consultar valores',
        };
    }
}

function buildViabilityContext(
    input: ViabilityInput,
    competitorData: { totalCount: number; rankingByRating: Array<{ name: string; rating: number }>; rankingByReviews: Array<{ name: string; reviewCount: number }>; digitalPresence: { withWebsite: number; withoutWebsite: number; withPhone: number; withoutPhone: number }; opportunities: unknown[]; topOpportunities: Array<{ score: number }> },
    marketData: { segments: Array<{ type: string; count: number; avgRating: number | null }>; digitalMaturity: { withWebsitePercent: number }; saturationIndex: number; avgRating: number | null },
): PromptContext {
    const avgScore = competitorData.topOpportunities.length > 0
        ? Math.round(competitorData.topOpportunities.reduce((a, b) => a + b.score, 0) / competitorData.topOpportunities.length)
        : 0;
    return {
        businessType: input.businessType,
        city: input.city,
        state: input.state,
        totalCompetitors: competitorData.totalCount,
        top3ByRating: competitorData.rankingByRating.slice(0, 3).map((c) => `${c.name} (${c.rating}★)`).join(', '),
        top3ByReviews: competitorData.rankingByReviews.slice(0, 3).map((c) => `${c.name} (${c.reviewCount} avaliações)`).join(', '),
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
    userId: string
): Promise<ViabilityReport> {
    const statePart = input.state ? ', ' + input.state : '';
    const textQuery = input.businessType + ' em ' + input.city + statePart;

    const workspaceId = await getViabilityWorkspaceId(userId);

    const webQueries = [
        textQuery,
        `notícias ${input.businessType} ${input.city}`,
        `tendências ${input.businessType} ${input.city}`,
    ].filter(Boolean);
    const webContext = await getWebContextForRole('viability', webQueries, workspaceId ? { workspaceId, userId } : undefined);

    const [competitorData, marketData] = await Promise.all([
        runCompetitorAnalysis({ textQuery, pageSize: 60 }, userId),
        runMarketReport({ textQuery, pageSize: 60 }, userId),
    ]);

    const segmentBreakdown = buildSegmentBreakdownWithOpportunity(marketData);
    const context = buildViabilityContext(input, competitorData, marketData);

    const prompt = buildViabilityPrompt(input.mode, input, context, webContext);

    const { config } = await resolveAiForRole('viability');
    const result = await generateCompletionForRole('viability', {
        prompt,
        jsonMode: true,
        maxTokens: 4096,
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

    const aiReport = parseViabilityAiReport(result.text, input.city);

    // Normalize goNoGo
    const goNoGo = (['GO', 'CAUTION', 'NO_GO'].includes(aiReport.goNoGo) ? aiReport.goNoGo : 'CAUTION') as 'GO' | 'CAUTION' | 'NO_GO';

    const viabilityResult: ViabilityReport = {
        score: Math.min(10, Math.max(0, aiReport.score)),
        verdict: aiReport.verdict,
        goNoGo,
        summary: aiReport.summary,
        competitorDensity: competitorData.totalCount,
        saturationIndex: marketData.saturationIndex,
        digitalMaturityPercent: marketData.digitalMaturity.withWebsitePercent,
        strengths: aiReport.strengths || [],
        risks: aiReport.risks || [],
        recommendations: aiReport.recommendations || [],
        estimatedInvestment: aiReport.estimatedInvestment || 'Não estimado',
        bestLocations: aiReport.bestLocations || [],
        segmentBreakdown,
        dailyLeadsTarget: aiReport.dailyLeadsTarget || 5,
        suggestedOffer: aiReport.suggestedOffer || 'Pacote Website + SEO Local',
        suggestedTicket: aiReport.suggestedTicket || 'Consultar valores',
        topOpportunities: competitorData.topOpportunities.slice(0, 20),
    };

    // Persist to IntelligenceReport
    if (workspaceId) {
        prisma.intelligenceReport.create({
            data: {
                workspaceId,
                userId,
                module: 'VIABILITY',
                inputQuery: `${input.businessType} em ${input.city}`,
                inputCity: input.city,
                inputState: input.state,
                resultsData: JSON.parse(JSON.stringify(viabilityResult)),
            },
        }).catch((err) => logger.error('Failed to persist viability report', { error: err instanceof Error ? err.message : 'Unknown' }));
    }

    return viabilityResult;
}
