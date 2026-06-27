/**
 * Lead analysis orchestration.
 *
 * This file is the entry point for `analyzeLead()`. It delegates prompt
 * construction to `@/lib/ai/prompts/builder` and AI completion to
 * `@/lib/ai/resolve` (Vercel AI SDK).
 *
 * Re-exports types for backward compat — consumers can import from here.
 */
import { generateCompletionForRole, generateObjectForRole } from '@/lib/ai';
import { getWebContextForRole } from '@/lib/web-search/resolve';
import { scrapeWebsite, formatWebsiteMetadataForPrompt } from '@/lib/website-scraper';
import { prisma } from './prisma';
import {
    buildTaskDescription,
    buildCompanyContext,
    buildLeadAnalysisPrompt,
    buildLeadReportSectionPrompt,
    buildRfDataBlock,
    buildReviewSignalsText,
    buildOpeningHoursText,
    type BuildLeadPromptInput,
} from '@/lib/ai/prompts/builder';
import { leadAnalysisCoreSchema } from '@/lib/ai/schemas';
import { sanitizeLeadAnalysisCore } from '@/lib/ai/prompts/sanitize';
import {
    buildFallbackAnalysis,
    getAnalysisErrorMessage,
    normalizeAnalyzeLocale,
} from '@/lib/i18n/analysis-error-messages';

