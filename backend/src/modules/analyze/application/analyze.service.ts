/**
 * Analyze module — application layer (use-case).
 * Orchestrates cache (existing analysis), credits, Gemini and DB updates.
 * Route (api) only validates, rate-limits, authenticates and calls runAnalyze.
 */

import { analyzeLead, type BusinessData, type UserBusinessProfile, type AnalyzeProgressCallback } from '@/lib/gemini';
import { resolveAiForRole } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import { checkMemberLimits, MemberLimitExceededError } from '@/lib/team-credits';
import { recordUsageEvent } from '@/lib/usage';
import type { AnalyzeInput } from '@/lib/validations/schemas';
import { getCached, setCached } from '@/lib/redis';

const DEFAULT_ANALYZE_RESULT_CACHE_TTL_SECONDS = 86400;

function parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getAnalyzeResultCacheTtlSeconds(): number {
    return parsePositiveInt(process.env.ANALYZE_RESULT_CACHE_TTL_SECONDS, DEFAULT_ANALYZE_RESULT_CACHE_TTL_SECONDS);
}

function buildAnalyzeResultCacheKey(userId: string, placeId: string): string {
    return `analyze:result:${userId}:${placeId}`;
}

export class AnalyzeHttpError extends Error {
    constructor(
        public readonly status: number,
        public readonly body: Record<string, unknown>
    ) {
        super(typeof body.error === 'string' ? body.error : 'Request failed');
        this.name = 'AnalyzeHttpError';
    }
}

export type AnalyzeOutput = {
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
    fullReport: string | null;
    socialMedia: { instagram?: string; facebook?: string; linkedin?: string };
    /** Provider used for this analysis (e.g. GEMINI, OPENAI, CLOUDFLARE). */
    aiProvider?: string;
    // Lead Intelligence fields
    closeProbability?: number;
    estimatedDealValue?: number;
    bestContactWindow?: string;
    // Deep analysis fields
    reclameAquiAnalysis?: string;
    jusBrasilAnalysis?: string;
    cnpjAnalysis?: string;
    reviewTrend?: string;
    suggestedContactTime?: string;
    reviewAnalysis?: string;
};

async function getUserAndWorkspaceOrThrow(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            onboardingCompletedAt: true,
            companyName: true,
            productService: true,
            targetAudience: true,
            mainBenefit: true,
            workspaces: { include: { workspace: true }, take: 1 },
        },
    });
    if (!user || user.workspaces.length === 0) throw new AnalyzeHttpError(404, { error: 'Workspace not found' });
    if (user.onboardingCompletedAt == null) {
        throw new AnalyzeHttpError(403, { error: 'Complete onboarding before analyzing leads', code: 'REQUIRES_ONBOARDING' });
    }
    const membership = user.workspaces[0];
    return {
        user,
        activeWorkspace: membership.workspace,
        membership: {
            dailyLeadsLimit: membership.dailyLeadsLimit,
            weeklyLeadsLimit: membership.weeklyLeadsLimit,
            monthlyLeadsLimit: membership.monthlyLeadsLimit,
        },
    };
}

