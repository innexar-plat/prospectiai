/**
 * Prompt construction helpers for lead analysis.
 *
 * Builds the system + user prompt from business data, user profile,
 * web context, and RF data. Extracted from gemini.ts monolith.
 */

import type { BusinessData } from './analyze-types';
import type { UserBusinessProfile } from './analyze-types';
import { LEAD_DATA_LABELS, LEAD_REQUIREMENTS_LABELS, JSON_SCHEMA_LABELS } from './labels';

export function buildTaskDescription(isEn: boolean): string {
    return isEn
        ? `Your task is to generate a DEEP, DETAILED, and ACTIONABLE strategic prospecting report for the lead below.
Be like a senior consultant who has researched this company thoroughly. Avoid generic statements.
Every insight must be specific to THIS business and how YOUR product/service can help them.

REPORT LENGTH REQUIREMENTS:
- The "fullReport" field MUST be at least 2000 words with rich Markdown formatting.
- Each section (Executive Summary, Digital Strategy, Deep Gaps, Operational Vulnerabilities, Competitor Profile, Complete Action Plan) must have multiple detailed paragraphs.
- Include specific data points, numbers, percentages, and actionable recommendations.
- The report should read like a professional consulting deliverable, not a brief summary.
- DO NOT be brief. The user is PAYING for depth and detail. More analysis = more value.`
        : `Sua tarefa é gerar um relatório estratégico de prospecção PROFUNDO, DETALHADO e ACIONÁVEL para o lead abaixo.
Seja como um consultor sênior que pesquisou a fundo esta empresa. Evite afirmações genéricas.
Cada análise deve ser específica para ESTE negócio e como o SEU produto/serviço pode ajudá-los.

REQUISITOS DE TAMANHO DO RELATÓRIO:
- O campo "fullReport" DEVE ter no mínimo 2000 palavras com formatação Markdown rica.
- Cada seção (Resumo Executivo, Estratégia Digital, Lacunas Profundas, Vulnerabilidades Operacionais, Perfil do Concorrente, Plano de Ação Completo) deve ter múltiplos parágrafos detalhados.
- Inclua dados específicos, números, percentuais e recomendações acionáveis.
- O relatório deve parecer uma entrega de consultoria profissional, não um resumo breve.
- NÃO seja breve. O usuário está PAGANDO pela profundidade e detalhe. Mais análise = mais valor.`;
}

export function expandProductService(raw: string): string {
    const lower = raw.toLowerCase().trim();
    const EXPANSIONS: Record<string, string> = {
        'imobiliaria': 'Imobiliária — venda, locação e administração de imóveis residenciais e comerciais, avaliação de propriedades, consultoria imobiliária',
        'imobiliária': 'Imobiliária — venda, locação e administração de imóveis residenciais e comerciais, avaliação de propriedades, consultoria imobiliária',
        'contabilidade': 'Escritório de contabilidade — serviços contábeis, fiscais, trabalhistas, abertura de empresas, planejamento tributário',
        'advocacia': 'Escritório de advocacia — consultoria jurídica, contencioso, contratos, compliance',
        'seguros': 'Corretora de seguros — seguros de vida, auto, empresarial, saúde, patrimonial',
        'marketing': 'Agência de marketing — marketing digital, redes sociais, SEO, anúncios pagos, criação de sites',
        'tecnologia': 'Empresa de tecnologia — desenvolvimento de software, aplicativos, sistemas, infraestrutura de TI',
        'limpeza': 'Empresa de limpeza — limpeza comercial, industrial, residencial, pós-obra',
        'consultoria': 'Consultoria empresarial — gestão, processos, estratégia, planejamento',
    };
    for (const [key, expanded] of Object.entries(EXPANSIONS)) {
        if (lower === key || lower.includes(key)) return expanded;
    }
    return raw;
}

