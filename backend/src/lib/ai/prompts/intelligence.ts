/**
 * Bilingual AI prompts for intelligence modules (competitors, market, viability).
 */

import type { ViabilityMode } from '@/modules/viability/domain/types';
import { getAiLanguageRule, notInformedLabel, reviewsCountLabel } from '@/lib/ai/prompts/locale';
import { normalizeAnalyzeLocale } from '@/lib/i18n/analysis-error-messages';

type CompetitorPlaybookContext = {
    totalCount: number;
    avgRating: number | null;
    medianReviews: number;
    withWebsite: number;
    withoutWebsite: number;
    topByRating: string;
    topByReviews: string;
    opportunitiesCount: number;
};

type MarketInsightsContext = {
    totalBusinesses: number;
    segments: Array<{ type: string; count: number; avgRating: number | null }>;
    withWebsitePercent: number;
    withPhonePercent: number;
    saturationIndex: number;
    avgRating: number | null;
};

type ViabilityPromptContext = {
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

type ViabilityBusinessContext = {
    companyName?: string;
    legalName?: string;
    tradeName?: string;
    cnpj?: string;
    primaryCnaeCode?: string;
    primaryCnaeDescription?: string;
    companySize?: string;
    foundingDate?: string;
    targetAudience?: string;
    mainBenefit?: string;
    serviceModel?: string;
    averageTicket?: number;
    operationRadiusKm?: number;
    knownCompetitors?: string;
};

function lang(locale: string): 'en' | 'es' | 'pt' {
    return normalizeAnalyzeLocale(locale);
}

export function buildCompetitorPlaybookPrompt(
    locale: string,
    textQuery: string,
    context: CompetitorPlaybookContext,
    webContext?: string,
): string {
    const l = lang(locale);
    const languageRule = getAiLanguageRule(locale);

    const intro = l === 'en'
        ? `You are a digital marketing and B2B sales consultant specialized in local competitive analysis.
Based on the REAL market data below, generate an attack playbook for someone who wants to sell digital services (website, SEO, marketing) to this niche/region.`
        : l === 'es'
            ? `Eres un consultor de marketing digital y ventas B2B especializado en análisis competitivo local.
Con base en los DATOS REALES del mercado a continuación, genera un playbook de ataque para quien quiere vender servicios digitales (sitio web, SEO, marketing) a este nicho/región.`
            : `Você é um consultor de marketing digital e vendas B2B especializado em análise competitiva local.
Com base nos DADOS REAIS de mercado abaixo, gere um playbook de ataque para quem quer vender serviços digitais (site, SEO, marketing) para esse nicho/região.`;

    const dataHeader = l === 'en' ? 'LOCAL MARKET DATA:' : l === 'es' ? 'DATOS DEL MERCADO LOCAL:' : 'DADOS DO MERCADO LOCAL:';
    const searchLabel = l === 'en' ? 'Search' : l === 'es' ? 'Búsqueda' : 'Busca';
    const totalLabel = l === 'en' ? 'Total competitors mapped' : l === 'es' ? 'Total de competidores mapeados' : 'Total de concorrentes mapeados';
    const avgRatingLabel = l === 'en' ? 'Average rating' : l === 'es' ? 'Rating promedio' : 'Rating médio';
    const medianLabel = l === 'en' ? 'Median reviews (top 10)' : l === 'es' ? 'Mediana de reseñas (top 10)' : 'Mediana de reviews (top 10)';
    const withWebsiteLabel = l === 'en' ? 'With website' : l === 'es' ? 'Con sitio web' : 'Com website';
    const withoutWebsiteLabel = l === 'en' ? 'Without website' : l === 'es' ? 'Sin sitio web' : 'Sem website';
    const topRatingLabel = l === 'en' ? 'Top 3 by rating' : l === 'es' ? 'Top 3 por rating' : 'Top 3 por rating';
    const topReviewsLabel = l === 'en' ? 'Top 3 by reviews' : l === 'es' ? 'Top 3 por reseñas' : 'Top 3 por reviews';
    const opportunitiesLabel = l === 'en' ? 'Opportunities (weak digital presence)' : l === 'es' ? 'Oportunidades (presencia digital débil)' : 'Oportunidades (presença digital fraca)';

    const jsonIntro = l === 'en'
        ? 'Respond EXCLUSIVELY with valid JSON, no markdown, no backticks:'
        : l === 'es'
            ? 'Responda EXCLUSIVAMENTE en JSON válido, sin markdown, sin backticks:'
            : 'Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem backticks:';

    const entryBarrierValues = l === 'en' ? 'high | medium | low' : l === 'es' ? 'alto | medio | bajo' : 'alto | medio | baixo';

    const rules = l === 'en'
        ? `RULES:
- Base your answer on the provided data
- seoChecklist: practical Local SEO actions (Google Business Profile, NAP, schema, pages)
- reviewStrategy: how to get more reviews than competitors
- quickWins: actions that deliver results in 24-72 hours
- entryBarrier high = very strong top players, many reviews, saturated market
- entryBarrier low = few good competitors, many without a website, easy to stand out`
        : l === 'es'
            ? `REGLAS:
- Base su respuesta en los datos proporcionados
- seoChecklist: acciones prácticas de SEO Local (Google Business Profile, NAP, schema, páginas)
- reviewStrategy: cómo conseguir más reseñas que los competidores
- quickWins: acciones con resultados en 24-72 horas
- entryBarrier alto = top players muy fuertes, muchas reseñas, mercado saturado
- entryBarrier bajo = pocos competidores buenos, muchos sin sitio web, fácil destacarse`
            : `REGRAS:
- Baseie-se nos dados fornecidos
- seoChecklist: ações práticas de SEO Local (Google Meu Negócio, NAP, schema, páginas)
- reviewStrategy: como conseguir mais reviews que os concorrentes
- quickWins: ações que dão resultado em 24-72 horas
- entryBarrier alto = top players muito fortes, muitas reviews, mercado saturado
- entryBarrier baixo = poucos concorrentes bons, muitos sem site, fácil se destacar`;

    const basePrompt = `${intro}

${dataHeader}
- ${searchLabel}: "${textQuery}"
- ${totalLabel}: ${context.totalCount}
- ${avgRatingLabel}: ${context.avgRating ?? 'N/A'}
- ${medianLabel}: ${context.medianReviews}
- ${withWebsiteLabel}: ${context.withWebsite} / ${withoutWebsiteLabel}: ${context.withoutWebsite}
- ${topRatingLabel}: ${context.topByRating || 'N/A'}
- ${topReviewsLabel}: ${context.topByReviews || 'N/A'}
- ${opportunitiesLabel}: ${context.opportunitiesCount}

${languageRule}

${jsonIntro}
{
  "entryBarrier": "<${entryBarrierValues}>",
  "entryBarrierExplanation": "<1-2 sentences explaining why the barrier is at this level>",
  "marketSummary": "<2-3 sentence paragraph describing the competitive landscape>",
  "seoChecklist": ["<SEO action 1>", "<SEO action 2>", "<SEO action 3>", "<SEO action 4>", "<SEO action 5>"],
  "reviewStrategy": ["<strategy 1>", "<strategy 2>", "<strategy 3>"],
  "quickWins": ["<quick win 24-72h #1>", "<quick win #2>", "<quick win #3>", "<quick win #4>"]
}

${rules}
`;
    return webContext ? `${basePrompt}\n\n${webContext}\n\n` : basePrompt;
}

export function buildMarketInsightsPrompt(
    locale: string,
    textQuery: string,
    context: MarketInsightsContext,
    webContext?: string,
): string {
    const l = lang(locale);
    const languageRule = getAiLanguageRule(locale);

    const segmentsText = context.segments
        .slice(0, 10)
        .map((s) => `${s.type}: ${s.count} (avg ${s.avgRating ?? 'n/a'}★)`)
        .join('; ');

    const intro = l === 'en'
        ? 'You are a market intelligence analyst specialized in local markets.'
        : l === 'es'
            ? 'Eres un analista de inteligencia de mercado especializado en mercados locales.'
            : 'Você é um analista de inteligência de mercado especializado em mercados locais brasileiros.';

    const task = l === 'en'
        ? 'Based on the REAL data collected via Google Maps below, generate executive market insights.'
        : l === 'es'
            ? 'Con base en los DATOS REALES recopilados vía Google Maps a continuación, genera insights ejecutivos del mercado.'
            : 'Com base nos DADOS REAIS coletados via Google Maps abaixo, gere insights executivos do mercado.';

    const dataHeader = l === 'en' ? 'MARKET DATA:' : l === 'es' ? 'DATOS DEL MERCADO:' : 'DADOS DO MERCADO:';
    const searchLabel = l === 'en' ? 'Search' : l === 'es' ? 'Búsqueda' : 'Busca';
    const totalLabel = l === 'en' ? 'Total businesses mapped' : l === 'es' ? 'Total de negocios mapeados' : 'Total de negócios mapeados';
    const avgRatingLabel = l === 'en' ? 'Average rating' : l === 'es' ? 'Rating promedio' : 'Rating médio';
    const segmentsLabel = l === 'en' ? 'Segments' : l === 'es' ? 'Segmentos' : 'Segmentos';
    const websitePctLabel = l === 'en' ? '% with website' : l === 'es' ? '% con sitio web' : '% com website';
    const phonePctLabel = l === 'en' ? '% with phone' : l === 'es' ? '% con teléfono' : '% com telefone';
    const saturationLabel = l === 'en' ? 'Saturation index' : l === 'es' ? 'Índice de saturación' : 'Índice de saturação';

    const jsonIntro = l === 'en'
        ? 'Respond EXCLUSIVELY with valid JSON, no markdown, no backticks:'
        : l === 'es'
            ? 'Responda EXCLUSIVAMENTE en JSON válido, sin markdown, sin backticks:'
            : 'Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem backticks:';

    const rules = l === 'en'
        ? `RULES:
- Base your answer on the provided data; do not invent numbers
- executiveSummary: executive tone with concrete data
- marketTrends: observable trends from the data
- opportunities: real opportunities for someone selling digital services
- recommendations: practical strategic actions`
        : l === 'es'
            ? `REGLAS:
- Base su respuesta en los datos proporcionados; no invente números
- executiveSummary: tono ejecutivo con datos concretos
- marketTrends: tendencias observables a partir de los datos
- opportunities: oportunidades reales para quien vende servicios digitales
- recommendations: acciones estratégicas prácticas`
            : `REGRAS:
- Baseie-se nos dados fornecidos, não invente números
- executiveSummary: tom executivo, com dados concretos
- marketTrends: tendências observáveis a partir dos dados
- opportunities: oportunidades reais para quem vende serviços digitais
- recommendations: ações estratégicas práticas`;

    const basePrompt = `${intro}
${task}

${dataHeader}
- ${searchLabel}: "${textQuery}"
- ${totalLabel}: ${context.totalBusinesses}
- ${avgRatingLabel}: ${context.avgRating ?? 'N/A'}
- ${segmentsLabel}: ${segmentsText || 'N/A'}
- ${websitePctLabel}: ${context.withWebsitePercent}%
- ${phonePctLabel}: ${context.withPhonePercent}%
- ${saturationLabel}: ${context.saturationIndex}

${languageRule}

${jsonIntro}
{
  "executiveSummary": "<3-4 sentence paragraph with executive market overview, mention numbers>",
  "marketTrends": ["<trend 1>", "<trend 2>", "<trend 3>"],
  "opportunities": ["<business opportunity 1>", "<opportunity 2>", "<opportunity 3>"],
  "recommendations": ["<strategic recommendation 1>", "<recommendation 2>", "<recommendation 3>", "<recommendation 4>"]
}

${rules}
`;
    return webContext ? `${basePrompt}\n\n${webContext}\n\n` : basePrompt;
}

function buildViabilityModeIntro(
    locale: string,
    mode: ViabilityMode,
    businessType: string,
    cityState: string,
): string {
    const l = lang(locale);
    if (l === 'en') {
        const modes: Record<ViabilityMode, string> = {
            new_business: `Viability analysis for **opening a new business** of type "${businessType}" in ${cityState}.
Include: market opportunity, saturation, best business model, suggested initial investment, recommended locations.
For suggestedOffer/suggestedTicket: suggest a business model and investment range suitable for opening this business in the region.`,
            expand: `Viability analysis for **expanding the business / opening a branch** of type "${businessType}" in ${cityState}.
Include: regional attractiveness for expansion, competition, risks and recommendations for opening a branch.
For suggestedOffer/suggestedTicket: adapt to expansion/branch context (costs, suggested ticket in the new city).`,
            my_business: `Viability analysis **for the user's business** (${businessType}) in ${cityState}.
Use market data to assess whether the city is viable for this specific business.
For suggestedOffer/suggestedTicket: recommendations for the user's business to operate in this city.`,
        };
        return modes[mode];
    }
    if (l === 'es') {
        const modes: Record<ViabilityMode, string> = {
            new_business: `Análisis de viabilidad para **abrir un nuevo negocio** del tipo "${businessType}" en ${cityState}.
Incluya: oportunidad de mercado, saturación, mejor modelo de negocio, inversión inicial sugerida, ubicaciones recomendadas.
Para suggestedOffer/suggestedTicket: sugiera modelo de negocio y rango de inversión adecuados para abrir este negocio en la región.`,
            expand: `Análisis de viabilidad para **expandir el negocio / abrir sucursal** del tipo "${businessType}" en ${cityState}.
Incluya: atractivo de la región para expansión, competencia, riesgos y recomendaciones para apertura de sucursal.
Para suggestedOffer/suggestedTicket: adapte al contexto de expansión/sucursal (costos, ticket sugerido en la nueva ciudad).`,
            my_business: `Análisis de viabilidad **del negocio del usuario** (${businessType}) en la ciudad ${cityState}.
Use los datos de mercado para evaluar si la ciudad es viable para este negocio específico.
Para suggestedOffer/suggestedTicket: recomendaciones para que el negocio del usuario opere en esa ciudad.`,
        };
        return modes[mode];
    }
    const modes: Record<ViabilityMode, string> = {
        new_business: `Análise de viabilidade para **abrir um novo negócio** do tipo "${businessType}" em ${cityState}.
Inclua: oportunidade de mercado, saturação, melhor modelo de negócio, investimento inicial sugerido, locais recomendados.
Para suggestedOffer/suggestedTicket: sugira modelo de negócio e faixa de investimento adequados para quem vai abrir esse negócio na região.`,
        expand: `Análise de viabilidade para **expandir o negócio / abrir filial** do tipo "${businessType}" em ${cityState}.
Inclua: atratividade da região para expansão, concorrência, riscos e recomendações para abertura de filial.
Para suggestedOffer/suggestedTicket: adapte ao contexto de expansão/filial (custos, ticket sugerido na nova cidade).`,
        my_business: `Análise de viabilidade **do negócio do usuário** (${businessType}) na cidade ${cityState}.
Use os dados de mercado para avaliar se a cidade é viável para esse negócio específico.
Para suggestedOffer/suggestedTicket: recomendações para o negócio do usuário atuar nessa cidade.`,
    };
    return modes[mode];
}

function buildViabilityBusinessContextBlock(
    locale: string,
    businessContext: ViabilityBusinessContext,
): string {
    const l = lang(locale);
    const na = notInformedLabel(locale);
    const header = l === 'en' ? 'COMPANY PROFILE DATA:' : l === 'es' ? 'DATOS DEL PERFIL DE LA EMPRESA:' : 'DADOS DO PERFIL DA EMPRESA:';
    const labels = l === 'en'
        ? {
            name: 'Name', legalName: 'Legal name', tradeName: 'Trade name', cnpj: 'Tax ID',
            cnae: 'Primary CNAE', size: 'Size', founded: 'Founded', audience: 'Target audience',
            benefit: 'Main benefit', model: 'Service model', ticket: 'Average ticket',
            radius: 'Operation radius', competitors: 'Known competitors',
        }
        : l === 'es'
            ? {
                name: 'Nombre', legalName: 'Razón social', tradeName: 'Nombre comercial', cnpj: 'CNPJ',
                cnae: 'CNAE principal', size: 'Tamaño', founded: 'Fecha de apertura', audience: 'Público objetivo',
                benefit: 'Diferencial principal', model: 'Modelo de atención', ticket: 'Ticket promedio',
                radius: 'Radio de operación', competitors: 'Competidores conocidos',
            }
            : {
                name: 'Nome', legalName: 'Razão social', tradeName: 'Nome fantasia', cnpj: 'CNPJ',
                cnae: 'CNAE principal', size: 'Porte', founded: 'Data de abertura', audience: 'Público-alvo',
                benefit: 'Diferencial principal', model: 'Modelo de atendimento', ticket: 'Ticket médio',
                radius: 'Raio de operação', competitors: 'Concorrentes conhecidos',
            };

    const cnaeLine = businessContext.primaryCnaeCode
        ? `${businessContext.primaryCnaeCode}${businessContext.primaryCnaeDescription ? ` — ${businessContext.primaryCnaeDescription}` : ''}`
        : na;
    const ticketLine = businessContext.averageTicket != null
        ? (l === 'en' ? `$${businessContext.averageTicket}` : l === 'es' ? `$${businessContext.averageTicket}` : `R$ ${businessContext.averageTicket}`)
        : na;
    const radiusLine = businessContext.operationRadiusKm != null
        ? `${businessContext.operationRadiusKm} km`
        : na;

    return `
${header}
- ${labels.name}: ${businessContext.companyName || na}
- ${labels.legalName}: ${businessContext.legalName || na}
- ${labels.tradeName}: ${businessContext.tradeName || na}
- ${labels.cnpj}: ${businessContext.cnpj || na}
- ${labels.cnae}: ${cnaeLine}
- ${labels.size}: ${businessContext.companySize || na}
- ${labels.founded}: ${businessContext.foundingDate || na}
- ${labels.audience}: ${businessContext.targetAudience || na}
- ${labels.benefit}: ${businessContext.mainBenefit || na}
- ${labels.model}: ${businessContext.serviceModel || na}
- ${labels.ticket}: ${ticketLine}
- ${labels.radius}: ${radiusLine}
- ${labels.competitors}: ${businessContext.knownCompetitors || na}
`;
}

export function buildViabilityTextQuery(
    locale: string,
    businessType: string,
    city: string,
    state?: string,
): string {
    const l = lang(locale);
    const connector = l === 'en' ? 'in' : 'en';
    const statePart = state ? `, ${state}` : '';
    return l === 'pt'
        ? `${businessType} em ${city}${statePart}`
        : `${businessType} ${connector} ${city}${statePart}`;
}

export function buildViabilityAnalysisPrompt(
    locale: string,
    mode: ViabilityMode,
    input: { businessType: string; city: string; state?: string; businessContext?: ViabilityBusinessContext },
    context: ViabilityPromptContext,
    webContext?: string,
): string {
    const l = lang(locale);
    const languageRule = getAiLanguageRule(locale);
    const statePart = input.state ? `, ${input.state}` : '';
    const cityState = `${input.city}${statePart}`;
    const intro = buildViabilityModeIntro(locale, mode, input.businessType, cityState);
    const businessContextBlock = input.businessContext
        ? buildViabilityBusinessContextBlock(locale, input.businessContext)
        : '';

    const role = l === 'en'
        ? 'You are a business consultant specialized in local viability analysis.'
        : l === 'es'
            ? 'Eres un consultor de negocios especializado en análisis de viabilidad local.'
            : 'Você é um consultor de negócios especializado em análise de viabilidade local no Brasil.';

    const dataHeader = l === 'en' ? 'LOCAL MARKET DATA:' : l === 'es' ? 'DATOS DEL MERCADO LOCAL:' : 'DADOS DO MERCADO LOCAL:';
    const labels = l === 'en'
        ? {
            total: 'Total competitors mapped', avgRating: 'Average rating',
            topRating: 'Top 3 by rating', topReviews: 'Top 3 by review volume',
            withWebsite: 'With website', withoutWebsite: 'Without website',
            withPhone: 'With phone', withoutPhone: 'Without phone',
            opportunities: 'Opportunities (no digital presence)',
            topScored: 'Top scored opportunity leads', segments: 'Segments found',
            digitalMaturity: 'Regional digital maturity', saturation: 'Saturation index',
        }
        : l === 'es'
            ? {
                total: 'Total de competidores mapeados', avgRating: 'Rating promedio',
                topRating: 'Top 3 por valoración', topReviews: 'Top 3 por volumen de reseñas',
                withWebsite: 'Con sitio web', withoutWebsite: 'Sin sitio web',
                withPhone: 'Con teléfono', withoutPhone: 'Sin teléfono',
                opportunities: 'Oportunidades (sin presencia digital)',
                topScored: 'Top leads con score de oportunidad', segments: 'Segmentos encontrados',
                digitalMaturity: 'Madurez digital de la región', saturation: 'Índice de saturación',
            }
            : {
                total: 'Total de concorrentes mapeados', avgRating: 'Rating médio',
                topRating: 'Top 3 por avaliação', topReviews: 'Top 3 por volume de reviews',
                withWebsite: 'Com website', withoutWebsite: 'Sem website',
                withPhone: 'Com telefone', withoutPhone: 'Sem telefone',
                opportunities: 'Oportunidades (sem presença digital)',
                topScored: 'Top leads com score de oportunidade', segments: 'Segmentos encontrados',
                digitalMaturity: 'Maturidade digital da região', saturation: 'Índice de saturação',
            };

    const jsonIntro = l === 'en'
        ? 'Respond EXCLUSIVELY with valid JSON, no markdown, no backticks:'
        : l === 'es'
            ? 'Responda EXCLUSIVAMENTE en JSON válido, sin markdown, sin backticks:'
            : 'Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem backticks:';

    const verdictExamples = l === 'en'
        ? 'Highly Viable / Viable with Caveats / Moderate / Risky / Not Recommended'
        : l === 'es'
            ? 'Altamente Viable / Viable con Reservas / Moderado / Arriesgado / No Recomendado'
            : 'Altamente Viável / Viável com Ressalvas / Moderado / Arriscado / Não Recomendado';

    const rules = l === 'en'
        ? `CRITICAL RULES:
- Base your answer ONLY on the data provided above
- score must reflect reality: many strong competitors with high ratings means a lower score
- goNoGo: GO if score >= 7, CAUTION if 4-6, NO_GO if < 4
- dailyLeadsTarget: based on total opportunities and a realistic pace
- suggestedTicket: based on niche and region
- verdictKey must match the verdict phrase
- Be realistic and honest; do not overestimate viability`
        : l === 'es'
            ? `REGLAS CRÍTICAS:
- Base su respuesta SOLO en los datos proporcionados arriba
- score debe reflejar la realidad: muchos competidores fuertes con alta valoración implica menor score
- goNoGo: GO si score >= 7, CAUTION si 4-6, NO_GO si < 4
- dailyLeadsTarget: basado en el total de oportunidades y un ritmo realista
- suggestedTicket: basado en el nicho y la región
- Sea realista y honesto; no sobreestime la viabilidad`
            : `REGRAS CRÍTICAS:
- Baseie-se APENAS nos dados fornecidos acima
- score deve refletir a realidade: se há muitos concorrentes com alta avaliação, o score deve ser menor
- goNoGo: GO se score >= 7, CAUTION se 4-6, NO_GO se < 4
- dailyLeadsTarget: base no total de oportunidades e um ritmo realista
- suggestedTicket: baseado no nicho e na região
- Seja realista e honesto, não superestime a viabilidade`;

    const basePrompt = `${role}
${intro}
${businessContextBlock}

${dataHeader}
- ${labels.total}: ${context.totalCompetitors}
- ${labels.avgRating}: ${context.avgRating ?? 'N/A'}
- ${labels.topRating}: ${context.top3ByRating || 'N/A'}
- ${labels.topReviews}: ${context.top3ByReviews || 'N/A'}
- ${labels.withWebsite}: ${context.withWebsite} / ${labels.withoutWebsite}: ${context.withoutWebsite}
- ${labels.withPhone}: ${context.withPhone} / ${labels.withoutPhone}: ${context.withoutPhone}
- ${labels.opportunities}: ${context.opportunitiesCount}
- ${labels.topScored}: ${context.topScoredCount} (${l === 'en' ? 'avg score' : l === 'es' ? 'score promedio' : 'score médio'}: ${context.avgScore}/100)
- ${labels.segments}: ${context.segments || 'N/A'}
- ${labels.digitalMaturity}: ${context.digitalMaturityPercent}%
- ${labels.saturation}: ${context.saturationIndex}

${languageRule}

${jsonIntro}
{
  "score": <number 0-10, where 10 = highly viable>,
  "verdictKey": "<HIGHLY_VIABLE | VIABLE_WITH_CAVEATS | MODERATE | RISKY | NOT_RECOMMENDED>",
  "verdict": "<short phrase: ${verdictExamples}>",
  "goNoGo": "<GO | CAUTION | NO_GO>",
  "summary": "<3-4 sentence paragraph explaining overall viability with concrete data>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>", "<recommendation 4>"],
  "estimatedInvestment": "<estimated initial investment range for this business type in this region>",
  "bestLocations": ["<neighborhood/area suggestion 1>", "<suggestion 2>"],
  "dailyLeadsTarget": <integer: how many leads per day to prospect in this niche>,
  "suggestedOffer": "<suggested offer according to analysis mode>",
  "suggestedTicket": "<suggested monthly ticket according to context>"
}

${rules}
`;
    return webContext ? `${basePrompt}\n\n${webContext}\n\n` : basePrompt;
}

export function buildViabilityFallbackReport(locale: string, city: string) {
    const l = lang(locale);
    if (l === 'en') {
        return {
            score: 5,
            verdictKey: 'MODERATE',
            verdict: 'Partial analysis',
            goNoGo: 'CAUTION',
            summary: 'Could not generate a complete analysis. Please try again.',
            strengths: ['Market data collected successfully'],
            risks: ['Incomplete AI analysis'],
            recommendations: ['Try again with more specific terms'],
            estimatedInvestment: 'Not estimated',
            bestLocations: [city],
            dailyLeadsTarget: 5,
            suggestedOffer: 'Website + Local SEO package',
            suggestedTicket: 'Contact for pricing',
        };
    }
    if (l === 'es') {
        return {
            score: 5,
            verdictKey: 'MODERATE',
            verdict: 'Análisis parcial',
            goNoGo: 'CAUTION',
            summary: 'No fue posible generar un análisis completo. Intente de nuevo.',
            strengths: ['Datos de mercado recopilados con éxito'],
            risks: ['Análisis de IA incompleto'],
            recommendations: ['Intente de nuevo con términos más específicos'],
            estimatedInvestment: 'No estimado',
            bestLocations: [city],
            dailyLeadsTarget: 5,
            suggestedOffer: 'Paquete Sitio Web + SEO Local',
            suggestedTicket: 'Consultar valores',
        };
    }
    return {
        score: 5,
        verdictKey: 'MODERATE',
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

export function viabilityDefaultOffer(locale: string): string {
    const l = lang(locale);
    if (l === 'en') return 'Website + Local SEO package';
    if (l === 'es') return 'Paquete Sitio Web + SEO Local';
    return 'Pacote Website + SEO Local';
}

export function viabilityDefaultTicket(locale: string): string {
    const l = lang(locale);
    if (l === 'en') return 'Contact for pricing';
    if (l === 'es') return 'Consultar valores';
    return 'Consultar valores';
}

export function viabilityNotEstimated(locale: string): string {
    const l = lang(locale);
    if (l === 'en') return 'Not estimated';
    if (l === 'es') return 'No estimado';
    return 'Não estimado';
}

export { reviewsCountLabel };
