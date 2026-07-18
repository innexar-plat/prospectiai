/**
 * Market-aware helpers for company analysis (Serper queries, prompts, Places locale).
 * Prompt/output language follows UI locale; market drives regional data sources (BBB vs Reclame Aqui).
 */

import { getAiLanguageRule } from '@/lib/ai/prompts/locale';
import { normalizeAnalyzeLocale } from '@/lib/i18n/analysis-error-messages';
import { getMarketConfig, type Market } from '@/lib/market';
import type { CompanyAnalysisInput } from '../domain/types';

type PromptLang = 'pt' | 'en' | 'es';

function promptLang(locale: string): PromptLang {
    return normalizeAnalyzeLocale(locale);
}

export function getGeocodeCountry(market: Market): string {
    return market === 'US' ? 'United States' : 'Brasil';
}

export function getPlacesLocale(market: Market, locale?: string): { languageCode: string; regionCode: string } {
    const lang = promptLang(locale ?? (market === 'US' ? 'en' : 'pt'));
    const languageCode = lang === 'en' ? 'en' : lang === 'es' ? 'es' : 'pt-BR';
    return { languageCode, regionCode: market === 'US' ? 'US' : 'BR' };
}

export function buildSerperQueries(input: CompanyAnalysisInput, market: Market): string[] {
    const name = input.companyName.trim();
    const queries: string[] = market === 'US'
        ? [
            `${name} Google reviews`,
            `${name} complaints`,
            `${name} BBB`,
        ]
        : [
            `${name} Reclame Aqui`,
            `${name} avaliações Google`,
            `${name} reclamações`,
        ];

    if (name) {
        queries.push(`${name} Instagram`);
        queries.push(`${name} Facebook`);
        queries.push(`${name} LinkedIn`);
    }

    const withUrls: string[] = [];
    if (input.instagramUrl?.trim()) withUrls.push(input.instagramUrl.trim());
    if (input.facebookUrl?.trim()) withUrls.push(input.facebookUrl.trim());
    if (input.linkedInUrl?.trim()) withUrls.push(input.linkedInUrl.trim());

    for (let i = 0; i < Math.min(withUrls.length, 3); i++) {
        const idx = queries.length - 3 + i;
        if (idx >= 3) queries[idx] = withUrls[i]!;
    }

    return queries.slice(0, 6);
}

