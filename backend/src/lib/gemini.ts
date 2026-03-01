import { generateCompletionForRole } from '@/lib/ai';
import { getWebContextForRole } from '@/lib/web-search/resolve';
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
    reviews?: Array<{
        rating: number;
        text: { text: string };
        authorAttribution: { displayName: string };
        relativePublishTimeDescription: string;
    }>;
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

function buildCompanyContext(finalProfile: UserBusinessProfile | undefined, isEn: boolean): string {
    const fallbackRole = isEn
        ? 'You are a Senior B2B Strategic Consultant specialized in commercial prospecting.'
        : 'Você é um Consultor Estratégico B2B Sênior especializado em prospecção comercial.';
    if (!finalProfile) return fallbackRole;
    return isEn
        ? `You are a Senior B2B Commercial Consultant for "${finalProfile.companyName}".
"${finalProfile.companyName}" offers: "${finalProfile.productService}".
Target audience: "${finalProfile.targetAudience}".
Main competitive advantage: "${finalProfile.mainBenefit}".
CRUCIAL CONTEXT: Analyze the "website" gap through the lens of YOUR product ("${finalProfile.productService}"). If you sell websites/marketing, a missing website is a massive sales opportunity. If you sell Insurance, Cleaning, Logistics, Real Estate, or other physical/B2B services, a missing website is just a minor communication detail, NOT a critical flaw.
MANDATORY: The ENTIRE report (summary, strengths, weaknesses, gaps, painPoints, approachStrategy, suggestedScripts, fullReport) must be from the perspective of "${finalProfile.companyName}" selling ONLY "${finalProfile.productService}". Do NOT recommend or offer services that are not what this company sells (e.g. if they sell real estate, do NOT suggest offering websites, SEO, or digital marketing to the lead; suggest only real estate services such as finding space, listings, rentals).`
        : `Você é um Consultor Comercial B2B Sênior trabalhando para "${finalProfile.companyName}".
"${finalProfile.companyName}" oferece: "${finalProfile.productService}".
Público-alvo: "${finalProfile.targetAudience}".
Principal diferencial: "${finalProfile.mainBenefit}".
CONTEXTO CRUCIAL: Analise a lacuna de "website" através da lente do SEU produto ("${finalProfile.productService}"). Se você vende sites/marketing, a falta de um site é uma enorme oportunidade de venda. Se você vende Seguros, Limpeza, Logística, Imobiliária ou outros serviços físicos/B2B, a falta de um site é apenas um detalhe de comunicação menor, NÃO uma falha crítica.
OBRIGATÓRIO: O relatório INTEIRO (resumo, pontos fortes, fraquezas, lacunas, dores, estratégia de abordagem, scripts sugeridos, relatório completo) deve ser na perspectiva de "${finalProfile.companyName}" vendendo APENAS "${finalProfile.productService}". NÃO recomende nem ofereça serviços que não sejam o que esta empresa vende (ex.: se for imobiliária, NÃO sugira oferecer site, SEO ou marketing digital ao lead; sugira apenas serviços imobiliários como encontrar espaço, imóveis para locação/venda).`;
}

