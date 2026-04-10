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
    activeWorkspace: { companyName: string | null; productService: string | null; targetAudience: string | null; mainBenefit: string | null },
): UserBusinessProfile {
    if (userProfile) {
        return {
            companyName: String(userProfile.companyName ?? ''),
            productService: String(userProfile.productService ?? ''),
            targetAudience: String(userProfile.targetAudience ?? ''),
            mainBenefit: String(userProfile.mainBenefit ?? ''),
        };
    }
    return {
        companyName: activeWorkspace.companyName ?? user.companyName ?? '',
        productService: activeWorkspace.productService ?? user.productService ?? '',
        targetAudience: activeWorkspace.targetAudience ?? user.targetAudience ?? '',
        mainBenefit: activeWorkspace.mainBenefit ?? user.mainBenefit ?? '',
    };
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
    if (existingAnalysis) return { cached: mapExistingAnalysisToOutput(existingAnalysis) };

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
    if (existingAnalysis) return mapExistingAnalysisToOutput(existingAnalysis);

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
    logger.info('Analyze completed', { provider: result.provider ?? config.provider, durationMs, hasUsage: !!result.usage, placeId: businessData.placeId });

    if (result.usage) {
        recordUsageEvent({
            workspaceId: activeWorkspace.id,
            userId,
            type: 'AI_TOKENS',
            quantity: 1,
            metadata: {
                provider: result.provider ?? config.provider,
                model: config.model,
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

    return { ...result.analysis, aiProvider: result.provider ?? config.provider } as AnalyzeOutput;
}