export function buildProfileBlock(input: CompanyAnalysisInput, market: Market): string {
    const currency = getMarketConfig(market).currency;
    const ticketLabel = market === 'US' ? 'Average ticket' : 'Ticket médio';
    const radiusLabel = market === 'US' ? 'Service radius' : 'Raio de operação';
    const radiusUnit = market === 'US' ? 'mi' : 'km';
    const radiusValue = input.operationRadiusKm != null
        ? market === 'US'
            ? Math.round(input.operationRadiusKm * 0.621371)
            : input.operationRadiusKm
        : null;

    const lines: string[] = market === 'US'
        ? [
            `- Name: ${input.companyName}`,
            input.legalName ? `- Legal name: ${input.legalName}` : '',
            input.tradeName ? `- Trade name: ${input.tradeName}` : '',
            input.productService ? `- Product/service: ${input.productService}` : '',
            input.targetAudience ? `- Target audience: ${input.targetAudience}` : '',
            input.mainBenefit ? `- Main benefit: ${input.mainBenefit}` : '',
            input.address ? `- Address: ${input.address}` : '',
            input.postalCode ? `- ZIP code: ${input.postalCode}` : '',
            input.neighborhood ? `- Neighborhood: ${input.neighborhood}` : '',
            input.city ? `- City: ${input.city}` : '',
            input.state ? `- State: ${input.state}` : '',
            input.websiteUrl ? `- Website: ${input.websiteUrl}` : '',
            input.serviceModel ? `- Service model: ${input.serviceModel}` : '',
            radiusValue != null ? `- ${radiusLabel}: ${radiusValue} ${radiusUnit}` : '',
            input.knownCompetitors ? `- Known competitors: ${input.knownCompetitors}` : '',
            'Official social links:',
            input.linkedInUrl ? `  - LinkedIn: ${input.linkedInUrl}` : '  - LinkedIn: not provided',
            input.instagramUrl ? `  - Instagram: ${input.instagramUrl}` : '  - Instagram: not provided',
            input.facebookUrl ? `  - Facebook: ${input.facebookUrl}` : '  - Facebook: not provided',
        ]
        : [
            `- Nome: ${input.companyName}`,
            input.legalName ? `- Razão social: ${input.legalName}` : '',
            input.tradeName ? `- Nome fantasia: ${input.tradeName}` : '',
            input.cnpj ? `- CNPJ: ${input.cnpj}` : '',
            input.primaryCnaeCode ? `- CNAE principal: ${input.primaryCnaeCode}${input.primaryCnaeDescription ? ` — ${input.primaryCnaeDescription}` : ''}` : '',
            input.companySize ? `- Porte: ${input.companySize}` : '',
            input.foundingDate ? `- Data de abertura: ${input.foundingDate}` : '',
            input.productService ? `- Produto/serviço: ${input.productService}` : '',
            input.targetAudience ? `- Público-alvo: ${input.targetAudience}` : '',
            input.mainBenefit ? `- Benefício principal: ${input.mainBenefit}` : '',
            input.address ? `- Endereço: ${input.address}` : '',
            input.postalCode ? `- CEP: ${input.postalCode}` : '',
            input.neighborhood ? `- Bairro: ${input.neighborhood}` : '',
            input.city ? `- Cidade: ${input.city}` : '',
            input.state ? `- Estado: ${input.state}` : '',
            input.websiteUrl ? `- Site: ${input.websiteUrl}` : '',
            input.serviceModel ? `- Modelo de atendimento: ${input.serviceModel}` : '',
            input.averageTicket != null ? `- ${ticketLabel}: ${currency === 'USD' ? '$' : 'R$ '}${input.averageTicket}` : '',
            radiusValue != null ? `- ${radiusLabel}: ${radiusValue} ${radiusUnit}` : '',
            input.knownCompetitors ? `- Concorrentes conhecidos: ${input.knownCompetitors}` : '',
            'Links oficiais das redes (perfil da empresa):',
            input.linkedInUrl ? `  - LinkedIn: ${input.linkedInUrl}` : '  - LinkedIn: não informado',
            input.instagramUrl ? `  - Instagram: ${input.instagramUrl}` : '  - Instagram: não informado',
            input.facebookUrl ? `  - Facebook: ${input.facebookUrl}` : '  - Facebook: não informado',
        ];

    return lines.filter(Boolean).join('\n');
}

export function buildPlacesBlock(
    placesContext: { matchedName?: string; rating?: number; userRatingCount?: number; reviewsSnippets: string[] } | null,
    market: Market,
): string {
    if (!placesContext) return '';

    const parts: string[] = market === 'US'
        ? [
            '## Google Reviews (real data from Google Places)',
            placesContext.matchedName ? `- Business found: ${placesContext.matchedName}` : '',
            placesContext.rating != null ? `- Rating: ${placesContext.rating}` : '',
            placesContext.userRatingCount != null ? `- Review count: ${placesContext.userRatingCount}` : '',
        ]
        : [
            '## Avaliações Google (dados reais do Google Places)',
            placesContext.matchedName ? `- Empresa encontrada: ${placesContext.matchedName}` : '',
            placesContext.rating != null ? `- Nota: ${placesContext.rating}` : '',
            placesContext.userRatingCount != null ? `- Número de avaliações: ${placesContext.userRatingCount}` : '',
        ];

    const filtered = parts.filter(Boolean);
    if (placesContext.reviewsSnippets.length > 0) {
        filtered.push(market === 'US' ? 'Review excerpts:' : 'Trechos de avaliações:');
        placesContext.reviewsSnippets.forEach((s, i) => filtered.push(`${i + 1}. ${s}`));
    }
    return filtered.join('\n');
}