export function buildCompanyContext(finalProfile: UserBusinessProfile | undefined, isEn: boolean): string {
    const fallbackRole = isEn
        ? 'You are a Senior B2B Strategic Consultant specialized in commercial prospecting.'
        : 'Você é um Consultor Estratégico B2B Sênior especializado em prospecção comercial.';
    if (!finalProfile) return fallbackRole;
    const expandedProduct = expandProductService(finalProfile.productService);
    return isEn
        ? `You are a Senior B2B Commercial Consultant for "${finalProfile.companyName}".
"${finalProfile.companyName}" offers: "${expandedProduct}".
Target audience: "${finalProfile.targetAudience}".
Main competitive advantage: "${finalProfile.mainBenefit}".

CRUCIAL CONTEXT — YOUR PERSPECTIVE:
- You are analyzing this lead FROM THE PERSPECTIVE of "${finalProfile.companyName}", which sells "${expandedProduct}".
- The goal is to discover whether this lead NEEDS what you sell and how to approach them.
- If the lead has no website, that is ONLY relevant if YOUR product is websites/marketing. Otherwise, ignore it or mention it briefly.
- NEVER suggest the lead create a website, do SEO, or improve digital marketing UNLESS that is exactly what "${finalProfile.companyName}" sells.
- Focus on: Does this lead need YOUR service? What specific pain points make them a good prospect FOR YOUR OFFERING?

MANDATORY RULES:
1. The ENTIRE analysis must answer: "Why would this lead buy from ${finalProfile.companyName}?"
2. Gaps/weaknesses must be relevant to YOUR product ("${expandedProduct}"), not generic digital marketing gaps.
3. Approach strategy must pitch YOUR specific service, not generic advice.
4. Scripts/messages must mention YOUR service naturally.
5. fullReport must deeply analyze the match between this lead's needs and YOUR offering.`
        : `Você é um Consultor Comercial B2B Sênior trabalhando para "${finalProfile.companyName}".
"${finalProfile.companyName}" oferece: "${expandedProduct}".
Público-alvo: "${finalProfile.targetAudience}".
Principal diferencial: "${finalProfile.mainBenefit}".

CONTEXTO CRUCIAL — SUA PERSPECTIVA:
- Você está analisando este lead DO PONTO DE VISTA de "${finalProfile.companyName}", que vende "${expandedProduct}".
- O objetivo é descobrir se este lead PRECISA do que você vende e como abordá-lo.
- Se o lead não tem website, isso SÓ é relevante se o SEU produto for sites/marketing. Caso contrário, ignore ou mencione brevemente.
- NUNCA sugira que o lead crie um site, faça SEO ou melhore marketing digital A MENOS que seja exatamente o que "${finalProfile.companyName}" vende.
- Foque em: Este lead precisa do SEU serviço? Quais dores específicas fazem dele um bom prospect PARA A SUA OFERTA?

REGRAS OBRIGATÓRIAS:
1. A análise INTEIRA deve responder: "Por que este lead compraria de ${finalProfile.companyName}?"
2. Lacunas/fraquezas devem ser relevantes ao SEU produto ("${expandedProduct}"), não lacunas genéricas de marketing digital.
3. Estratégia de abordagem deve vender O SEU serviço específico, não dar conselhos genéricos.
4. Scripts/mensagens devem mencionar O SEU serviço naturalmente.
5. fullReport deve analisar profundamente o match entre as necessidades do lead e a SUA oferta.`;
}

function getWebsiteNote(website: string, isEn: boolean): string {
    if (!website) return '';
    return isEn
        ? '\nCRITICAL: This lead HAS a website (URL above). You MUST acknowledge it, analyze it when relevant (content, UX, SEO, gaps in the site itself), and NEVER list "no website" or "missing website" as a gap.'
        : '\nCRÍTICO: Este lead POSSUI website (URL acima). Você DEVE reconhecê-lo, analisá-lo quando relevante (conteúdo, UX, SEO, lacunas no próprio site) e NUNCA listar "sem website" ou "ausência de site" como lacuna.';
}