function getAnalyzeMaxOutputTokens(): number {
    const parsed = Number.parseInt(process.env.ANALYZE_AI_MAX_OUTPUT_TOKENS ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 16384;
    return parsed;
}

// Re-export types for backward compat
export type {
    LeadAnalysis,
    BusinessData,
    UserBusinessProfile,
    AnalyzeLeadContext,
    AnalyzeProgressStep,
    AnalyzeProgressCallback,
} from '@/lib/ai/prompts/analyze-types';

import type {
    LeadAnalysis,
    LeadAnalysisCore,
    BusinessData,
    UserBusinessProfile,
    AnalyzeLeadContext,
    AnalyzeProgressCallback,
} from '@/lib/ai/prompts/analyze-types';

const PROMPT_LIMITS = {
    webContextChars: 6000,
    reviewsTextChars: 900,
    reviewSignalsChars: 900,
    conversionContextChars: 1200,
    websiteScrapingChars: 1200,
} as const;

function stripMarkdownLinkUrls(input: string): string {
    // Preserve source context while removing repeated URL payload from markdown links.
    return input.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');
}

function getAnalyzeReportSectionMaxOutputTokens(): number {
    const parsed = Number.parseInt(process.env.ANALYZE_AI_REPORT_SECTION_MAX_OUTPUT_TOKENS ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 2200;
    return parsed;
}

function capPromptText(input: string, maxChars: number): string {
    if (!input) return '';
    const normalized = input.replace(/\r\n/g, '\n').trim();
    if (normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function estimateTokensFromChars(chars: number): number {
    if (chars <= 0) return 0;
    // Practical rough estimate for mixed PT/EN prompts.
    return Math.ceil(chars / 4);
}

async function resolveFinalProfile(
    userProfile?: UserBusinessProfile,
    userId?: string,
    workspaceId?: string,
): Promise<UserBusinessProfile | undefined> {
    if (userProfile && (userProfile.companyName?.trim() || userProfile.productService?.trim())) {
        return userProfile;
    }

    const workspaceSelect = {
        companyName: true,
        legalName: true,
        tradeName: true,
        cnpj: true,
        primaryCnaeCode: true,
        primaryCnaeDescription: true,
        companySize: true,
        foundingDate: true,
        productService: true,
        targetAudience: true,
        mainBenefit: true,
        postalCode: true,
        neighborhood: true,
        city: true,
        state: true,
        websiteUrl: true,
        linkedInUrl: true,
        instagramUrl: true,
        facebookUrl: true,
        serviceModel: true,
        averageTicket: true,
        operationRadiusKm: true,
        knownCompetitors: true,
    } as const;

    if (workspaceId) {
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: workspaceSelect,
        });
        if (workspace?.companyName || workspace?.productService) {
            return {
                companyName: workspace.companyName ?? '',
                legalName: workspace.legalName ?? undefined,
                tradeName: workspace.tradeName ?? undefined,
                cnpj: workspace.cnpj ?? undefined,
                primaryCnaeCode: workspace.primaryCnaeCode ?? undefined,
                primaryCnaeDescription: workspace.primaryCnaeDescription ?? undefined,
                companySize: workspace.companySize ?? undefined,
                foundingDate: workspace.foundingDate ?? undefined,
                productService: workspace.productService ?? '',
                targetAudience: workspace.targetAudience ?? '',
                mainBenefit: workspace.mainBenefit ?? '',
                postalCode: workspace.postalCode ?? undefined,
                neighborhood: workspace.neighborhood ?? undefined,
                city: workspace.city ?? undefined,
                state: workspace.state ?? undefined,
                websiteUrl: workspace.websiteUrl ?? undefined,
                linkedInUrl: workspace.linkedInUrl ?? undefined,
                instagramUrl: workspace.instagramUrl ?? undefined,
                facebookUrl: workspace.facebookUrl ?? undefined,
                serviceModel: workspace.serviceModel ?? undefined,
                averageTicket: workspace.averageTicket ?? undefined,
                operationRadiusKm: workspace.operationRadiusKm ?? undefined,
                knownCompetitors: workspace.knownCompetitors ?? undefined,
            };
        }
    }

    let finalProfile = userProfile;
    if (!finalProfile && userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                companyName: true,
                productService: true,
                targetAudience: true,
                mainBenefit: true,
                workspaces: workspaceId
                    ? { where: { workspaceId }, include: { workspace: true }, take: 1 }
                    : { include: { workspace: true }, take: 1 },
            },
        });
        const workspace = user?.workspaces?.[0]?.workspace;
        const companyName = workspace?.companyName ?? user?.companyName;
        if (companyName) {
            finalProfile = {
                companyName,
                legalName: workspace?.legalName ?? undefined,
                tradeName: workspace?.tradeName ?? undefined,
                cnpj: workspace?.cnpj ?? undefined,
                primaryCnaeCode: workspace?.primaryCnaeCode ?? undefined,
                primaryCnaeDescription: workspace?.primaryCnaeDescription ?? undefined,
                companySize: workspace?.companySize ?? undefined,
                foundingDate: workspace?.foundingDate ?? undefined,
                productService: workspace?.productService ?? user?.productService ?? '',
                targetAudience: workspace?.targetAudience ?? user?.targetAudience ?? '',
                mainBenefit: workspace?.mainBenefit ?? user?.mainBenefit ?? '',
                postalCode: workspace?.postalCode ?? undefined,
                neighborhood: workspace?.neighborhood ?? undefined,
                city: workspace?.city ?? undefined,
                state: workspace?.state ?? undefined,
                websiteUrl: workspace?.websiteUrl ?? undefined,
                linkedInUrl: workspace?.linkedInUrl ?? undefined,
                instagramUrl: workspace?.instagramUrl ?? undefined,
                facebookUrl: workspace?.facebookUrl ?? undefined,
                serviceModel: workspace?.serviceModel ?? undefined,
                averageTicket: workspace?.averageTicket ?? undefined,
                operationRadiusKm: workspace?.operationRadiusKm ?? undefined,
                knownCompetitors: workspace?.knownCompetitors ?? undefined,
            };
        }
    }
    if (finalProfile && !finalProfile.companyName?.trim() && !finalProfile.productService?.trim()) {
        return undefined;
    }
    return finalProfile;
}

type ReportSectionDefinition = {
    title: string;
    instruction: string;
};