export function buildCompanyAnalysisPrompt(
    profileBlock: string,
    webContext: string,
    placesBlock: string,
    noBusinessTypeDeclared: boolean,
    market: Market,
    locale: string,
): string {
    const l = promptLang(locale);
    const languageRule = getAiLanguageRule(locale);
    const includeReclameAqui = market === 'BR';
    const regionLabel = market === 'US'
        ? (l === 'en' ? 'the United States' : 'Estados Unidos')
        : (l === 'en' ? 'Brazil' : 'Brasil');

    const inferInstruction = noBusinessTypeDeclared
        ? l === 'en'
            ? '\nBusiness type was not declared; infer it from the sources (web and Google reviews).\n'
            : l === 'es'
                ? '\nEl tipo de negocio no fue declarado; infiéralo a partir de las fuentes (web y reseñas de Google).\n'
                : '\nO tipo de negócio não foi declarado; infira a partir das fontes (web e avaliações Google).\n'
        : '';

    const intro = l === 'en'
        ? `You are a business consultant specialized in company diagnostics in ${regionLabel}.
Analyze the company based ONLY on the data provided below. Cite sources when making claims.`
        : l === 'es'
            ? `Eres un consultor de negocios especializado en diagnóstico de empresas en ${regionLabel}.
Analiza la empresa con base SOLO en los datos proporcionados abajo. Cita las fuentes cuando hagas afirmaciones.`
            : `Você é um consultor de negócios especializado em diagnóstico de empresas nos ${regionLabel}.
Analise a empresa com base APENAS nos dados fornecidos abaixo. Cite as fontes quando fizer afirmações.`;

    const profileHeader = l === 'en'
        ? '## Company profile (declared data)'
        : l === 'es'
            ? '## Perfil de la empresa (datos declarados)'
            : '## Perfil da empresa (dados declarados)';

    const jsonIntro = l === 'en'
        ? 'Respond EXCLUSIVELY with valid JSON, no markdown, no backticks:'
        : l === 'es'
            ? 'Responda EXCLUSIVAMENTE en JSON válido, sin markdown, sin backticks:'
            : 'Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem backticks:';

    const reclameField = includeReclameAqui
        ? l === 'en'
            ? '  "reclameAquiSummary": "<Reclame Aqui summary or \'Not found\'>",\n'
            : l === 'es'
                ? '  "reclameAquiSummary": "<resumen de Reclame Aqui o \'No encontrado\'>",\n'
                : '  "reclameAquiSummary": "<resumo do que foi encontrado no Reclame Aqui ou \'Não encontrado\'>",\n'
        : '';

    const rules = l === 'en'
        ? 'RULES: Base answers ONLY on provided data. Use null, empty string, or "Not found" when data is missing.'
        : l === 'es'
            ? 'REGLAS: Base las respuestas SOLO en los datos proporcionados. Use null, cadena vacía o "No encontrado" cuando falten datos.'
            : 'REGRAS: Baseie-se APENAS nos dados fornecidos. Se não houver dados para um campo, use null ou string vazia ou "Não encontrado" conforme o caso.';

    return `${intro}
${inferInstruction}
${profileHeader}
${profileBlock}

${webContext}

${placesBlock ? `\n${placesBlock}\n` : ''}

${jsonIntro}
{
  "summary": "<executive summary>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "opportunities": ["<opportunity 1>", "<opportunity 2>", "<opportunity 3>"],
${reclameField}  "googlePresenceScore": <number 0-10>,
  "googleRating": <number or null>,
  "googleReviewCount": <number or null>,
  "googleReviewsSnippets": ["<excerpt 1>"] or [],
  "socialNetworks": {
    "presence": "<social presence summary>",
    "perNetwork": [
      { "network": "Instagram", "link": "<if declared>", "found": "<search findings>", "suggestions": "<suggestion>" },
      { "network": "Facebook", "link": "<if declared>", "found": "<search findings>", "suggestions": "<suggestion>" },
      { "network": "LinkedIn", "link": "<if declared>", "found": "<search findings>", "suggestions": "<suggestion>" }
    ],
    "consistency": "<consistency across networks>",
    "recommendations": ["<social recommendation 1>", "<social recommendation 2>"]
  },
  "suggestedNiche": "<suggested niche>",
  "suggestedBusinessModel": "<suggested business model>",
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"]
}

${rules}
${languageRule}`;
}
