/**
 * Lead analysis orchestration.
 *
 * This file is the entry point for `analyzeLead()`. It delegates prompt
 * construction to `@/lib/ai/prompts/builder` and AI completion to
 * `@/lib/ai/resolve` (Vercel AI SDK).
 *
 * Re-exports types for backward compat — consumers can import from here.
 */
import { generateCompletionForRole } from '@/lib/ai';
import { getWebContextForRole } from '@/lib/web-search/resolve';
import { scrapeWebsite, formatWebsiteMetadataForPrompt } from '@/lib/website-scraper';
import { prisma } from './prisma';
import {
    buildTaskDescription,
    buildCompanyContext,
    buildLeadAnalysisPrompt,
    buildRfDataBlock,
    buildReviewSignalsText,
    buildOpeningHoursText,
} from '@/lib/ai/prompts/builder';

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
    BusinessData,
    UserBusinessProfile,
    AnalyzeLeadContext,
    AnalyzeProgressCallback,
} from '@/lib/ai/prompts/analyze-types';

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
