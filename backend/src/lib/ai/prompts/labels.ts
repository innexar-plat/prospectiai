/**
 * Bilingual label constants for lead analysis prompts (EN/PT).
 *
 * Extracted from gemini.ts for maintainability. Each label set contains
 * both EN and PT versions for the analysis prompt template.
 */

export const LEAD_DATA_LABELS = {
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

export const LEAD_REQUIREMENTS_LABELS = {
    en: {
        header: 'ANALYSIS REQUIREMENTS (be extremely specific, not generic):',
        gaps: 'GAPS & OPPORTUNITIES: What is this business missing that YOUR company can solve? Focus ONLY on gaps relevant to YOUR actual product/service (see seller profile above). Never invent or assume a different industry for your company.',
        painPoints: 'CUSTOMER PAIN POINTS: Based on reviews and business type, what frustrations do their customers likely face? What operational challenges does this business have?',
        socialMedia: 'SOCIAL MEDIA STRATEGY: Proactively analyze scenarios for Instagram, LinkedIn, and Facebook based on their niche. Suggest what kind of content they SHOULD be posting to get more clients. Be highly sincere about what they can improve.',
        firstContact: 'FIRST CONTACT MESSAGE: Write a professional, personalized opening message for the FIRST contact (WhatsApp/email). It should reference something specific about this business (their rating, a review pattern, missing digital element). Max 3 short paragraphs. No generic templates.',
        recency: 'REVIEW RECENCY: Analyze the time of reviews. If reviews are mostly from years ago, flag this as a "stagnant reputation". If recent, analyze the trend.',
        timing: 'BEST CONTACT TIME: Recommend the best contact window based on opening hours and likely availability from review patterns.',
        whatsapp: 'WHATSAPP MESSAGE: A shorter, more casual version for WhatsApp (max 2 short paragraphs, conversational tone, gets to the point fast).'
    },
    pt: {
        header: 'REQUISITOS DA ANÁLISE (seja extremamente específico, não genérico):',
        gaps: 'LACUNAS & OPORTUNIDADES: O que este negócio está faltando que A SUA empresa pode resolver? Foque APENAS em lacunas relevantes ao SEU produto/serviço real (veja o perfil do vendedor acima). Nunca invente ou assuma outro setor para a sua empresa.',
        painPoints: 'DORES DO CLIENTE: Com base nas avaliações e tipo de negócio, quais frustrações os clientes provavelmente enfrentam? Quais desafios operacionais este negócio tem?',
        socialMedia: 'ESTRATÉGIA DE REDES SOCIAIS: Analise proativamente cenários para Instagram, LinkedIn e Facebook com base no nicho deles. Sugira que tipo de conteúdo eles DEVERIAM postar para atrair mais clientes. Seja altamente sincero sobre o que eles podem melhorar.',
        firstContact: 'MENSAGEM DE PRIMEIRO CONTATO: Escreva uma mensagem de abertura profissional e personalizada para o PRIMEIRO contato (WhatsApp/email). Deve referenciar algo específico deste negócio (avaliação, padrão nas reviews, elemento digital faltando). Máximo 3 parágrafos curtos. Sem templates genéricos.',
        recency: 'RECÊNCIA DE REVIEWS: Analise o tempo das avaliações. Se forem majoritariamente de anos atrás, aponte isso como "reputação estagnada". Se recentes, analise a tendência.',
        timing: 'MELHOR HORÁRIO DE CONTATO: Recomende a melhor janela de abordagem com base nos horários de funcionamento e provável disponibilidade pelo padrão de reviews.',
        whatsapp: 'MENSAGEM WHATSAPP: Uma versão mais curta e casual para WhatsApp (máximo 2 parágrafos curtos, tom conversacional, vai direto ao ponto).'
    }
} as const;

export const JSON_SCHEMA_LABELS = {
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
