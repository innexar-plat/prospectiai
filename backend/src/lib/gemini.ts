import { generateCompletionForRole } from '@/lib/ai';
import { getWebContextForRole } from '@/lib/web-search/resolve';
import { scrapeWebsite, formatWebsiteMetadataForPrompt } from '@/lib/website-scraper';
import { prisma } from './prisma';

export interface LeadAnalysis {
    score: number;
    scoreLabel: string;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    painPoints: string[];
    gaps: string[];
    approach: string;
    contactStrategy: string;
    firstContactMessage: string;
    suggestedWhatsAppMessage: string;
    reviewAnalysis?: string;
    reviewTrend?: string;
    suggestedContactTime?: string;
    socialMedia?: {
        instagram?: string;
        facebook?: string;
        linkedin?: string;
    };
    fullReport: string;
    /** Deep analysis fields — only populated for BUSINESS/SCALE plans */
    reclameAquiAnalysis?: string;
    jusBrasilAnalysis?: string;
    cnpjAnalysis?: string;
    /** Lead Intelligence Engine — AI-predicted fields */
    closeProbability?: number;
    estimatedDealValue?: number;
    bestContactWindow?: string;
}

export interface UserBusinessProfile {
    companyName: string;
    productService: string;
    targetAudience: string;
    mainBenefit: string;
}

export interface BusinessData {
    placeId: string;
    name: string;
    formattedAddress?: string;
    address?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    phone?: string;
    websiteUri?: string;
    website?: string;
    rating?: number;
    userRatingCount?: number;
    reviewCount?: number;
    types?: string[];
    businessStatus?: string;
    primaryType?: string;
    hasOpeningHours?: boolean;
    currentOpeningHours?: {
        openNow?: boolean;
        weekdayDescriptions?: string[];
    };
    reviews?: Array<{
        rating: number;
        text: { text: string };
        authorAttribution: { displayName: string };
        relativePublishTimeDescription: string;
    }>;
    // RF (Receita Federal) enrichment data
    cnpj?: string;
    companyLegalName?: string;
    companyTradeName?: string;
    companyPorte?: string;
    companyCapitalSocial?: number;
    companyMainCnae?: string;
    cnpjStatus?: string;
    cnpjOpenedAt?: string;
    rfEmail?: string;
    matchConfidence?: number;
    matchMethod?: string;
}

export interface AnalyzeLeadContext {
    workspaceId: string;
    userId?: string;
}

async function resolveFinalProfile(userProfile?: UserBusinessProfile, userId?: string): Promise<UserBusinessProfile | undefined> {
    let finalProfile = userProfile;
    if (!finalProfile && userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user && user.companyName) {
            finalProfile = {
                companyName: user.companyName,
                productService: user.productService || '',
                targetAudience: user.targetAudience || '',
                mainBenefit: user.mainBenefit || ''
            };
        }
    }
    if (finalProfile && !finalProfile.companyName?.trim() && !finalProfile.productService?.trim()) {
        return undefined;
    }
    return finalProfile;
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