function getBusinessPlanNote(isEn: boolean): string {
    return isEn
        ? '\nIMPORTANT: The web context above contains REAL data collected from Reclame Aqui, JusBrasil, CNPJ databases, and general web searches. You MUST analyze this data carefully and incorporate it into your report. Cite specific findings and sources. If Reclame Aqui shows complaints, detail them. If JusBrasil shows lawsuits, flag the risks. If CNPJ data reveals information about the company, use it.'
        : '\nIMPORTANTE: O contexto da web acima contém dados REAIS coletados do Reclame Aqui, JusBrasil, bases de CNPJ e buscas web gerais. Você DEVE analisar esses dados cuidadosamente e incorporá-los ao seu relatório. Cite achados e fontes específicas. Se o Reclame Aqui mostra reclamações, detalhe-as. Se o JusBrasil mostra processos, sinalize os riscos. Se dados de CNPJ revelam informações sobre a empresa, use-os.';
}

function getWebContextBlock(webContext: string, isBusinessPlan: boolean, isEn: boolean): string {
    if (!webContext) return '';
    const businessPlanNote = isBusinessPlan ? getBusinessPlanNote(isEn) : '';
    return `\n\n${webContext}\n${businessPlanNote}\n\n`;
}

function getPoint6Requirement(isBusinessPlan: boolean, isEn: boolean): string {
    if (!isBusinessPlan) return '';
    return isEn
        ? '8. DEEP REPUTATION ANALYSIS: Using the REAL data from Reclame Aqui and JusBrasil provided in the web context above, analyze: (a) consumer reputation — complaints, response rate, resolution rate; (b) legal risks — lawsuits, labor disputes, consumer protection cases; (c) CNPJ data — company size, founding date, business activities. Include ALL findings in the full report with source citations.'
        : '8. ANÁLISE PROFUNDA DE REPUTAÇÃO: Usando os dados REAIS do Reclame Aqui e JusBrasil fornecidos no contexto da web acima, analise: (a) reputação do consumidor — reclamações, taxa de resposta, taxa de resolução; (b) riscos legais — processos, disputas trabalhistas, casos de defesa do consumidor; (c) dados de CNPJ — porte da empresa, data de fundação, atividades empresariais. Inclua TODOS os achados no relatório completo com citações de fonte.';
}

function getExtendedJsonSchemaBlock(isBusinessPlan: boolean, isEn: boolean): string {
    if (!isBusinessPlan) return '';
    const reclamePrompt = isEn ? 'Analysis of Reclame Aqui data: complaint patterns, response rate, resolution rate, overall reputation score. If no data found, state that clearly.' : 'Análise dos dados do Reclame Aqui: padrões de reclamação, taxa de resposta, taxa de resolução, score geral de reputação. Se nenhum dado foi encontrado, declare isso claramente.';
    const jusBrasilPrompt = isEn ? 'Analysis of JusBrasil data: lawsuits, labor disputes, consumer cases, legal risks. If no data found, state that clearly.' : 'Análise dos dados do JusBrasil: processos, disputas trabalhistas, casos de consumidor, riscos legais. Se nenhum dado foi encontrado, declare isso claramente.';
    const cnpjPrompt = isEn ? 'Analysis of CNPJ data: company size, founding date, registered activities, tax status. If no data found, state that clearly.' : 'Análise dos dados de CNPJ: porte da empresa, data de fundação, atividades registradas, situação fiscal. Se nenhum dado foi encontrado, declare isso claramente.';
    return `  ,"reclameAquiAnalysis": "<${reclamePrompt}>"
  ,"jusBrasilAnalysis": "<${jusBrasilPrompt}>"
  ,"cnpjAnalysis": "<${cnpjPrompt}>"`;
}

