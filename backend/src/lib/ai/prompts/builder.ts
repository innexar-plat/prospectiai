/**
 * Prompt construction helpers for lead analysis.
 *
 * Builds the system + user prompt from business data, user profile,
 * web context, and RF data. Extracted from gemini.ts monolith.
 */

import type { BusinessData } from './analyze-types';
import type { UserBusinessProfile } from './analyze-types';
import { LEAD_DATA_LABELS, LEAD_REQUIREMENTS_LABELS, JSON_SCHEMA_LABELS } from './labels';

const PRODUCT_SERVICE_EXPANSIONS_PT: Record<string, string> = {
    imobiliaria: 'Imobiliária — venda, locação e administração de imóveis residenciais e comerciais, avaliação de propriedades, consultoria imobiliária',
    'imobiliária': 'Imobiliária — venda, locação e administração de imóveis residenciais e comerciais, avaliação de propriedades, consultoria imobiliária',
    contabilidade: 'Escritório de contabilidade — serviços contábeis, fiscais, trabalhistas, abertura de empresas, planejamento tributário',
    advocacia: 'Escritório de advocacia — consultoria jurídica, contencioso, contratos, compliance',
    seguros: 'Corretora de seguros — seguros de vida, auto, empresarial, saúde, patrimonial',
    marketing: 'Agência de marketing — marketing digital, redes sociais, SEO, anúncios pagos, criação de sites',
    tecnologia: 'Empresa de tecnologia — desenvolvimento de software, aplicativos, sistemas, infraestrutura de TI',
    limpeza: 'Empresa de limpeza — limpeza comercial, industrial, residencial, pós-obra',
    consultoria: 'Consultoria empresarial — gestão, processos, estratégia, planejamento',
};

const PRODUCT_SERVICE_EXPANSIONS_EN: Record<string, string> = {
    'real estate': 'Real estate — residential and commercial sales, leasing, property management, valuations',
    realtor: 'Real estate agency — property sales, leasing, and advisory services',
    insurance: 'Insurance brokerage — life, auto, business, health, and property coverage',
    accounting: 'Accounting firm — bookkeeping, tax, payroll, company formation, tax planning',
    legal: 'Law firm — legal advisory, litigation, contracts, compliance',
    marketing: 'Marketing agency — digital marketing, social media, SEO, paid ads, web design',
    technology: 'Technology company — software development, apps, systems, IT infrastructure',
    cleaning: 'Cleaning company — commercial, industrial, residential, post-construction cleaning',
    consulting: 'Business consulting — management, processes, strategy, planning',
};

function normalizeProductServiceKey(raw: string): string {
    return raw.toLowerCase().trim().normalize('NFD').replace(/\p{M}/gu, '');
}

export function buildTaskDescription(isEn: boolean): string {
    return isEn
        ? `Your task is to generate a DEEP, DETAILED, and ACTIONABLE strategic prospecting report for the lead below.
Be like a senior consultant who has researched this company thoroughly. Avoid generic statements.
Every insight must be specific to THIS business and how YOUR product/service can help them.

STRUCTURED OUTPUT REQUIREMENTS:
- The first response is a compact JSON object with only the core analysis fields.
- Be concrete, evidence-based, and specific to this business.
- The long-form report will be generated in separate sections later, so keep this JSON focused and clean.`
        : `Sua tarefa é gerar um relatório estratégico de prospecção PROFUNDO, DETALHADO e ACIONÁVEL para o lead abaixo.
Seja como um consultor sênior que pesquisou a fundo esta empresa. Evite afirmações genéricas.
Cada análise deve ser específica para ESTE negócio e como o SEU produto/serviço pode ajudá-los.

REQUISITOS DA SAÍDA ESTRUTURADA:
- A primeira resposta é um JSON compacto apenas com os campos centrais da análise.
- Seja concreto, baseado em evidências e específico para este negócio.
- O relatório longo será gerado depois em seções separadas, então mantenha este JSON limpo e focado.`;
}