function buildTaskDescription(isEn: boolean): string {
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

function expandProductService(raw: string): string {
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

function buildCompanyContext(finalProfile: UserBusinessProfile | undefined, isEn: boolean): string {
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

function getAnalysisErrorMessage(msg: string): string {
    if (msg.includes('no ai config') || msg.includes('not set')) return 'IA não configurada. Configure um provedor em Admin ou GEMINI_API_KEY no servidor.';
    if (msg.includes('403') || msg.includes('restriction') || msg.includes('permission')) return 'API Key com restrição (IP ou domínio). Verifique no painel do provedor.';
    if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit')) return 'Limite de uso da API atingido. Tente novamente em alguns minutos.';
    if (msg.includes('401') || msg.includes('invalid') || msg.includes('api key')) return 'Chave da API inválida. Verifique a configuração no admin.';
    if (msg.includes('500') || msg.includes('unavailable')) return 'Serviço de IA temporariamente indisponível. Tente novamente em instantes.';
    if (msg.includes('404') || msg.includes('no longer available') || msg.includes('newer model')) return 'Modelo em uso não está mais disponível. Atualize o modelo na configuração de IA.';
    return 'Não foi possível gerar análise detalhada no momento.';
}

function buildFallbackAnalysis(errorMessage: string): LeadAnalysis {
    return {
        score: 0,
        scoreLabel: 'Indisponível',
        summary: errorMessage,
        strengths: [],
        weaknesses: [],
        painPoints: [],
        gaps: [],
        approach: 'Verifique a configuração de IA no painel admin.',
        contactStrategy: '',
        firstContactMessage: '',
        suggestedWhatsAppMessage: '',
        fullReport: `# Erro\n\n${errorMessage}`,
    };
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

const LEAD_DATA_LABELS = {
    en: {
        section: 'LEAD DATA:',
        name: 'Business Name',
        type: 'Type/Category',
        address: 'Address',
        phone: 'Phone',
        website: 'Website',
        rating: 'Google Rating',
        reviews: 'Total Reviews',
        status: 'Business Status',
        reviewsSection: 'RECENT CUSTOMER REVIEWS:',
        reviewSignals: 'NEGATIVE REVIEW SIGNALS:',
        openingHours: 'OPENING HOURS (for contact timing):',
        notSpecified: 'Not specified',
        notAvailable: 'Not available',
        noPhone: 'No phone listed',
        noWebsite: 'NO WEBSITE (critical gap)',
        noRating: 'No rating',
    },
    pt: {
        section: 'DADOS DO LEAD:',
        name: 'Nome do Negócio',
        type: 'Tipo/Categoria',
        address: 'Endereço',
        phone: 'Telefone',
        website: 'Site',
        rating: 'Avaliação Google',
        reviews: 'Total de Avaliações',
        status: 'Status do Negócio',
        reviewsSection: 'AVALIAÇÕES RECENTES DE CLIENTES:',
        reviewSignals: 'SINAIS DE REVIEWS NEGATIVAS:',
        openingHours: 'HORÁRIOS DE FUNCIONAMENTO (para timing de contato):',
        notSpecified: 'Não especificado',
        notAvailable: 'Não disponível',
        noPhone: 'Sem telefone cadastrado',
        noWebsite: 'SEM WEBSITE (lacuna crítica)',
        noRating: 'Sem avaliação',
    }
} as const;

const LEAD_REQUIREMENTS_LABELS = {
    en: {
        header: 'ANALYSIS REQUIREMENTS (be extremely specific, not generic):',
        gaps: 'GAPS & OPPORTUNITIES: What is this business missing that YOUR company can solve? Focus on gaps relevant to YOUR product/service. Only mention digital gaps (website, SEO) if that is what you sell. If you sell real estate, look for space/property needs. If you sell insurance, look for risk gaps.',
        painPoints: 'CUSTOMER PAIN POINTS: Based on reviews and business type, what frustrations do their customers likely face? What operational challenges does this business have?',
        socialMedia: 'SOCIAL MEDIA STRATEGY: Proactively analyze scenarios for Instagram, LinkedIn, and Facebook based on their niche. Suggest what kind of content they SHOULD be posting to get more clients. Be highly sincere about what they can improve.',
        firstContact: 'FIRST CONTACT MESSAGE: Write a professional, personalized opening message for the FIRST contact (WhatsApp/email). It should reference something specific about this business (their rating, a review pattern, missing digital element). Max 3 short paragraphs. No generic templates.',
        recency: 'REVIEW RECENCY: Analyze the time of reviews. If reviews are mostly from years ago, flag this as a "stagnant reputation". If recent, analyze the trend.',
        timing: 'BEST CONTACT TIME: Recommend the best contact window based on opening hours and likely availability from review patterns.',
        whatsapp: 'WHATSAPP MESSAGE: A shorter, more casual version for WhatsApp (max 2 short paragraphs, conversational tone, gets to the point fast).'
    },
    pt: {
        header: 'REQUISITOS DA ANÁLISE (seja extremamente específico, não genérico):',
        gaps: 'LACUNAS & OPORTUNIDADES: O que este negócio está faltando que A SUA empresa pode resolver? Foque em lacunas relevantes ao SEU produto/serviço. Só mencione lacunas digitais (website, SEO) se for isso que você vende. Se você é imobiliária, busque necessidades de espaço/imóvel. Se vende seguros, busque lacunas de risco.',
        painPoints: 'DORES DO CLIENTE: Com base nas avaliações e tipo de negócio, quais frustrações os clientes provavelmente enfrentam? Quais desafios operacionais este negócio tem?',
        socialMedia: 'ESTRATÉGIA DE REDES SOCIAIS: Analise proativamente cenários para Instagram, LinkedIn e Facebook com base no nicho deles. Sugira que tipo de conteúdo eles DEVERIAM postar para atrair mais clientes. Seja altamente sincero sobre o que eles podem melhorar.',
        firstContact: 'MENSAGEM DE PRIMEIRO CONTATO: Escreva uma mensagem de abertura profissional e personalizada para o PRIMEIRO contato (WhatsApp/email). Deve referenciar algo específico deste negócio (avaliação, padrão nas reviews, elemento digital faltando). Máximo 3 parágrafos curtos. Sem templates genéricos.',
        recency: 'RECÊNCIA DE REVIEWS: Analise o tempo das avaliações. Se forem majoritariamente de anos atrás, aponte isso como "reputação estagnada". Se recentes, analise a tendência.',
        timing: 'MELHOR HORÁRIO DE CONTATO: Recomende a melhor janela de abordagem com base nos horários de funcionamento e provável disponibilidade pelo padrão de reviews.',
        whatsapp: 'MENSAGEM WHATSAPP: Uma versão mais curta e casual para WhatsApp (máximo 2 parágrafos curtos, tom conversacional, vai direto ao ponto).'
    }
} as const;

const JSON_SCHEMA_LABELS = {
    en: {
        intro: 'CRITICAL: Respond ONLY with valid JSON, no markdown, no code blocks. Values must be in ENGLISH:',
        scoreLabel: 'Cold|Warm|Hot|Very Hot',
        summary: 'Provide a dense executive summary specific to this business, without strict length constraints.',
        strength: 'specific strength 1',
        strength2: 'strength 2',
        strength3: 'strength 3',
        weakness: 'specific weakness 1',
        weakness2: 'weakness 2',
        weakness3: 'weakness 3',
        painPoint: 'specific customer pain point 1',
        painPoint2: 'pain point 2',
        painPoint3: 'pain point 3',
        painPoint4: 'operational challenge 4',
        gap: 'digital gap 1: e.g. No website',
        gap2: 'gap 2',
        gap3: 'gap 3',
        gap4: 'gap 4',
        approach: 'Specific approach strategy: what angle to use, what pain to address first, timing recommendations',
        contactStrategy: 'Recommended channels (WhatsApp, LinkedIn, phone, email), best time to contact, who likely to answer, what to say first call',
        firstContact: 'Professional personalized opening message for first contact (email/WhatsApp), max 3 short paragraphs, specific to this business',
        whatsapp: 'Shorter casual WhatsApp version, 2 paragraphs max, conversational, direct',
        reviewAnalysis: 'Detailed analysis of the rating trend and recency',
        reviewTrend: 'Trend summary such as Growing|Stable|Declining with evidence from review recency',
        contactTime: 'Best contact time window with rationale from opening hours and customer flow',
        instagram: 'CRITICAL: ONLY return real URLs. NEVER invent or hallucinate. If unsure, return Not found',
        facebook: 'CRITICAL: NEVER hallucinate URLs. If unsure, return Not found',
        linkedin: 'CRITICAL: NEVER hallucinate URLs. If unsure, return Not found',
        fullReport: 'EXTREMELY DETAILED and extensive report in Markdown (MINIMUM 2000 words). Each section must have 3-5 substantial paragraphs with concrete data, examples, and actionable recommendations. DO NOT be brief in any section. Required sections: ## Executive Summary (contextualize the lead, their market, and the opportunity for OUR company) | ## Business Analysis (size, maturity, differentiators, positioning) | ## Market & Competition Analysis (regional competitive landscape, sector trends) | ## Opportunities for Our Offering (how OUR product/service solves real pain points of this lead) | ## Risks and Vulnerabilities (aspects that could hinder the deal) | ## Complete Action Plan (detailed step-by-step with timeline, owners, and success metrics).',
    },
    pt: {
        intro: 'CRÍTICO: Responda APENAS com JSON válido, sem markdown, sem blocos de código. Valores devem estar em PORTUGUÊS:',
        scoreLabel: 'Frio|Morno|Quente|Muito Quente',
        summary: 'Forneça um denso resumo executivo específico para este negócio, sem limite estrito de tamanho.',
        strength: 'força específica 1',
        strength2: 'força 2',
        strength3: 'força 3',
        breakdown: 'Análise detalhada',
        weakness: 'fraqueza específica 1',
        weakness2: 'fraqueza 2',
        weakness3: 'fraqueza 3',
        painPoint: 'dor específica do cliente 1',
        painPoint2: 'dor 2',
        painPoint3: 'dor 3',
        painPoint4: 'desafio operacional 4',
        gap: 'lacuna digital 1: ex. Sem website',
        gap2: 'lacuna 2',
        gap3: 'lacuna 3',
        gap4: 'lacuna 4',
        approach: 'Estratégia de abordagem específica: qual ângulo usar, qual dor abordar primeiro, recomendações de timing',
        contactStrategy: 'Canais recomendados (WhatsApp, LinkedIn, telefone, email), melhor horário para contato, quem provavelmente atende, o que dizer na primeira ligação',
        firstContact: 'Mensagem de abertura profissional e personalizada para primeiro contato (email/WhatsApp), máximo 3 parágrafos curtos, específica para este negócio',
        whatsapp: 'Versão mais curta e casual para WhatsApp, 2 parágrafos no máximo, conversacional, direta',
        reviewAnalysis: 'Análise detalhada da tendência e recência das avaliações',
        reviewTrend: 'Resumo da tendência: Crescente|Estável|Decrescente com evidências da recência das avaliações',
        contactTime: 'Melhor janela de contato com justificativa usando horários de funcionamento e fluxo provável',
        instagram: 'CRÍTICO: Retorne APENAS URLs reais. NUNCA invente ou alucine. Se não tiver certeza absoluta, retorne exatamente Não encontrado',
        facebook: 'CRÍTICO: NUNCA alucine URLs. Se não tiver certeza, retorne exatamente Não encontrado',
        linkedin: 'CRÍTICO: NUNCA alucine URLs. Se não tiver certeza, retorne exatamente Não encontrado',
        fullReport: 'Relatório EXTREMAMENTE DETALHADO e extenso em Markdown (MÍNIMO 2000 palavras). Cada seção deve ter 3-5 parágrafos substanciais com dados concretos, exemplos e recomendações acionáveis. NÃO seja breve em nenhuma seção. Seções obrigatórias: ## Resumo Executivo (contextualizar o lead, seu mercado, e a oportunidade para NOSSA empresa) | ## Análise do Negócio (porte, maturidade, diferenciais, posicionamento) | ## Análise de Mercado e Concorrência (cenário competitivo regional, tendências do setor) | ## Oportunidades para Nossa Oferta (como NOSSO produto/serviço resolve dores reais deste lead) | ## Riscos e Vulnerabilidades (aspectos que podem dificultar o negócio) | ## Plano de Ação Completo (passo a passo detalhado com timeline, responsáveis e métricas de sucesso).',
    }
} as const;

function buildLeadAnalysisPrompt(opts: BuildLeadPromptInput): string {
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

function buildRfDataBlock(business: BusinessData, isEn: boolean): string {
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

function buildReviewSignalsText(
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

function buildOpeningHoursText(hours: BusinessData['currentOpeningHours'], isEn: boolean): string {
    const weekday = hours?.weekdayDescriptions?.slice(0, 7) ?? [];
    if (!weekday.length) {
        return isEn ? 'Opening hours not available.' : 'Horários de funcionamento indisponíveis.';
    }
    const openNow = typeof hours?.openNow === 'boolean'
        ? (isEn ? (hours.openNow ? 'Open now' : 'Closed now') : (hours.openNow ? 'Aberto agora' : 'Fechado agora'))
        : (isEn ? 'Open state unknown' : 'Status de abertura desconhecido');
    return `${openNow}\n${weekday.map((d) => `- ${d}`).join('\n')}`;
}

async function prepareLeadAnalysisPrompt(
    business: BusinessData,
    userProfile: UserBusinessProfile | undefined,
    userId: string | undefined,
    isEn: boolean,
    isBusinessPlan: boolean,
    context: AnalyzeLeadContext | undefined,
    onProgress?: AnalyzeProgressCallback,
): Promise<{ prompt: string; finalProfile: UserBusinessProfile | undefined }> {
    const finalProfile = await resolveFinalProfile(userProfile, userId);
    const address = business.formattedAddress || business.address || '';
    const cityPart = address ? address.split(',').pop()?.trim() : '';
    const webQueries = [
        business.name,
        `Reclame Aqui ${business.name}`,
        `CNPJ ${business.name} ${cityPart}`.trim(),
        `JusBrasil ${business.name}`,
        business.primaryType || business.types?.[0] || '',
        `"${business.name}" site:instagram.com`,
        `"${business.name}" site:facebook.com`,
        `"${business.name}" site:linkedin.com`,
    ].filter(Boolean);
    onProgress?.('web_search', isEn ? 'Searching web intelligence (Reclame Aqui, CNPJ, JusBrasil)...' : 'Buscando inteligência web (Reclame Aqui, CNPJ, JusBrasil)...');
    const webContext = await getWebContextForRole('lead_analysis', webQueries, context ? { workspaceId: context.workspaceId, userId: context.userId } : undefined);
    const phone = business.nationalPhoneNumber || business.internationalPhoneNumber || business.phone || '';
    const website = business.websiteUri || business.website || '';
    const reviewCount = business.userRatingCount || business.reviewCount || 0;
    const noReviewsLabel = isEn ? 'No recent reviews available' : 'Nenhuma avaliação recente disponível';
    const reviewsText = business.reviews && business.reviews.length > 0
        ? business.reviews.slice(0, 5).map(r => `[${r.rating}/5 - ${r.authorAttribution?.displayName || 'Client'}]: "${r.text?.text?.slice(0, 200)}"`).join('\n')
        : noReviewsLabel;
    const reviewSignalsText = buildReviewSignalsText(business.reviews, isEn);
    const openingHoursText = buildOpeningHoursText(business.currentOpeningHours, isEn);
    const companyContext = buildCompanyContext(finalProfile, isEn);
    const taskDescription = buildTaskDescription(isEn);

    // Build conversion context from real user data
    onProgress?.('conversion', isEn ? 'Analyzing your conversion history...' : 'Analisando seu histórico de conversão...');
    let conversionContext = '';
    try {
        const { getConversionStats, buildConversionContext: buildConvCtx } = await import('@/lib/lead-intelligence');
        const stats = await getConversionStats(userId || '', context?.workspaceId);
        conversionContext = buildConvCtx(stats, isEn);
    } catch {
        conversionContext = isEn ? 'Conversion data: Not available.' : 'Dados de conversão: Indisponíveis.';
    }

    onProgress?.('prompt', isEn ? 'Building strategic prompt...' : 'Construindo prompt estratégico...');
    const rfDataBlock = buildRfDataBlock(business, isEn);

    // F6: Scrape lead website for metadata (emails, social, technologies)
    let websiteScrapingBlock = '';
    if (website) {
        try {
            const meta = await scrapeWebsite(website);
            websiteScrapingBlock = formatWebsiteMetadataForPrompt(meta, isEn);
        } catch {
            // Silently skip if scraping fails
        }
    }

    const prompt = buildLeadAnalysisPrompt({
        business,
        isEn,
        companyContext,
        taskDescription,
        address,
        phone,
        website,
        reviewCount,
        reviewsText,
        reviewSignalsText,
        openingHoursText,
        webContext,
        isBusinessPlan,
        conversionContext,
        rfDataBlock,
        websiteScrapingBlock,
    });
    return { prompt, finalProfile };
}

export type AnalyzeProgressStep =
    | 'profile'       // Resolving user profile
    | 'web_search'    // Web context (Reclame Aqui, CNPJ, JusBrasil)
    | 'conversion'    // Building conversion context
    | 'prompt'        // Building prompt
    | 'ai_call'       // Calling AI provider
    | 'parsing'       // Parsing response
    | 'saving'        // Saving to DB
    | 'done';         // Complete

export type AnalyzeProgressCallback = (step: AnalyzeProgressStep, detail?: string) => void;

export async function analyzeLead(
    business: BusinessData,
    userProfile?: UserBusinessProfile,
    locale: string = 'pt',
    userId?: string,
    isBusinessPlan: boolean = false,
    context?: AnalyzeLeadContext,
    onProgress?: AnalyzeProgressCallback
): Promise<{ analysis: LeadAnalysis; usage?: { inputTokens: number; outputTokens: number }; provider?: string }> {
    const isEn = locale === 'en';
    onProgress?.('profile', isEn ? 'Loading business profile...' : 'Carregando perfil do negócio...');
    const { prompt, finalProfile } = await prepareLeadAnalysisPrompt(business, userProfile, userId, isEn, isBusinessPlan, context, onProgress);

    try {
        const { resolveAiForRole } = await import('@/lib/ai');
        const { config } = await resolveAiForRole('lead_analysis');
        onProgress?.('ai_call', isEn ? `Analyzing with ${config.provider}...` : `Analisando com ${config.provider}...`);
        const result = await generateCompletionForRole('lead_analysis', { prompt, jsonMode: true, maxTokens: 16384 });

        onProgress?.('parsing', isEn ? 'Processing AI response...' : 'Processando resposta da IA...');
        const firstBrace = result.text.indexOf('{');
        const lastBrace = result.text.lastIndexOf('}');
        const jsonExtracted = firstBrace !== -1 && lastBrace > firstBrace ? result.text.slice(firstBrace, lastBrace + 1) : null;
        let cleaned = jsonExtracted ?? result.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        // Fix control characters ONLY inside JSON string values (LLMs emit raw newlines/tabs in strings).
        // We match quoted strings and sanitize only their content, preserving structural whitespace.
        cleaned = cleaned.replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
            match.replace(/[\x00-\x1F\x7F]/g, (ch) => {
                if (ch === '\n') return '\\n';
                if (ch === '\r') return '\\r';
                if (ch === '\t') return '\\t';
                return '';
            })
        );
        const analysis = JSON.parse(cleaned) as LeadAnalysis;

        onProgress?.('saving', isEn ? 'Saving analysis...' : 'Salvando análise...');
        saveAnalysisToDb(business.placeId, analysis, finalProfile, userId, context?.workspaceId).catch(err =>
            import('@/lib/logger').then(({ logger }) => logger.error('Save analysis error', { error: err instanceof Error ? err.message : 'Unknown' }))
        );

        onProgress?.('done', isEn ? 'Analysis complete!' : 'Análise concluída!');
        return { analysis, usage: result.usage, provider: config.provider };
    } catch (error: unknown) {
        const { logger } = await import('@/lib/logger');
        logger.error('AI Analysis Error', { error: error instanceof Error ? error.message : 'Unknown' });
        const msg = ((error as { message?: string })?.message ?? '').toLowerCase();
        return { analysis: buildFallbackAnalysis(getAnalysisErrorMessage(msg)) };
    }
}

async function ensureGuestUserIfNeeded(userId: string | undefined, profile?: UserBusinessProfile): Promise<string> {
    const finalUserId = userId || 'cl_guest_default';
    if (!userId) {
        await prisma.user.upsert({
            where: { id: finalUserId },
            update: {
                companyName: profile?.companyName,
                productService: profile?.productService,
                targetAudience: profile?.targetAudience,
                mainBenefit: profile?.mainBenefit,
            },
            create: {
                id: finalUserId,
                name: 'Guest User',
                companyName: profile?.companyName,
                productService: profile?.productService,
                targetAudience: profile?.targetAudience,
                mainBenefit: profile?.mainBenefit,
            }
        });
    }
    return finalUserId;
}

async function sendAnalysisReadyNotification(userId: string, placeId: string, workspaceId: string | undefined): Promise<void> {
    const { createNotification } = await import('@/lib/notification-service');
    createNotification({
        userId,
        workspaceId: workspaceId ?? null,
        title: 'Sua análise está pronta',
        message: 'A análise do lead foi concluída. Clique para ver.',
        type: 'INFO',
        link: `/dashboard/lead/${placeId}`,
        sendEmailIfPreferred: true,
        emailSubject: 'Sua análise está pronta',
        channel: 'lead_analysis_ready',
    }).catch((err) =>
        import('@/lib/logger').then(({ logger }) => logger.error('Create notification after analysis', { error: err instanceof Error ? err.message : 'Unknown' }))
    );
}

async function saveAnalysisToDb(placeId: string, analysis: LeadAnalysis, profile?: UserBusinessProfile, userId?: string, workspaceId?: string) {
    try {
        const lead = await prisma.lead.findUnique({ where: { placeId } });
        if (!lead) return;
        const finalUserId = await ensureGuestUserIfNeeded(userId, profile);
        await prisma.leadAnalysis.create({
            data: {
                userId: finalUserId,
                leadId: lead.id,
                score: analysis.score,
                scoreLabel: analysis.scoreLabel,
                summary: analysis.summary,
                strengths: analysis.strengths,
                weaknesses: analysis.weaknesses,
                painPoints: analysis.painPoints,
                gaps: analysis.gaps,
                status: 'NEW',
                approach: analysis.approach,
                contactStrategy: analysis.contactStrategy,
                firstContactMessage: analysis.firstContactMessage,
                suggestedWhatsAppMessage: analysis.suggestedWhatsAppMessage,
                fullReport: analysis.fullReport,
                socialInstagram: analysis.socialMedia?.instagram,
                socialFacebook: analysis.socialMedia?.facebook,
                socialLinkedin: analysis.socialMedia?.linkedin,
                closeProbability: typeof analysis.closeProbability === 'number' ? analysis.closeProbability : undefined,
                estimatedDealValue: typeof analysis.estimatedDealValue === 'number' ? analysis.estimatedDealValue : undefined,
                bestContactWindow: analysis.bestContactWindow || undefined,
                reclameAquiAnalysis: analysis.reclameAquiAnalysis || undefined,
                jusBrasilAnalysis: analysis.jusBrasilAnalysis || undefined,
                cnpjAnalysis: analysis.cnpjAnalysis || undefined,
                reviewTrend: analysis.reviewTrend || undefined,
                suggestedContactTime: analysis.suggestedContactTime || undefined,
            }
        });
        if (userId && userId !== 'cl_guest_default') {
            await sendAnalysisReadyNotification(userId, placeId, workspaceId);
            // Record AI_ANALYSIS event
            const { recordLeadEvent } = await import('@/lib/lead-intelligence');
            recordLeadEvent({
                leadId: lead.id,
                userId,
                workspaceId,
                type: 'AI_ANALYSIS',
                newValue: String(analysis.score),
                metadata: {
                    scoreLabel: analysis.scoreLabel,
                    closeProbability: analysis.closeProbability,
                    estimatedDealValue: analysis.estimatedDealValue,
                },
            });

            // Invalidate PipelineBrief cache so new analysis appears immediately
            if (workspaceId) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                prisma.pipelineBrief.deleteMany({
                    where: { workspaceId, briefDate: today },
                }).catch(() => {});
            }
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown';
        if (typeof process !== 'undefined' && process.stderr) {
            try {
                const { logger } = await import('./logger');
                logger.error('Error in saveAnalysisToDb', { error: msg });
            } catch {
                process.stderr.write(`saveAnalysisToDb error: ${msg}\n`);
            }
        }
    }
}