function mapExistingAnalysisToOutput(existingAnalysis: {
    score: number | null;
    scoreLabel: string | null;
    summary: string | null;
    strengths: unknown;
    weaknesses: unknown;
    painPoints: unknown;
    gaps: unknown;
    approach: string | null;
    contactStrategy: string | null;
    firstContactMessage: string | null;
    suggestedWhatsAppMessage: string | null;
    fullReport: string | null;
    socialInstagram: string | null;
    socialFacebook: string | null;
    socialLinkedin: string | null;
    closeProbability?: number | null;
    estimatedDealValue?: number | null;
    bestContactWindow?: string | null;
    reclameAquiAnalysis?: string | null;
    jusBrasilAnalysis?: string | null;
    cnpjAnalysis?: string | null;
    reviewTrend?: string | null;
    suggestedContactTime?: string | null;
}): AnalyzeOutput {
    return {
        score: existingAnalysis.score ?? 0,
        scoreLabel: existingAnalysis.scoreLabel ?? '',
        summary: existingAnalysis.summary ?? '',
        strengths: (existingAnalysis.strengths as string[]) ?? [],
        weaknesses: (existingAnalysis.weaknesses as string[]) ?? [],
        painPoints: Array.isArray(existingAnalysis.painPoints) ? (existingAnalysis.painPoints as string[]) : [],
        gaps: Array.isArray(existingAnalysis.gaps) ? (existingAnalysis.gaps as string[]) : [],
        approach: existingAnalysis.approach ?? '',
        contactStrategy: existingAnalysis.contactStrategy ?? '',
        firstContactMessage: existingAnalysis.firstContactMessage ?? '',
        suggestedWhatsAppMessage: existingAnalysis.suggestedWhatsAppMessage ?? '',
        fullReport: existingAnalysis.fullReport ?? null,
        socialMedia: {
            instagram: existingAnalysis.socialInstagram ?? undefined,
            facebook: existingAnalysis.socialFacebook ?? undefined,
            linkedin: existingAnalysis.socialLinkedin ?? undefined,
        },
        closeProbability: existingAnalysis.closeProbability ?? undefined,
        estimatedDealValue: existingAnalysis.estimatedDealValue ?? undefined,
        bestContactWindow: existingAnalysis.bestContactWindow ?? undefined,
        reclameAquiAnalysis: existingAnalysis.reclameAquiAnalysis ?? undefined,
        jusBrasilAnalysis: existingAnalysis.jusBrasilAnalysis ?? undefined,
        cnpjAnalysis: existingAnalysis.cnpjAnalysis ?? undefined,
        reviewTrend: existingAnalysis.reviewTrend ?? undefined,
        suggestedContactTime: existingAnalysis.suggestedContactTime ?? undefined,
        aiProvider: undefined,
    };
}