export function expandProductService(raw: string, isEn = false): string {
    const normalized = normalizeProductServiceKey(raw);
    const expansions = isEn ? PRODUCT_SERVICE_EXPANSIONS_EN : PRODUCT_SERVICE_EXPANSIONS_PT;
    return expansions[normalized] ?? raw.trim();
}

export function formatLeadNiche(primaryType?: string, types?: string[]): string {
    const raw = primaryType || types?.[0] || '';
    if (!raw) return '';
    return raw
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function extractLeadLocation(address: string): string {
    if (!address?.trim()) return '';
    const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
        return parts.slice(-2).join(', ');
    }
    return parts[parts.length - 1] ?? '';
}

export function buildGapsRequirement(profile: UserBusinessProfile | undefined, isEn: boolean): string {
    const fallback = LEAD_REQUIREMENTS_LABELS[isEn ? 'en' : 'pt'].gaps;
    if (!profile?.productService?.trim()) return fallback;
    const offering = expandProductService(profile.productService, isEn);
    return isEn
        ? `GAPS & OPPORTUNITIES: What is this lead missing that "${profile.companyName}" can solve with "${offering}"? Focus ONLY on gaps your company can address. Never pitch real estate, insurance, accounting, or other industries unless that is exactly what you sell.`
        : `LACUNAS & OPORTUNIDADES: O que este lead está faltando que "${profile.companyName}" pode resolver com "${offering}"? Foque APENAS em lacunas que a sua empresa pode atender. Nunca venda imóveis, seguros, contabilidade ou outros setores a menos que seja exatamente o que você vende.`;
}

export function buildIndustryGuardrails(profile: UserBusinessProfile | undefined, isEn: boolean): string {
    if (!profile?.productService?.trim()) {
        return isEn
            ? 'INDUSTRY RULE: Use only the seller company profile above. Never assume or invent a different industry for your company.'
            : 'REGRA DE SETOR: Use apenas o perfil da empresa vendedora acima. Nunca assuma ou invente outro setor para a sua empresa.';
    }
    const offering = expandProductService(profile.productService, isEn);
    return isEn
        ? `INDUSTRY RULE (MANDATORY):
- You represent "${profile.companyName}" which sells: "${offering}".
- ALL recommendations, gaps, scripts, and messages must pitch THIS offering only.
- NEVER mention real estate, property, "imobiliária", insurance, accounting, or unrelated industries unless "${offering}" is explicitly in that industry.
- Message templates (WhatsApp, email, LinkedIn) must sound like "${profile.companyName}", not a generic or wrong-industry vendor.`
        : `REGRA DE SETOR (OBRIGATÓRIA):
- Você representa "${profile.companyName}" que vende: "${offering}".
- TODAS as recomendações, lacunas, scripts e mensagens devem vender ESTA oferta apenas.
- NUNCA mencione imobiliária, imóveis, seguros, contabilidade ou setores não relacionados, a menos que "${offering}" seja explicitamente desse setor.
- Templates de mensagem (WhatsApp, email, LinkedIn) devem soar como "${profile.companyName}", não como um fornecedor genérico ou de setor errado.`;
}