function getReportSectionDefinitions(isEn: boolean): ReportSectionDefinition[] {
    return isEn
        ? [
            { title: 'Executive Summary', instruction: 'Summarize the lead context, urgency, buying fit, and why this opportunity matters for our company.' },
            { title: 'Business Analysis', instruction: 'Analyze company maturity, operations, digital posture when relevant, reputation signals, and commercial readiness.' },
            { title: 'Market and Competition', instruction: 'Explain the local competitive landscape, market pressures, sector trends, and positioning implications.' },
            { title: 'Pain Points and Opportunities', instruction: 'Detail the most relevant pains, operational gaps, and where our offering can create measurable value.' },
            { title: 'Approach Strategy', instruction: 'Describe the recommended sales angle, sequencing, objections to expect, proof points, and contact channel strategy.' },
            { title: 'Next Steps', instruction: 'Provide a practical action plan with short-term next steps, cadence, and success criteria for the sales team.' },
        ]
        : [
            { title: 'Resumo Executivo', instruction: 'Resuma o contexto do lead, urgência, fit de compra e por que esta oportunidade importa para a nossa empresa.' },
            { title: 'Análise do Negócio', instruction: 'Analise maturidade da empresa, operação, presença digital quando relevante, sinais de reputação e prontidão comercial.' },
            { title: 'Mercado e Concorrência', instruction: 'Explique o cenário competitivo local, pressões de mercado, tendências do setor e implicações de posicionamento.' },
            { title: 'Dores e Oportunidades', instruction: 'Detalhe as dores mais relevantes, lacunas operacionais e onde a nossa oferta pode gerar valor mensurável.' },
            { title: 'Estratégia de Abordagem', instruction: 'Descreva o melhor ângulo comercial, sequência de abordagem, objeções esperadas, provas e canais de contato ideais.' },
            { title: 'Próximos Passos', instruction: 'Forneça um plano prático de ação com próximos passos de curto prazo, cadência e critérios de sucesso para o time comercial.' },
        ];
}

function normalizeMarkdownBody(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';
    return trimmed.replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function buildUnavailableSectionBody(isEn: boolean): string {
    return isEn
        ? 'Section unavailable temporarily. The structured analysis above remains valid.'
        : 'Seção temporariamente indisponível. A análise estruturada acima continua válida.';
}

function mergeUsage(
    base: { inputTokens: number; outputTokens: number } | undefined,
    extra: { inputTokens?: number; outputTokens?: number } | undefined,
): { inputTokens: number; outputTokens: number } | undefined {
    if (!base && !extra) return undefined;
    return {
        inputTokens: (base?.inputTokens ?? 0) + (extra?.inputTokens ?? 0),
        outputTokens: (base?.outputTokens ?? 0) + (extra?.outputTokens ?? 0),
    };
}

async function generateLeadFullReport(
    promptInput: BuildLeadPromptInput,
    analysis: LeadAnalysisCore,
): Promise<{ fullReport: string; usage?: { inputTokens: number; outputTokens: number } }> {
    const sections = getReportSectionDefinitions(promptInput.isEn);
    const coreAnalysisJson = JSON.stringify(analysis, null, 2);
    const renderedSections: string[] = [];
    let usage: { inputTokens: number; outputTokens: number } | undefined;

    for (const section of sections) {
        try {
            const result = await generateCompletionForRole('lead_analysis', {
                prompt: buildLeadReportSectionPrompt({
                    ...promptInput,
                    sectionTitle: section.title,
                    sectionInstruction: section.instruction,
                    coreAnalysisJson,
                }),
                maxOutputTokens: getAnalyzeReportSectionMaxOutputTokens(),
            });
            usage = mergeUsage(usage, result.usage);
            const body = normalizeMarkdownBody(result.text) || buildUnavailableSectionBody(promptInput.isEn);
            renderedSections.push(`## ${section.title}\n\n${body}`);
        } catch (error) {
            const { logger } = await import('@/lib/logger');
            logger.warn('Lead report section generation failed', {
                section: section.title,
                placeId: promptInput.business.placeId,
                error: error instanceof Error ? error.message : 'Unknown',
            });
            renderedSections.push(`## ${section.title}\n\n${buildUnavailableSectionBody(promptInput.isEn)}`);
        }
    }

    return { fullReport: renderedSections.join('\n\n'), usage };
}


async function prepareLeadAnalysisPrompt(
    business: BusinessData,
    userProfile: UserBusinessProfile | undefined,
    userId: string | undefined,
    isEn: boolean,
    isBusinessPlan: boolean,
    context: AnalyzeLeadContext | undefined,
    onProgress?: AnalyzeProgressCallback,
): Promise<{ prompt: string; promptInput: BuildLeadPromptInput; finalProfile: UserBusinessProfile | undefined }> {
    const finalProfile = await resolveFinalProfile(userProfile, userId, context?.workspaceId);
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
    const rawWebContext = await getWebContextForRole('lead_analysis', webQueries, context ? { workspaceId: context.workspaceId, userId: context.userId } : undefined);
    const webContext = capPromptText(stripMarkdownLinkUrls(rawWebContext), PROMPT_LIMITS.webContextChars);
    const phone = business.nationalPhoneNumber || business.internationalPhoneNumber || business.phone || '';
    const website = business.websiteUri || business.website || '';
    const reviewCount = business.userRatingCount || business.reviewCount || 0;
    const noReviewsLabel = isEn ? 'No recent reviews available' : 'Nenhuma avaliação recente disponível';
    const rawReviewsText = business.reviews && business.reviews.length > 0
        ? business.reviews.slice(0, 5).map(r => `[${r.rating}/5 - ${r.authorAttribution?.displayName || 'Client'}]: "${r.text?.text?.slice(0, 200)}"`).join('\n')
        : noReviewsLabel;
    const reviewsText = capPromptText(rawReviewsText, PROMPT_LIMITS.reviewsTextChars);
    const reviewSignalsText = capPromptText(buildReviewSignalsText(business.reviews, isEn), PROMPT_LIMITS.reviewSignalsChars);
    const openingHoursText = buildOpeningHoursText(business.currentOpeningHours, isEn);
    const companyContext = buildCompanyContext(finalProfile, isEn);
    const taskDescription = buildTaskDescription(isEn);

    // Build conversion context from real user data
    onProgress?.('conversion', isEn ? 'Analyzing your conversion history...' : 'Analisando seu histórico de conversão...');
    let conversionContext = '';
    try {
        const { getConversionStats, buildConversionContext: buildConvCtx } = await import('@/lib/lead-intelligence');
        const stats = await getConversionStats(userId || '', context?.workspaceId);
        conversionContext = capPromptText(buildConvCtx(stats, isEn), PROMPT_LIMITS.conversionContextChars);
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
            websiteScrapingBlock = capPromptText(
                formatWebsiteMetadataForPrompt(meta, isEn),
                PROMPT_LIMITS.websiteScrapingChars,
            );
        } catch {
            // Silently skip if scraping fails
        }
    }

    const promptInput: BuildLeadPromptInput = {
        business,
        isEn,
        companyContext,
        taskDescription,
        sellerProfile: finalProfile,
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
    };
    const prompt = buildLeadAnalysisPrompt(promptInput);
    return { prompt, promptInput, finalProfile };
}