export async function analyzeLead(
    business: BusinessData,
    userProfile?: UserBusinessProfile,
    locale: string = 'pt',
    userId?: string,
    isBusinessPlan: boolean = false,
    context?: AnalyzeLeadContext
): Promise<{ analysis: LeadAnalysis; usage?: { inputTokens: number; outputTokens: number }; provider?: string }> {
    const finalProfile = await resolveFinalProfile(userProfile, userId);
    const isEn = locale === 'en';

    const address = business.formattedAddress || business.address || '';
    const cityPart = address ? address.split(',').pop()?.trim() : '';
    const webQueries = [
        business.name,
        `Reclame Aqui ${business.name}`,
        `CNPJ ${business.name} ${cityPart}`.trim(),
        `JusBrasil ${business.name}`,
        business.primaryType || business.types?.[0] || '',
    ].filter(Boolean);
    const webContext = await getWebContextForRole('lead_analysis', webQueries, context ? { workspaceId: context.workspaceId, userId: context.userId } : undefined);

    const phone = business.nationalPhoneNumber || business.internationalPhoneNumber || business.phone || '';
    const website = business.websiteUri || business.website || '';
    const reviewCount = business.userRatingCount || business.reviewCount || 0;

    const noReviewsLabel = isEn ? 'No recent reviews available' : 'Nenhuma avaliação recente disponível';
    const reviewsText = business.reviews && business.reviews.length > 0
        ? business.reviews.slice(0, 5).map(r =>
            `[${r.rating}/5 - ${r.authorAttribution?.displayName || 'Client'}]: "${r.text?.text?.slice(0, 200)}"`
        ).join('\n')
        : noReviewsLabel;

    const companyContext = buildCompanyContext(finalProfile, isEn);

    const taskDescription = isEn
        ? `Your task is to generate a DEEP, DETAILED, and ACTIONABLE strategic prospecting report for the lead below.
Be like a senior consultant who has researched this company thoroughly. Avoid generic statements.
Every insight must be specific to THIS business and how YOUR product/service can help them.`
        : `Sua tarefa é gerar um relatório estratégico de prospecção PROFUNDO, DETALHADO e ACIONÁVEL para o lead abaixo.
Seja como um consultor sênior que pesquisou a fundo esta empresa. Evite afirmações genéricas.
Cada análise deve ser específica para ESTE negócio e como o SEU produto/serviço pode ajudá-los.`;

    const prompt = `${companyContext}

${taskDescription}

${isEn ? 'LEAD DATA:' : 'DADOS DO LEAD:'}
- ${isEn ? 'Business Name' : 'Nome do Negócio'}: ${business.name}
- ${isEn ? 'Type/Category' : 'Tipo/Categoria'}: ${business.primaryType || business.types?.join(', ') || (isEn ? 'Not specified' : 'Não especificado')}
- ${isEn ? 'Address' : 'Endereço'}: ${address || (isEn ? 'Not available' : 'Não disponível')}
- ${isEn ? 'Phone' : 'Telefone'}: ${phone || (isEn ? 'No phone listed' : 'Sem telefone cadastrado')}
- ${isEn ? 'Website' : 'Site'}: ${website || (isEn ? 'NO WEBSITE (critical gap)' : 'SEM WEBSITE (lacuna crítica)')}
- ${isEn ? 'Google Rating' : 'Avaliação Google'}: ${business.rating ?? (isEn ? 'No rating' : 'Sem avaliação')}/5
- ${isEn ? 'Total Reviews' : 'Total de Avaliações'}: ${reviewCount}
- ${isEn ? 'Business Status' : 'Status do Negócio'}: ${business.businessStatus || 'OPERATIONAL'}
${((): string => {
        if (!website) return '';
        return isEn
            ? '\nCRITICAL: This lead HAS a website (URL above). You MUST acknowledge it, analyze it when relevant (content, UX, SEO, gaps in the site itself), and NEVER list "no website" or "missing website" as a gap.'
            : '\nCRÍTICO: Este lead POSSUI website (URL acima). Você DEVE reconhecê-lo, analisá-lo quando relevante (conteúdo, UX, SEO, lacunas no próprio site) e NUNCA listar "sem website" ou "ausência de site" como lacuna.';
    })()}

${isEn ? 'RECENT CUSTOMER REVIEWS:' : 'AVALIAÇÕES RECENTES DE CLIENTES:'}
${reviewsText}
${((): string => {
        if (!webContext) return '';
        let businessPlanNote = '';
        if (isBusinessPlan) {
            businessPlanNote = isEn
                ? '\nIMPORTANT: The web context above contains REAL data collected from Reclame Aqui, JusBrasil, CNPJ databases, and general web searches. You MUST analyze this data carefully and incorporate it into your report. Cite specific findings and sources. If Reclame Aqui shows complaints, detail them. If JusBrasil shows lawsuits, flag the risks. If CNPJ data reveals information about the company, use it.'
                : '\nIMPORTANTE: O contexto da web acima contém dados REAIS coletados do Reclame Aqui, JusBrasil, bases de CNPJ e buscas web gerais. Você DEVE analisar esses dados cuidadosamente e incorporá-los ao seu relatório. Cite achados e fontes específicas. Se o Reclame Aqui mostra reclamações, detalhe-as. Se o JusBrasil mostra processos, sinalize os riscos. Se dados de CNPJ revelam informações sobre a empresa, use-os.';
        }
        return `\n\n${webContext}\n${businessPlanNote}\n\n`;
    })()}

${isEn ? 'ANALYSIS REQUIREMENTS (be extremely specific, not generic):' : 'REQUISITOS DA ANÁLISE (seja extremamente específico, não genérico):'}

1. ${isEn ? 'DIGITAL PRESENCE GAPS: What is this business missing? (website, online booking, e-commerce, CRM, social media management, paid ads, SEO, etc.) Consider if missing a website is actually a problem for them based on what YOU sell.' : 'LACUNAS DE PRESENÇA DIGITAL: O que este negócio está faltando? (website, agendamento online, e-commerce, CRM, gestão de redes sociais, anúncios pagos, SEO, etc.) Considere se a falta de um site é realmente um problema para eles com base no que VOCÊ vende.'}

2. ${isEn ? 'CUSTOMER PAIN POINTS: Based on reviews and business type, what frustrations do their customers likely face? What operational challenges does this business have?' : 'DORES DO CLIENTE: Com base nas avaliações e tipo de negócio, quais frustrações os clientes provavelmente enfrentam? Quais desafios operacionais este negócio tem?'}

3. ${isEn ? 'SOCIAL MEDIA STRATEGY: Proactively analyze scenarios for Instagram, LinkedIn, and Facebook based on their niche. Suggest what kind of content they SHOULD be posting to get more clients. Be highly sincere about what they can improve.' : 'ESTRATÉGIA DE REDES SOCIAIS: Analise proativamente cenários para Instagram, LinkedIn e Facebook com base no nicho deles. Sugira que tipo de conteúdo eles DEVERIAM postar para atrair mais clientes. Seja altamente sincero sobre o que eles podem melhorar.'}

4. ${isEn ? 'FIRST CONTACT MESSAGE: Write a professional, personalized opening message for the FIRST contact (WhatsApp/email). It should reference something specific about this business (their rating, a review pattern, missing digital element). Max 3 short paragraphs. No generic templates.' : 'MENSAGEM DE PRIMEIRO CONTATO: Escreva uma mensagem de abertura profissional e personalizada para o PRIMEIRO contato (WhatsApp/email). Deve referenciar algo específico deste negócio (avaliação, padrão nas reviews, elemento digital faltando). Máximo 3 parágrafos curtos. Sem templates genéricos.'}
5. ${isEn ? 'REVIEW RECENCY: Analyze the time of reviews. If reviews are mostly from years ago, flag this as a "stagnant reputation". If recent, analyze the trend.' : 'RECÊNCIA DE REVIEWS: Analise o tempo das avaliações. Se forem majoritariamente de anos atrás, aponte isso como "reputação estagnada". Se recentes, analise a tendência.'}
${((): string => {
        if (!isBusinessPlan) return '';
        const point6 = isEn
            ? '6. DEEP REPUTATION ANALYSIS: Using the REAL data from Reclame Aqui and JusBrasil provided in the web context above, analyze: (a) consumer reputation — complaints, response rate, resolution rate; (b) legal risks — lawsuits, labor disputes, consumer protection cases; (c) CNPJ data — company size, founding date, business activities. Include ALL findings in the full report with source citations.'
            : '6. ANÁLISE PROFUNDA DE REPUTAÇÃO: Usando os dados REAIS do Reclame Aqui e JusBrasil fornecidos no contexto da web acima, analise: (a) reputação do consumidor — reclamações, taxa de resposta, taxa de resolução; (b) riscos legais — processos, disputas trabalhistas, casos de defesa do consumidor; (c) dados de CNPJ — porte da empresa, data de fundação, atividades empresariais. Inclua TODOS os achados no relatório completo com citações de fonte.';
        return point6;
    })()}
7. ${isEn ? 'WHATSAPP MESSAGE: A shorter, more casual version for WhatsApp (max 2 short paragraphs, conversational tone, gets to the point fast).' : 'MENSAGEM WHATSAPP: Uma versão mais curta e casual para WhatsApp (máximo 2 parágrafos curtos, tom conversacional, vai direto ao ponto).'}

${isEn ? 'CRITICAL: Respond ONLY with valid JSON, no markdown, no code blocks. Values must be in ENGLISH:' : 'CRÍTICO: Responda APENAS com JSON válido, sem markdown, sem blocos de código. Valores devem estar em PORTUGUÊS:'}
{
  "score": <number 1-100>,
  "scoreLabel": "<${isEn ? 'Cold|Warm|Hot|Very Hot' : 'Frio|Morno|Quente|Muito Quente'}>",
  "summary": "<${isEn ? 'Provide a dense executive summary specific to this business, without strict length constraints.' : 'Forneça um denso resumo executivo específico para este negócio, sem limite estrito de tamanho.'}>",
  "strengths": ["<${isEn ? 'specific strength 1' : 'força específica 1'}>", "<${isEn ? 'strength 2' : 'força 2'}>", "<${isEn ? 'strength 3' : 'força 3'}>"],
  "weaknesses": ["<${isEn ? 'specific weakness 1' : 'fraqueza específica 1'}>", "<${isEn ? 'weakness 2' : 'fraqueza 2'}>", "<${isEn ? 'weakness 3' : 'fraqueza 3'}>"],
  "painPoints": ["<${isEn ? 'specific customer pain point 1' : 'dor específica do cliente 1'}>", "<${isEn ? 'pain point 2' : 'dor 2'}>", "<${isEn ? 'pain point 3' : 'dor 3'}>", "<${isEn ? 'operational challenge 4' : 'desafio operacional 4'}>"],
  "gaps": ["<${isEn ? 'digital gap 1: e.g. No website' : 'lacuna digital 1: ex. Sem website'}>", "<${isEn ? 'gap 2' : 'lacuna 2'}>", "<${isEn ? 'gap 3' : 'lacuna 3'}>", "<${isEn ? 'gap 4' : 'lacuna 4'}>"],
  "approach": "<${isEn ? 'Specific approach strategy: what angle to use, what pain to address first, timing recommendations' : 'Estratégia de abordagem específica: qual ângulo usar, qual dor abordar primeiro, recomendações de timing'}>",
  "contactStrategy": "<${isEn ? 'Recommended channels (WhatsApp, LinkedIn, phone, email), best time to contact, who likely to answer, what to say first call' : 'Canais recomendados (WhatsApp, LinkedIn, telefone, email), melhor horário para contato, quem provavelmente atende, o que dizer na primeira ligação'}>",
  "firstContactMessage": "<${isEn ? 'Professional personalized opening message for first contact (email/WhatsApp), max 3 short paragraphs, specific to this business' : 'Mensagem de abertura profissional e personalizada para primeiro contato (email/WhatsApp), máximo 3 parágrafos curtos, específica para este negócio'}>",
  "suggestedWhatsAppMessage": "<${isEn ? 'Shorter casual WhatsApp version, 2 paragraphs max, conversational, direct' : 'Versão mais curta e casual para WhatsApp, 2 parágrafos no máximo, conversacional, direta'}>",
  "reviewAnalysis": "<${isEn ? 'Detailed analysis of the rating trend and recency' : 'Análise detalhada da tendência e recência das avaliações'}>",
  "socialMedia": {
    "instagram": "<${isEn ? 'CRITICAL: ONLY return real URLs. NEVER invent or hallucinate. If unsure, return Not found' : 'CRÍTICO: Retorne APENAS URLs reais. NUNCA invente ou alucine. Se não tiver certeza absoluta, retorne exatamente Não encontrado'}>",
    "facebook": "<${isEn ? 'CRITICAL: NEVER hallucinate URLs. If unsure, return Not found' : 'CRÍTICO: NUNCA alucine URLs. Se não tiver certeza, retorne exatamente Não encontrado'}>",
    "linkedin": "<${isEn ? 'CRITICAL: NEVER hallucinate URLs. If unsure, return Not found' : 'CRÍTICO: NUNCA alucine URLs. Se não tiver certeza, retorne exatamente Não encontrado'}>"
  },
  "fullReport": "<${isEn ? 'EXTREMELY DETAILED and extensive report in Markdown. Dive deep into all possibilities. Sections: ## Executive Summary | ## Digital Strategy | ## Deep Gaps | ## Operational Vulnerabilities | ## Competitor Profile | ## Complete Action Plan.' : 'Relatório EXTREMAMENTE DETALHADO e extenso em Markdown. Aprofunde-se muito nas possibilidades, sem medo de gerar um texto grande. Seções: ## Resumo Executivo | ## Estratégia Digital | ## Lacunas Profundas | ## Vulnerabilidades Operacionais | ## Perfil do Concorrente | ## Plano de Ação Completo.'}>"
${((): string => {
        if (!isBusinessPlan) return '';
        const reclamePrompt = isEn ? 'Analysis of Reclame Aqui data: complaint patterns, response rate, resolution rate, overall reputation score. If no data found, state that clearly.' : 'Análise dos dados do Reclame Aqui: padrões de reclamação, taxa de resposta, taxa de resolução, score geral de reputação. Se nenhum dado foi encontrado, declare isso claramente.';
        const jusBrasilPrompt = isEn ? 'Analysis of JusBrasil data: lawsuits, labor disputes, consumer cases, legal risks. If no data found, state that clearly.' : 'Análise dos dados do JusBrasil: processos, disputas trabalhistas, casos de consumidor, riscos legais. Se nenhum dado foi encontrado, declare isso claramente.';
        const cnpjPrompt = isEn ? 'Analysis of CNPJ data: company size, founding date, registered activities, tax status. If no data found, state that clearly.' : 'Análise dos dados de CNPJ: porte da empresa, data de fundação, atividades registradas, situação fiscal. Se nenhum dado foi encontrado, declare isso claramente.';
        return `  ,"reclameAquiAnalysis": "<${reclamePrompt}>"
  ,"jusBrasilAnalysis": "<${jusBrasilPrompt}>"
  ,"cnpjAnalysis": "<${cnpjPrompt}>"`;
    })()}
}
`;

    try {
        const { resolveAiForRole } = await import('@/lib/ai');
        const { config } = await resolveAiForRole('lead_analysis');
        const result = await generateCompletionForRole('lead_analysis', {
            prompt,
            jsonMode: true,
            maxTokens: 8192,
        });

        // More robust JSON extraction
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        const cleaned = jsonMatch
            ? jsonMatch[0]
            : result.text
                  .replace(/```json\n?/g, '')
                  .replace(/```\n?/g, '')
                  .trim();

        const analysis = JSON.parse(cleaned) as LeadAnalysis;

        // Persist Analysis in Background
        saveAnalysisToDb(business.placeId, analysis, finalProfile, userId, context?.workspaceId).catch(err =>
            import('@/lib/logger').then(({ logger }) => logger.error('Save analysis error', { error: err instanceof Error ? err.message : 'Unknown' }))
        );

        return { analysis, usage: result.usage, provider: config.provider };
    } catch (error: unknown) {
        const { logger } = await import('@/lib/logger');
        logger.error('AI Analysis Error', { error: error instanceof Error ? error.message : 'Unknown' });

        const err = error as { message?: string };
        const msg = (err?.message ?? '').toLowerCase();
        let errorMessage = 'Não foi possível gerar análise detalhada no momento.';
        if (msg.includes('no ai config') || msg.includes('not set')) {
            errorMessage = 'IA não configurada. Configure um provedor em Admin ou GEMINI_API_KEY no servidor.';
        } else if (msg.includes('403') || msg.includes('restriction') || msg.includes('permission')) {
            errorMessage = 'API Key com restrição (IP ou domínio). Verifique no painel do provedor.';
        } else if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit')) {
            errorMessage = 'Limite de uso da API atingido. Tente novamente em alguns minutos.';
        } else if (msg.includes('401') || msg.includes('invalid') || msg.includes('api key')) {
            errorMessage = 'Chave da API inválida. Verifique a configuração no admin.';
        } else if (msg.includes('500') || msg.includes('unavailable')) {
            errorMessage = 'Serviço de IA temporariamente indisponível. Tente novamente em instantes.';
        } else if (msg.includes('404') || msg.includes('no longer available') || msg.includes('newer model')) {
            errorMessage = 'Modelo em uso não está mais disponível. Atualize o modelo na configuração de IA.';
        }

        return {
            analysis: {
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
            },
        };
    }
}

async function ensureGuestUserIfNeeded(userId: string | undefined, profile?: UserBusinessProfile): Promise<string> {
    const finalUserId = userId || 'cl_guest_default';
    if (userId) return finalUserId;
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
            }
        });
        if (userId && userId !== 'cl_guest_default') {
            await sendAnalysisReadyNotification(userId, placeId, workspaceId);
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