export function buildSellerServicesBlock(profile: UserBusinessProfile | undefined, isEn: boolean): string {
    if (!profile?.companyName?.trim() && !profile?.productService?.trim()) return '';
    const offering = profile?.productService ? expandProductService(profile.productService, isEn) : '';
    const lines = isEn
        ? [
            'SELLER COMPANY PROFILE (Minha Empresa — use this as the ONLY source for your industry and pitch):',
            profile?.companyName ? `- Company: ${profile.companyName}` : '',
            offering ? `- Services / offering: ${offering}` : '',
            profile?.targetAudience ? `- Target audience: ${profile.targetAudience}` : '',
            profile?.mainBenefit ? `- Main benefit: ${profile.mainBenefit}` : '',
            profile?.city || profile?.state
                ? `- Seller location: ${[profile.city, profile.state].filter(Boolean).join(', ')}`
                : '',
            profile?.serviceModel ? `- Service model: ${profile.serviceModel}` : '',
        ]
        : [
            'PERFIL DA EMPRESA VENDEDORA (Minha Empresa — use APENAS isto como fonte do seu setor e pitch):',
            profile?.companyName ? `- Empresa: ${profile.companyName}` : '',
            offering ? `- Serviços / oferta: ${offering}` : '',
            profile?.targetAudience ? `- Público-alvo: ${profile.targetAudience}` : '',
            profile?.mainBenefit ? `- Principal benefício: ${profile.mainBenefit}` : '',
            profile?.city || profile?.state
                ? `- Localização do vendedor: ${[profile.city, profile.state].filter(Boolean).join(', ')}`
                : '',
            profile?.serviceModel ? `- Modelo de atendimento: ${profile.serviceModel}` : '',
        ];
    return lines.filter(Boolean).join('\n');
}

