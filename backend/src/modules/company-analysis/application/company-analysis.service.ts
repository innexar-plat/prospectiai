/**
 * Company analysis module — application layer.
 * Uses workspace profile, Serper (Reclame Aqui, reviews, social), optional Google Places (reviews), and IA.
 */

import { generateCompletionForRole, resolveAiForRole } from '@/lib/ai';
import { getWebContextForRole } from '@/lib/web-search/resolve';
import { geocodeAddress } from '@/lib/geocode';
import { textSearch, getPlaceDetails } from '@/lib/google-places';
import { recordUsageEvent } from '@/lib/usage';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { CompanyAnalysisInput, CompanyAnalysisReport } from '../domain/types';

const MAX_REVIEW_SNIPPETS = 5;
const PLACES_RADIUS_M = 10000;

function buildSerperQueries(input: CompanyAnalysisInput): string[] {
    const name = input.companyName.trim();
    const queries: string[] = [
        `${name} Reclame Aqui`,
        `${name} avaliações Google`,
        `${name} reclamações`,
    ];
    // Social: by company name (and optionally by URL when link is present)
    if (name) {
        queries.push(`${name} Instagram`);
        queries.push(`${name} Facebook`);
        queries.push(`${name} LinkedIn`);
    }
    const withUrls: string[] = [];
    if (input.instagramUrl?.trim()) withUrls.push(input.instagramUrl.trim());
    if (input.facebookUrl?.trim()) withUrls.push(input.facebookUrl.trim());
    if (input.linkedInUrl?.trim()) withUrls.push(input.linkedInUrl.trim());
    // Replace last N social queries with URL-based ones if we have links (so we stay within 6)
    for (let i = 0; i < Math.min(withUrls.length, 3); i++) {
        const idx = queries.length - 3 + i;
        if (idx >= 3) queries[idx] = withUrls[i];
    }
    return queries.slice(0, 6);
}

function buildProfileBlock(input: CompanyAnalysisInput): string {
    const lines: string[] = [
        `- Nome: ${input.companyName}`,
        input.productService ? `- Produto/serviço: ${input.productService}` : '',
        input.targetAudience ? `- Público-alvo: ${input.targetAudience}` : '',
        input.mainBenefit ? `- Benefício principal: ${input.mainBenefit}` : '',
        input.address ? `- Endereço: ${input.address}` : '',
        input.websiteUrl ? `- Site: ${input.websiteUrl}` : '',
        'Links oficiais das redes (perfil da empresa):',
        input.linkedInUrl ? `  - LinkedIn: ${input.linkedInUrl}` : '  - LinkedIn: não informado',
        input.instagramUrl ? `  - Instagram: ${input.instagramUrl}` : '  - Instagram: não informado',
        input.facebookUrl ? `  - Facebook: ${input.facebookUrl}` : '  - Facebook: não informado',
    ].filter(Boolean);
    return lines.join('\n');
}

async function fetchGooglePlacesContext(
    companyName: string,
    city: string | undefined,
    state: string | undefined,
    address: string | undefined,
    workspaceId: string
): Promise<{ rating?: number; userRatingCount?: number; reviewsSnippets: string[] } | null> {
    const cityOrAddress = city?.trim() || address?.trim();
    if (!cityOrAddress) return null;
    try {
        const coords = await geocodeAddress(
            city?.trim() || address?.trim() || '',
            state ?? null,
            'Brasil'
        );
        if (!coords) return null;
        const textQuery = `${companyName} ${city?.trim() || ''}`.trim();
        const { places } = await textSearch({
            textQuery,
            pageSize: 5,
            languageCode: 'pt-BR',
            regionCode: 'BR',
            locationBias: {
                center: { latitude: coords.latitude, longitude: coords.longitude },
                radius: PLACES_RADIUS_M,
            },
        });
        recordUsageEvent({ workspaceId, type: 'GOOGLE_PLACES_SEARCH', quantity: 1 });
        const first = places[0];
        if (!first?.id) return null;
        const details = await getPlaceDetails(first.id);
        recordUsageEvent({ workspaceId, type: 'GOOGLE_PLACES_DETAILS', quantity: 1 });
        const reviews = details.reviews ?? [];
        const reviewsSnippets = reviews
            .slice(0, MAX_REVIEW_SNIPPETS)
            .map((r) => (r.text?.text ?? '').slice(0, 300))
            .filter(Boolean);
        return {
            rating: details.rating,
            userRatingCount: details.userRatingCount,
            reviewsSnippets,
        };
    } catch (err) {
        logger.warn('Google Places context failed', { error: err instanceof Error ? err.message : 'Unknown' });
        return null;
    }
}