export async function analyzeLead(
    business: BusinessData,
    userProfile?: UserBusinessProfile,
    locale: string = 'pt',
    userId?: string,
    isBusinessPlan: boolean = false,
    context?: AnalyzeLeadContext,
    onProgress?: AnalyzeProgressCallback
): Promise<{ analysis: LeadAnalysis; usage?: { inputTokens: number; outputTokens: number }; provider?: string; model?: string }> {
    const normalizedLocale = normalizeAnalyzeLocale(locale);
    const isEn = normalizedLocale === 'en';
    onProgress?.('profile', isEn ? 'Loading business profile...' : normalizedLocale === 'es' ? 'Cargando perfil del negocio...' : 'Carregando perfil do negócio...');
    const { prompt, promptInput, finalProfile } = await prepareLeadAnalysisPrompt(business, userProfile, userId, isEn, isBusinessPlan, context, onProgress);
    const promptChars = prompt.length;
    const promptEstimatedTokens = estimateTokensFromChars(promptChars);
    import('@/lib/logger').then(({ logger }) => logger.info('Analyze prompt budget', {
        placeId: business.placeId,
        workspaceId: context?.workspaceId,
        promptChars,
        promptEstimatedTokens,
    }));

    try {
        const { resolveAiForRole } = await import('@/lib/ai');
        const { config } = await resolveAiForRole('lead_analysis');
        const { extractJsonFromLlm } = await import('@/lib/ai/parse-json');

        onProgress?.('ai_call', isEn ? `Analyzing with ${config.provider}...` : `Analisando com ${config.provider}...`);
        let analysisCore: LeadAnalysisCore;
        let totalUsage: { inputTokens: number; outputTokens: number } | undefined;
        let provider = config.provider;
        let model = config.model;
        try {
            const structured = await generateObjectForRole('lead_analysis', {
                prompt: `${prompt}\n\nIMPORTANT: Return ONLY a valid JSON object. No markdown, no commentary, no code fences.`,
                maxOutputTokens: getAnalyzeMaxOutputTokens(),
                schema: leadAnalysisCoreSchema,
            });
            analysisCore = structured.object as LeadAnalysisCore;
            totalUsage = mergeUsage(totalUsage, structured.usage);
            provider = structured.provider ?? provider;
            model = structured.model ?? model;
        } catch (objErr) {
            const result = await generateCompletionForRole('lead_analysis', {
                prompt,
                jsonMode: true,
                maxOutputTokens: getAnalyzeMaxOutputTokens(),
            });
            totalUsage = mergeUsage(totalUsage, result.usage);
            provider = result.provider ?? provider;
            model = result.model ?? model;
            try {
                analysisCore = extractJsonFromLlm<LeadAnalysisCore>(result.text);
            } catch (parseErr) {
                const { logger: retryLogger } = await import('@/lib/logger');
                retryLogger.warn('Lead analysis structured generation failed', {
                    objectError: objErr instanceof Error ? objErr.message : 'Unknown',
                    parseError: parseErr instanceof Error ? parseErr.message : 'Unknown',
                    placeId: business.placeId,
                });
                throw parseErr;
            }
        }

        analysisCore = sanitizeLeadAnalysisCore(analysisCore, finalProfile);

        onProgress?.('parsing', isEn ? 'Processing AI response...' : 'Processando resposta da IA...');
        onProgress?.('ai_call', isEn ? 'Generating report sections...' : 'Gerando seções do relatório...');
        const reportResult = await generateLeadFullReport(promptInput, analysisCore);
        totalUsage = mergeUsage(totalUsage, reportResult.usage);
        const analysis: LeadAnalysis = {
            ...analysisCore,
            fullReport: reportResult.fullReport,
        };

        onProgress?.('saving', isEn ? 'Saving analysis...' : 'Salvando análise...');
        saveAnalysisToDb(business.placeId, analysis, finalProfile, userId, context?.workspaceId, normalizedLocale).catch(err =>
            import('@/lib/logger').then(({ logger }) => logger.error('Save analysis error', { error: err instanceof Error ? err.message : 'Unknown' }))
        );

        onProgress?.('done', isEn ? 'Analysis complete!' : 'Análise concluída!');
        return {
            analysis,
            usage: totalUsage,
            provider,
            model,
        };
    } catch (error: unknown) {
        const { logger } = await import('@/lib/logger');
        logger.error('AI Analysis Error', { error: error instanceof Error ? error.message : 'Unknown' });
        const msg = ((error as { message?: string })?.message ?? '').toLowerCase();
        return { analysis: buildFallbackAnalysis(getAnalysisErrorMessage(msg, locale), locale) };
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

async function sendAnalysisReadyNotification(
  userId: string,
  placeId: string,
  workspaceId: string | undefined,
  locale: string,
): Promise<void> {
    const { createNotification } = await import('@/lib/notification-service');
    const { getAnalysisReadyNotificationCopy } = await import('@/lib/i18n/messages');
    const { resolveMarketForWorkspace } = await import('@/lib/user-market');
    const { normalizeAnalyzeLocale } = await import('@/lib/i18n/analysis-error-messages');

    const normalizedLocale = normalizeAnalyzeLocale(locale);
    const market = await resolveMarketForWorkspace(workspaceId);
    const copy = getAnalysisReadyNotificationCopy(normalizedLocale);

    createNotification({
        userId,
        workspaceId: workspaceId ?? null,
        title: copy.title,
        message: copy.message,
        type: 'INFO',
        link: `/dashboard/lead/${placeId}`,
        sendEmailIfPreferred: true,
        emailSubject: copy.emailSubject,
        channel: 'lead_analysis_ready',
        locale: normalizedLocale,
        market,
    }).catch((err) =>
        import('@/lib/logger').then(({ logger }) => logger.error('Create notification after analysis', { error: err instanceof Error ? err.message : 'Unknown' }))
    );
}

async function saveAnalysisToDb(
    placeId: string,
    analysis: LeadAnalysis,
    profile?: UserBusinessProfile,
    userId?: string,
    workspaceId?: string,
    locale: string = 'pt',
) {
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
            await sendAnalysisReadyNotification(userId, placeId, workspaceId, locale);
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