export function buildCompanyContext(finalProfile: UserBusinessProfile | undefined, isEn: boolean): string {
    const fallbackRole = isEn
        ? 'You are a Senior B2B Strategic Consultant specialized in commercial prospecting.'
        : 'Você é um Consultor Estratégico B2B Sênior especializado em prospecção comercial.';
    if (!finalProfile) return fallbackRole;
    const expandedProduct = expandProductService(finalProfile.productService, isEn);
    const extraContext = [
        finalProfile.legalName ? `${isEn ? 'Legal name' : 'Razão social'}: "${finalProfile.legalName}".` : '',
        finalProfile.tradeName ? `${isEn ? 'Trade name' : 'Nome fantasia'}: "${finalProfile.tradeName}".` : '',
        finalProfile.cnpj ? `CNPJ: "${finalProfile.cnpj}".` : '',
        finalProfile.primaryCnaeCode ? `${isEn ? 'Main CNAE' : 'CNAE principal'}: "${finalProfile.primaryCnaeCode}${finalProfile.primaryCnaeDescription ? ` - ${finalProfile.primaryCnaeDescription}` : ''}".` : '',
        finalProfile.companySize ? `${isEn ? 'Company size' : 'Porte'}: "${finalProfile.companySize}".` : '',
        finalProfile.foundingDate ? `${isEn ? 'Founded at' : 'Data de abertura'}: "${finalProfile.foundingDate}".` : '',
        finalProfile.city || finalProfile.state ? `${isEn ? 'Base location' : 'Base geográfica'}: "${[finalProfile.city, finalProfile.state].filter(Boolean).join(', ')}".` : '',
        finalProfile.serviceModel ? `${isEn ? 'Service model' : 'Modelo de atendimento'}: "${finalProfile.serviceModel}".` : '',
        finalProfile.averageTicket != null ? `${isEn ? 'Average ticket' : 'Ticket médio'}: "R$ ${finalProfile.averageTicket}".` : '',
        finalProfile.operationRadiusKm != null ? `${isEn ? 'Operation radius' : 'Raio de operação'}: "${finalProfile.operationRadiusKm} km".` : '',
        finalProfile.knownCompetitors ? `${isEn ? 'Known competitors' : 'Concorrentes conhecidos'}: "${finalProfile.knownCompetitors}".` : '',
    ].filter(Boolean).join('\n');
    return isEn
        ? `You are a Senior B2B Commercial Consultant for "${finalProfile.companyName}".
"${finalProfile.companyName}" offers: "${expandedProduct}".
Target audience: "${finalProfile.targetAudience}".
Main competitive advantage: "${finalProfile.mainBenefit}".
${extraContext ? `\n${extraContext}` : ''}

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
5. Every field must reinforce the match between this lead's needs and YOUR offering.`
        : `Você é um Consultor Comercial B2B Sênior trabalhando para "${finalProfile.companyName}".
"${finalProfile.companyName}" oferece: "${expandedProduct}".
Público-alvo: "${finalProfile.targetAudience}".
Principal diferencial: "${finalProfile.mainBenefit}".
    ${extraContext ? `\n${extraContext}` : ''}

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
5. Cada campo deve reforçar o match entre as necessidades do lead e a SUA oferta.`;
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

export interface BuildLeadPromptInput {
    business: BusinessData;
    isEn: boolean;
    companyContext: string;
    taskDescription: string;
    sellerProfile?: UserBusinessProfile;
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

export interface BuildLeadReportSectionPromptInput extends BuildLeadPromptInput {
    sectionTitle: string;
    sectionInstruction: string;
    coreAnalysisJson: string;
}

function buildLeadContextBlock(opts: BuildLeadPromptInput): string {
    const { isEn, isBusinessPlan } = opts;
    const L = LEAD_REQUIREMENTS_LABELS[isEn ? 'en' : 'pt'];
    const D = LEAD_DATA_LABELS[isEn ? 'en' : 'pt'];
    const leadNicheRaw = opts.business.primaryType || opts.business.types?.[0] || '';
    const leadNicheLabel = formatLeadNiche(opts.business.primaryType, opts.business.types);
    const leadLocation = extractLeadLocation(opts.address);
    const typeVal = leadNicheLabel || leadNicheRaw || D.notSpecified;
    const webBlock = getWebContextBlock(opts.webContext, isBusinessPlan, isEn);
    const sellerBlock = buildSellerServicesBlock(opts.sellerProfile, isEn);
    const industryGuardrails = buildIndustryGuardrails(opts.sellerProfile, isEn);
    const gapsRequirement = buildGapsRequirement(opts.sellerProfile, isEn);
    const nicheHeader = isEn ? 'LEAD NICHE & LOCATION:' : 'NICHO E LOCALIZAÇÃO DO LEAD:';
    const nicheLines = [
        leadNicheRaw ? `- ${isEn ? 'Niche code' : 'Código do nicho'}: ${leadNicheRaw}` : '',
        leadNicheLabel ? `- ${isEn ? 'Niche label' : 'Nicho'}: ${leadNicheLabel}` : '',
        leadLocation ? `- ${isEn ? 'Location' : 'Localização'}: ${leadLocation}` : '',
    ].filter(Boolean).join('\n');

    return `${opts.companyContext}

${sellerBlock ? `${sellerBlock}\n` : ''}${industryGuardrails}

${opts.taskDescription}

${nicheHeader}
${nicheLines || `- ${isEn ? 'Not specified' : 'Não especificado'}`}

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
1. ${gapsRequirement}
2. ${L.painPoints}
3. ${L.socialMedia}
4. ${L.firstContact}
5. ${L.recency}
6. ${L.timing}
${getPoint6Requirement(isBusinessPlan, isEn)}
7. ${L.whatsapp}`;
}

export function buildLeadAnalysisPrompt(opts: BuildLeadPromptInput): string {
    const { isEn, isBusinessPlan } = opts;
    const J = JSON_SCHEMA_LABELS[isEn ? 'en' : 'pt'];
    const thirdGapLabel = isEn ? J.gap3 : J.gap3;

    return `${buildLeadContextBlock(opts)}

${J.intro}
{
  "score": <number 1-100>,
  "scoreLabel": "<${J.scoreLabel}>",
  "summary": "<${J.summary}>",
  "strengths": ["<${J.strength}>", "<${J.strength2}>", "<${J.strength3}>"],
  "weaknesses": ["<${J.weakness}>", "<${J.weakness2}>", "<${J.weakness3}>"],
  "painPoints": ["<${J.painPoint}>", "<${J.painPoint2}>", "<${J.painPoint3}>", "<${J.painPoint4}>"],
    "gaps": ["<${J.gap}>", "<${J.gap2}>", "<${thirdGapLabel}>", "<${J.gap4}>"] ,
  "approach": "<${J.approach}>",
  "contactStrategy": "<${J.contactStrategy}>",
  "firstContactMessage": "<${J.firstContact}>",
  "suggestedWhatsAppMessage": "<${J.whatsapp}>",
  "reviewAnalysis": "<${J.reviewAnalysis}>",
  "reviewTrend": "<${J.reviewTrend}>",
  "suggestedContactTime": "<${J.contactTime}>",
  "socialMedia": { "instagram": "<${J.instagram}>", "facebook": "<${J.facebook}>", "linkedin": "<${J.linkedin}>" },
  "closeProbability": <${isEn ? 'number 0-100, predicted chance of closing THIS specific lead based on your conversion history and lead profile. 0=impossible, 100=guaranteed' : 'número 0-100, chance prevista de fechar ESTE lead baseado no histórico de conversão e perfil do lead. 0=impossível, 100=garantido'}>,
  "estimatedDealValue": <${isEn ? 'number in BRL, estimated deal size based on business size, type, and your avg ticket' : 'número em BRL, valor estimado do deal baseado no tamanho do negócio, tipo e seu ticket médio'}>,
  "bestContactWindow": "<${isEn ? 'Specific day and time window, e.g. Tuesday 10am-12pm, with rationale' : 'Dia e horário específico, ex: Terça 10h-12h, com justificativa'}>",
  "quickActions": ["<${isEn ? 'actionable next step 1 for the sales rep' : 'próxima ação 1 para o vendedor'}>", "<${isEn ? 'action 2' : 'ação 2'}>", "<${isEn ? 'action 3' : 'ação 3'}>"],
  "keyMetrics": [
    { "label": "<${isEn ? 'metric name e.g. Close probability' : 'nome da métrica ex. Probabilidade de fechamento'}>", "value": "<${isEn ? 'display value' : 'valor exibido'}>", "hint": "<${isEn ? 'short rationale' : 'justificativa curta'}>" }
  ],
  "messageVariants": {
    "whatsapp": { "short": "<${isEn ? '1-2 sentence WhatsApp opener pitching YOUR service to this lead niche' : 'abertura WhatsApp 1-2 frases vendendo SEU serviço para este nicho'}>", "medium": "<${isEn ? '2 short paragraphs WhatsApp message' : '2 parágrafos curtos WhatsApp'}>" },
    "email": { "short": "<${isEn ? 'brief professional email subject + body opener' : 'assunto + abertura curta de email profissional'}>", "medium": "<${isEn ? 'full short email (3 paragraphs max) pitching YOUR service' : 'email curto completo (máx 3 parágrafos) vendendo SEU serviço'}>" },
    "linkedin": { "short": "<${isEn ? 'LinkedIn connection note (300 chars max)' : 'nota de conexão LinkedIn (máx 300 caracteres)'}>", "medium": "<${isEn ? 'LinkedIn InMail-style message (2 paragraphs)' : 'mensagem estilo InMail (2 parágrafos)'}>" }
  }
${getExtendedJsonSchemaBlock(isBusinessPlan, isEn)}
}`;
}

export function buildLeadReportSectionPrompt(opts: BuildLeadReportSectionPromptInput): string {
        return `${buildLeadContextBlock(opts)}

CORE ANALYSIS JSON:
${opts.coreAnalysisJson}

TASK:
Write only the Markdown body for the section "${opts.sectionTitle}".

SECTION REQUIREMENTS:
- ${opts.sectionInstruction}
- Use concrete evidence from the lead data, reviews, web context, RF data, and core analysis.
- Keep the writing dense and specific. Avoid generic filler.
- Do not output JSON, code fences, or explanations outside the section body.
- Do not repeat the section title in the body.`;
}