function buildPlacesBlock(placesContext: { rating?: number; userRatingCount?: number; reviewsSnippets: string[] } | null): string {
    if (!placesContext) return '';
    const parts: string[] = [
        '## Avaliações Google (dados reais do Google Places)',
        placesContext.rating != null ? `- Nota: ${placesContext.rating}` : '',
        placesContext.userRatingCount != null ? `- Número de avaliações: ${placesContext.userRatingCount}` : '',
    ].filter(Boolean);
    if (placesContext.reviewsSnippets.length > 0) {
        parts.push('Trechos de avaliações:');
        placesContext.reviewsSnippets.forEach((s, i) => parts.push(`${i + 1}. ${s}`));
    }
    return parts.join('\n');
}

async function getWorkspaceIdForUser(userId: string): Promise<string | undefined> {
    const user = await prisma.user.findFirst({
        where: { id: userId },
        include: { workspaces: { include: { workspace: true }, take: 1 } },
    });
    return user?.workspaces?.length ? user.workspaces[0].workspace.id : undefined;
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

function buildCompanyAnalysisPrompt(
    profileBlock: string,
    webContext: string,
    placesBlock: string,
    noBusinessTypeDeclared: boolean,
): string {
    const inferInstruction = noBusinessTypeDeclared
        ? '\nO tipo de negócio não foi declarado; infira a partir das fontes (web e avaliações Google).\n'
        : '';
    return `Você é um consultor de negócios especializado em diagnóstico de empresas no Brasil.
Analise a empresa com base APENAS nos dados fornecidos abaixo. Cite as fontes quando fizer afirmações.
${inferInstruction}
## Perfil da empresa (dados declarados)
${profileBlock}

${webContext}

${placesBlock ? `\n${placesBlock}\n` : ''}

Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem backticks:
{
  "summary": "<resumo executivo em 2-4 frases>",
  "strengths": ["<ponto forte 1>", "<ponto forte 2>", "<ponto forte 3>"],
  "weaknesses": ["<ponto fraco 1>", "<ponto fraco 2>"],
  "opportunities": ["<oportunidade 1>", "<oportunidade 2>", "<oportunidade 3>"],
  "reclameAquiSummary": "<resumo do que foi encontrado no Reclame Aqui ou 'Não encontrado'>",
  "googlePresenceScore": <número 0-10, presença/avaliações Google>,
  "googleRating": <número ou null se não houver>,
  "googleReviewCount": <número ou null>,
  "googleReviewsSnippets": ["<trecho 1>"] ou [],
  "socialNetworks": {
    "presence": "<resumo da presença em redes: links declarados + o que foi encontrado na web>",
    "perNetwork": [
      { "network": "Instagram", "link": "<se declarado>", "found": "<o que a busca encontrou>", "suggestions": "<sugestão>" },
      { "network": "Facebook", "link": "<se declarado>", "found": "<o que a busca encontrou>", "suggestions": "<sugestão>" },
      { "network": "LinkedIn", "link": "<se declarado>", "found": "<o que a busca encontrou>", "suggestions": "<sugestão>" }
    ],
    "consistency": "<breve análise de consistência entre redes>",
    "recommendations": ["<recomendação 1 para redes>", "<recomendação 2>"]
  },
  "suggestedNiche": "<nicho sugerido com base nos dados>",
  "suggestedBusinessModel": "<modelo de negócio sugerido>",
  "recommendations": ["<recomendação geral 1>", "<recomendação 2>", "<recomendação 3>"]
}

REGRAS: Baseie-se APENAS nos dados fornecidos. Se não houver dados para um campo, use null ou string vazia ou "Não encontrado" conforme o caso.`;
}

export async function runCompanyAnalysis(input: CompanyAnalysisInput, userId: string): Promise<CompanyAnalysisReport> {
    const workspaceId = await getWorkspaceIdForUser(userId);

    const queries = buildSerperQueries(input);
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
                  workspaceId
              )
            : null;

    const profileBlock = buildProfileBlock(input);
    const placesBlock = buildPlacesBlock(placesContext);
    const noBusinessTypeDeclared =
        !input.productService?.trim() && !input.targetAudience?.trim() && !input.mainBenefit?.trim();
    const prompt = buildCompanyAnalysisPrompt(profileBlock, webContext, placesBlock, noBusinessTypeDeclared);

    const { config } = await resolveAiForRole('company_analysis');
    const result = await generateCompletionForRole('company_analysis', {
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

    let aiReport: CompanyAnalysisReport;
    try {
        const cleaned = result.text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
        const parsed = JSON.parse(cleaned) as Record<string, unknown>;
        aiReport = parseCompanyAnalysisResult(parsed);
    } catch {
        aiReport = {
            summary: 'Não foi possível gerar a análise completa. Tente novamente.',
            strengths: [],
            weaknesses: [],
            opportunities: [],
            socialNetworks: { presence: '' },
            recommendations: ['Preencha o perfil da empresa e execute novamente.'],
        };
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