function buildAnalyzeProfile(
    userProfile: AnalyzeInput['userProfile'],
    user: { companyName: string | null; productService: string | null; targetAudience: string | null; mainBenefit: string | null },
    activeWorkspace: {
        companyName: string | null;
        legalName?: string | null;
        tradeName?: string | null;
        cnpj?: string | null;
        primaryCnaeCode?: string | null;
        primaryCnaeDescription?: string | null;
        companySize?: string | null;
        foundingDate?: string | null;
        productService: string | null;
        targetAudience: string | null;
        mainBenefit: string | null;
        postalCode?: string | null;
        neighborhood?: string | null;
        city?: string | null;
        state?: string | null;
        websiteUrl?: string | null;
        linkedInUrl?: string | null;
        instagramUrl?: string | null;
        facebookUrl?: string | null;
        serviceModel?: string | null;
        averageTicket?: number | null;
        operationRadiusKm?: number | null;
        knownCompetitors?: string | null;
    },
): UserBusinessProfile {
    const profileRecord = userProfile && typeof userProfile === 'object' ? (userProfile as Record<string, unknown>) : null;
    const getString = (key: string): string | undefined => {
        const value = profileRecord?.[key];
        return typeof value === 'string' && value.trim() ? value.trim() : undefined;
    };
    const getNumber = (key: string): number | undefined => {
        const value = profileRecord?.[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    };

    const fallbackProfile: UserBusinessProfile = {
        companyName: activeWorkspace.companyName ?? user.companyName ?? '',
        legalName: activeWorkspace.legalName ?? undefined,
        tradeName: activeWorkspace.tradeName ?? undefined,
        cnpj: activeWorkspace.cnpj ?? undefined,
        primaryCnaeCode: activeWorkspace.primaryCnaeCode ?? undefined,
        primaryCnaeDescription: activeWorkspace.primaryCnaeDescription ?? undefined,
        companySize: activeWorkspace.companySize ?? undefined,
        foundingDate: activeWorkspace.foundingDate ?? undefined,
        productService: activeWorkspace.productService ?? user.productService ?? '',
        targetAudience: activeWorkspace.targetAudience ?? user.targetAudience ?? '',
        mainBenefit: activeWorkspace.mainBenefit ?? user.mainBenefit ?? '',
        postalCode: activeWorkspace.postalCode ?? undefined,
        neighborhood: activeWorkspace.neighborhood ?? undefined,
        city: activeWorkspace.city ?? undefined,
        state: activeWorkspace.state ?? undefined,
        websiteUrl: activeWorkspace.websiteUrl ?? undefined,
        linkedInUrl: activeWorkspace.linkedInUrl ?? undefined,
        instagramUrl: activeWorkspace.instagramUrl ?? undefined,
        facebookUrl: activeWorkspace.facebookUrl ?? undefined,
        serviceModel: activeWorkspace.serviceModel ?? undefined,
        averageTicket: activeWorkspace.averageTicket ?? undefined,
        operationRadiusKm: activeWorkspace.operationRadiusKm ?? undefined,
        knownCompetitors: activeWorkspace.knownCompetitors ?? undefined,
    };

    if (userProfile) {
        return {
            companyName: getString('companyName') ?? fallbackProfile.companyName,
            legalName: getString('legalName') ?? fallbackProfile.legalName,
            tradeName: getString('tradeName') ?? fallbackProfile.tradeName,
            cnpj: getString('cnpj') ?? fallbackProfile.cnpj,
            primaryCnaeCode: getString('primaryCnaeCode') ?? fallbackProfile.primaryCnaeCode,
            primaryCnaeDescription: getString('primaryCnaeDescription') ?? fallbackProfile.primaryCnaeDescription,
            companySize: getString('companySize') ?? fallbackProfile.companySize,
            foundingDate: getString('foundingDate') ?? fallbackProfile.foundingDate,
            productService: getString('productService') ?? fallbackProfile.productService,
            targetAudience: getString('targetAudience') ?? fallbackProfile.targetAudience,
            mainBenefit: getString('mainBenefit') ?? fallbackProfile.mainBenefit,
            postalCode: getString('postalCode') ?? fallbackProfile.postalCode,
            neighborhood: getString('neighborhood') ?? fallbackProfile.neighborhood,
            city: getString('city') ?? fallbackProfile.city,
            state: getString('state') ?? fallbackProfile.state,
            websiteUrl: getString('websiteUrl') ?? fallbackProfile.websiteUrl,
            linkedInUrl: getString('linkedInUrl') ?? fallbackProfile.linkedInUrl,
            instagramUrl: getString('instagramUrl') ?? fallbackProfile.instagramUrl,
            facebookUrl: getString('facebookUrl') ?? fallbackProfile.facebookUrl,
            serviceModel: getString('serviceModel') ?? fallbackProfile.serviceModel,
            averageTicket: getNumber('averageTicket') ?? fallbackProfile.averageTicket,
            operationRadiusKm: getNumber('operationRadiusKm') ?? fallbackProfile.operationRadiusKm,
            knownCompetitors: getString('knownCompetitors') ?? fallbackProfile.knownCompetitors,
        };
    }
    return fallbackProfile;
}

/**
 * Pre-check: validates auth, limits, existing analysis cache.
 * Returns { cached: AnalyzeOutput } if already analyzed (no AI needed).
 * Throws AnalyzeHttpError on limit/onboarding violations.
 * Returns { cached: null } if analysis needs to run.
 */
export async function runAnalyzePreChecks(input: AnalyzeInput, userId: string): Promise<{ cached: AnalyzeOutput | null }> {
    const { placeId: rawPlaceId } = input;

    const isGooglePlaceId = rawPlaceId.startsWith('ChIJ') || rawPlaceId.startsWith('Eh');
    let placeId = rawPlaceId;
    if (!isGooglePlaceId) {
        const lead = await prisma.lead.findUnique({ where: { id: rawPlaceId }, select: { placeId: true } });
        if (lead?.placeId) placeId = lead.placeId;
    }

    const redisCached = await getCached<AnalyzeOutput>(buildAnalyzeResultCacheKey(userId, placeId));
    if (redisCached) return { cached: redisCached };

    const { activeWorkspace, membership } = await getUserAndWorkspaceOrThrow(userId);

    try {
        await checkMemberLimits(
            prisma,
            {
                dailyLeadsLimit: membership.dailyLeadsLimit,
                weeklyLeadsLimit: membership.weeklyLeadsLimit,
                monthlyLeadsLimit: membership.monthlyLeadsLimit,
            },
            activeWorkspace.id,
            userId,
        );
    } catch (err) {
        if (err instanceof MemberLimitExceededError) {
            throw new AnalyzeHttpError(403, {
                error: err.message,
                code: err.code,
                period: err.period,
                used: err.used,
                limit: err.limit,
            });
        }
        throw err;
    }

    const existingAnalysis = await prisma.leadAnalysis.findFirst({
        where: { userId, lead: { placeId } },
        include: { lead: true },
    });
    if (existingAnalysis) {
        const mapped = mapExistingAnalysisToOutput(existingAnalysis);
        await setCached(buildAnalyzeResultCacheKey(userId, placeId), mapped, getAnalyzeResultCacheTtlSeconds());
        return { cached: mapped };
    }

    if (activeWorkspace.leadsUsed >= activeWorkspace.leadsLimit) {
        throw new AnalyzeHttpError(403, {
            error: 'Limit reached',
            code: 'LIMIT_EXCEEDED',
            details: `Used: ${activeWorkspace.leadsUsed}, Limit: ${activeWorkspace.leadsLimit}`,
        });
    }

    return { cached: null };
}

export async function runAnalyze(input: AnalyzeInput, userId: string, onProgress?: AnalyzeProgressCallback): Promise<AnalyzeOutput> {
    const { userProfile, locale, placeId: rawPlaceId, name: businessName, ...rest } = input;

    // If placeId is a Prisma CUID (from pipeline/leads navigation), resolve to Google Place ID.
    const isGooglePlaceId = rawPlaceId.startsWith('ChIJ') || rawPlaceId.startsWith('Eh');
    let placeId = rawPlaceId;
    if (!isGooglePlaceId) {
        const lead = await prisma.lead.findUnique({ where: { id: rawPlaceId }, select: { placeId: true } });
        if (lead?.placeId) placeId = lead.placeId;
    }
    const businessData = { ...rest, placeId, name: businessName };

    const redisCached = await getCached<AnalyzeOutput>(buildAnalyzeResultCacheKey(userId, placeId));
    if (redisCached) return redisCached;

    const { user, activeWorkspace, membership } = await getUserAndWorkspaceOrThrow(userId);

    try {
        await checkMemberLimits(
            prisma,
            {
                dailyLeadsLimit: membership.dailyLeadsLimit,
                weeklyLeadsLimit: membership.weeklyLeadsLimit,
                monthlyLeadsLimit: membership.monthlyLeadsLimit,
            },
            activeWorkspace.id,
            userId,
        );
    } catch (err) {
        if (err instanceof MemberLimitExceededError) {
            throw new AnalyzeHttpError(403, {
                error: err.message,
                code: err.code,
                period: err.period,
                used: err.used,
                limit: err.limit,
            });
        }
        throw err;
    }

    const existingAnalysis = await prisma.leadAnalysis.findFirst({
        where: { userId, lead: { placeId: businessData.placeId } },
        include: { lead: true },
    });
    if (existingAnalysis) {
        const mapped = mapExistingAnalysisToOutput(existingAnalysis);
        await setCached(buildAnalyzeResultCacheKey(userId, businessData.placeId), mapped, getAnalyzeResultCacheTtlSeconds());
        return mapped;
    }

    if (activeWorkspace.leadsUsed >= activeWorkspace.leadsLimit) {
        throw new AnalyzeHttpError(403, {
            error: 'Limit reached',
            code: 'LIMIT_EXCEEDED',
            details: `Used: ${activeWorkspace.leadsUsed}, Limit: ${activeWorkspace.leadsLimit}`,
        });
    }

    const isBusinessPlan = activeWorkspace.plan === 'BUSINESS' || activeWorkspace.plan === 'SCALE';
    const profile = buildAnalyzeProfile(userProfile, user, activeWorkspace);

    // Enrich businessData with RF (Receita Federal) data from Lead table
    const leadRfData = await prisma.lead.findUnique({
        where: { placeId: businessData.placeId },
        select: {
            cnpj: true,
            companyLegalName: true,
            companyTradeName: true,
            companyPorte: true,
            companyCapitalSocial: true,
            companyMainCnae: true,
            cnpjStatus: true,
            cnpjOpenedAt: true,
            email: true,
            matchConfidence: true,
            matchMethod: true,
        },
    });
    if (leadRfData) {
        (businessData as BusinessData).cnpj = leadRfData.cnpj ?? undefined;
        (businessData as BusinessData).companyLegalName = leadRfData.companyLegalName ?? undefined;
        (businessData as BusinessData).companyTradeName = leadRfData.companyTradeName ?? undefined;
        (businessData as BusinessData).companyPorte = leadRfData.companyPorte ?? undefined;
        (businessData as BusinessData).companyCapitalSocial = leadRfData.companyCapitalSocial ?? undefined;
        (businessData as BusinessData).companyMainCnae = leadRfData.companyMainCnae ?? undefined;
        (businessData as BusinessData).cnpjStatus = leadRfData.cnpjStatus ?? undefined;
        (businessData as BusinessData).cnpjOpenedAt = leadRfData.cnpjOpenedAt ?? undefined;
        (businessData as BusinessData).rfEmail = leadRfData.email ?? undefined;
        (businessData as BusinessData).matchConfidence = leadRfData.matchConfidence ?? undefined;
        (businessData as BusinessData).matchMethod = leadRfData.matchMethod ?? undefined;
    }

    const { config } = await resolveAiForRole('lead_analysis');
    const { logger } = await import('@/lib/logger');
    const analyzeStart = Date.now();
    logger.info('Analyze using AI provider', { provider: config.provider, role: 'lead_analysis', placeId: businessData.placeId });

    const result = await analyzeLead(
        businessData as BusinessData,
        profile,
        locale || 'pt',
        userId,
        isBusinessPlan,
        { workspaceId: activeWorkspace.id, userId },
        onProgress
    );

    const durationMs = Date.now() - analyzeStart;
    logger.info('Analyze completed', {
        provider: result.provider ?? config.provider,
        model: result.model ?? config.model,
        durationMs,
        hasUsage: !!result.usage,
        placeId: businessData.placeId,
    });

    if (result.usage) {
        recordUsageEvent({
            workspaceId: activeWorkspace.id,
            userId,
            type: 'AI_TOKENS',
            quantity: 1,
            metadata: {
                provider: result.provider ?? config.provider,
                model: result.model ?? config.model,
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
            },
        });
    }

    await prisma.workspace.update({
        where: { id: activeWorkspace.id },
        data: { leadsUsed: { increment: 1 } },
    });

    await prisma.leadAnalysis.updateMany({
        where: { userId, workspaceId: null },
        data: { workspaceId: activeWorkspace.id },
    });

    const output = { ...result.analysis, aiProvider: result.provider ?? config.provider } as AnalyzeOutput;
    await setCached(buildAnalyzeResultCacheKey(userId, businessData.placeId), output, getAnalyzeResultCacheTtlSeconds());
    return output;
}