export function buildRfDataBlock(business: BusinessData, isEn: boolean): string {
    if (!business.cnpj) return '';
    const lines: string[] = [];
    const header = isEn ? 'RECEITA FEDERAL DATA (official Brazilian government records):' : 'DADOS DA RECEITA FEDERAL (registros oficiais do governo brasileiro):';
    lines.push(`\n${header}`);
    lines.push(`- CNPJ: ${business.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}`);
    if (business.companyLegalName) lines.push(`- ${isEn ? 'Legal Name' : 'Razão Social'}: ${business.companyLegalName}`);
    if (business.companyTradeName) lines.push(`- ${isEn ? 'Trade Name' : 'Nome Fantasia'}: ${business.companyTradeName}`);
    if (business.companyPorte) lines.push(`- ${isEn ? 'Company Size' : 'Porte'}: ${business.companyPorte}`);
    if (business.companyCapitalSocial != null) lines.push(`- ${isEn ? 'Share Capital' : 'Capital Social'}: R$ ${business.companyCapitalSocial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    if (business.companyMainCnae) lines.push(`- ${isEn ? 'Main Activity (CNAE)' : 'Atividade Principal (CNAE)'}: ${business.companyMainCnae}`);
    if (business.cnpjStatus) lines.push(`- ${isEn ? 'CNPJ Status' : 'Situação CNPJ'}: ${business.cnpjStatus}`);
    if (business.cnpjOpenedAt) lines.push(`- ${isEn ? 'Founded' : 'Data de Abertura'}: ${business.cnpjOpenedAt}`);
    if (business.rfEmail) lines.push(`- ${isEn ? 'RF Email' : 'Email (RF)'}: ${business.rfEmail}`);
    if (business.matchConfidence != null) {
        lines.push(`- ${isEn ? 'Match Confidence' : 'Confiança do Match'}: ${business.matchConfidence}% (${business.matchMethod || 'unknown'})`);
    }
    const note = isEn
        ? '\nIMPORTANT: Use this official data to assess company maturity, financial capacity, legal status, and business size. This data is from the Brazilian Federal Revenue Service and is highly reliable.'
        : '\nIMPORTANTE: Use esses dados oficiais para avaliar maturidade da empresa, capacidade financeira, situação legal e porte do negócio. Esses dados são da Receita Federal do Brasil e são altamente confiáveis.';
    lines.push(note);
    return lines.join('\n');
}

export function buildReviewSignalsText(
    reviews: BusinessData['reviews'],
    isEn: boolean,
): string {
    if (!reviews?.length) {
        return isEn ? 'No negative review signals detected (no review data).' : 'Sem sinais de reviews negativas (sem dados de avaliações).';
    }
    const negatives = reviews
        .filter((r) => r.rating <= 3)
        .slice(0, 5)
        .map((r) => {
            const author = r.authorAttribution?.displayName || (isEn ? 'Customer' : 'Cliente');
            const text = r.text?.text?.slice(0, 180) || (isEn ? 'No text' : 'Sem texto');
            const when = r.relativePublishTimeDescription || (isEn ? 'unknown time' : 'tempo desconhecido');
            return `- [${r.rating}/5 | ${when}] ${author}: "${text}"`;
        });
    if (!negatives.length) {
        return isEn ? 'No strong negative reviews in the sampled data.' : 'Sem reviews fortemente negativas na amostra.';
    }
    return negatives.join('\n');
}

export function buildOpeningHoursText(hours: BusinessData['currentOpeningHours'], isEn: boolean): string {
    const weekday = hours?.weekdayDescriptions?.slice(0, 7) ?? [];
    if (!weekday.length) {
        return isEn ? 'Opening hours not available.' : 'Horários de funcionamento indisponíveis.';
    }
    const openNow = typeof hours?.openNow === 'boolean'
        ? (isEn ? (hours.openNow ? 'Open now' : 'Closed now') : (hours.openNow ? 'Aberto agora' : 'Fechado agora'))
        : (isEn ? 'Open state unknown' : 'Status de abertura desconhecido');
    return `${openNow}\n${weekday.map((d) => `- ${d}`).join('\n')}`;
}

interface BuildLeadPromptInput {
    business: BusinessData;
    isEn: boolean;
    companyContext: string;
    taskDescription: string;
    address: string;
    phone: string;
    website: string;
    reviewCount: number;
    reviewsText: string;
    reviewSignalsText: string;
    openingHoursText: string;
    webContext: string;
    isBusinessPlan: boolean;
    conversionContext: string;
    rfDataBlock: string;
    websiteScrapingBlock: string;
}

export function buildLeadAnalysisPrompt(opts: BuildLeadPromptInput): string {
    const { companyContext, taskDescription, isEn, isBusinessPlan } = opts;
    const L = LEAD_REQUIREMENTS_LABELS[isEn ? 'en' : 'pt'];
    const D = LEAD_DATA_LABELS[isEn ? 'en' : 'pt'];
    const J = JSON_SCHEMA_LABELS[isEn ? 'en' : 'pt'];

    const typeVal = opts.business.primaryType || opts.business.types?.join(', ') || D.notSpecified;
    const webBlock = getWebContextBlock(opts.webContext, isBusinessPlan, isEn);

    return `${companyContext}

${taskDescription}

${D.section}
- ${D.name}: ${opts.business.name}
- ${D.type}: ${typeVal}
- ${D.address}: ${opts.address || D.notAvailable}
- ${D.phone}: ${opts.phone || D.noPhone}
- ${D.website}: ${opts.website || D.noWebsite}
- ${D.rating}: ${opts.business.rating ?? D.noRating}/5
- ${D.reviews}: ${opts.reviewCount}
- ${D.status}: ${opts.business.businessStatus || 'OPERATIONAL'}
${getWebsiteNote(opts.website, isEn)}
${opts.rfDataBlock}
${opts.websiteScrapingBlock}

${D.reviewsSection}
${opts.reviewsText}

${D.reviewSignals}
${opts.reviewSignalsText}

${D.openingHours}
${opts.openingHoursText}
${webBlock}

${opts.conversionContext}

${L.header}
1. ${L.gaps}
2. ${L.painPoints}
3. ${L.socialMedia}
4. ${L.firstContact}
5. ${L.recency}
6. ${L.timing}
${getPoint6Requirement(isBusinessPlan, isEn)}
7. ${L.whatsapp}

${J.intro}
{
  "score": <number 1-100>,
  "scoreLabel": "<${J.scoreLabel}>",
  "summary": "<${J.summary}>",
  "strengths": ["<${J.strength}>", "<${J.strength2}>", "<${J.strength3}>"],
  "weaknesses": ["<${J.weakness}>", "<${J.weakness2}>", "<${J.weakness3}>"],
  "painPoints": ["<${J.painPoint}>", "<${J.painPoint2}>", "<${J.painPoint3}>", "<${J.painPoint4}>"],
  "gaps": ["<${J.gap}>", "<${J.gap2}>", "<${D.noWebsite ? '...' : 'gap 3'}>", "gap 4"],
  "approach": "<${J.approach}>",
  "contactStrategy": "<${J.contactStrategy}>",
  "firstContactMessage": "<${J.firstContact}>",
  "suggestedWhatsAppMessage": "<${J.whatsapp}>",
  "reviewAnalysis": "<${J.reviewAnalysis}>",
  "reviewTrend": "<${J.reviewTrend}>",
  "suggestedContactTime": "<${J.contactTime}>",
  "socialMedia": { "instagram": "<${J.instagram}>", "facebook": "<${J.facebook}>", "linkedin": "<${J.linkedin}>" },
  "fullReport": "<${J.fullReport}>",
  "closeProbability": <${isEn ? 'number 0-100, predicted chance of closing THIS specific lead based on your conversion history and lead profile. 0=impossible, 100=guaranteed' : 'número 0-100, chance prevista de fechar ESTE lead baseado no histórico de conversão e perfil do lead. 0=impossível, 100=garantido'}>,
  "estimatedDealValue": <${isEn ? 'number in BRL, estimated deal size based on business size, type, and your avg ticket' : 'número em BRL, valor estimado do deal baseado no tamanho do negócio, tipo e seu ticket médio'}>,
  "bestContactWindow": "<${isEn ? 'Specific day and time window, e.g. Tuesday 10am-12pm, with rationale' : 'Dia e horário específico, ex: Terça 10h-12h, com justificativa'}>"
${getExtendedJsonSchemaBlock(isBusinessPlan, isEn)}
}`;
}
