/**
 * Analyze module — application layer (use-case).
 * Orchestrates cache (existing analysis), credits, Gemini and DB updates.
 * Route (api) only validates, rate-limits, authenticates and calls runAnalyze.
 */

import { analyzeLead, type BusinessData, type UserBusinessProfile } from '@/lib/gemini';
import { resolveAiForRole } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
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
};

export async function runAnalyze(input: AnalyzeInput, userId: string): Promise<AnalyzeOutput> {
    const { userProfile, locale, placeId, name: businessName, ...rest } = input;
    const businessData = { ...rest, placeId, name: businessName };

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

    if (!user || user.workspaces.length === 0) {
        throw new AnalyzeHttpError(404, { error: 'Workspace not found' });
    }

    if (user.onboardingCompletedAt == null) {
        throw new AnalyzeHttpError(403, {
            error: 'Complete onboarding before analyzing leads',
            code: 'REQUIRES_ONBOARDING',
        });
    }

    const activeWorkspace = user.workspaces[0].workspace;

    const existingAnalysis = await prisma.leadAnalysis.findFirst({
        where: {
            userId,
            lead: { placeId: businessData.placeId },
        },
        include: { lead: true },
    });

    if (existingAnalysis) {
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
            aiProvider: undefined,
        };
    }

    if (activeWorkspace.leadsUsed >= activeWorkspace.leadsLimit) {
        throw new AnalyzeHttpError(403, {
            error: 'Limit reached',
            code: 'LIMIT_EXCEEDED',
            details: `Used: ${activeWorkspace.leadsUsed}, Limit: ${activeWorkspace.leadsLimit}`,
        });
    }

    const isBusinessPlan = activeWorkspace.plan === 'BUSINESS' || activeWorkspace.plan === 'SCALE';

    // Profile: request body > workspace (one per workspace) > user fallback
    const profile: UserBusinessProfile = userProfile
        ? {
              companyName: String(userProfile.companyName ?? ''),
              productService: String(userProfile.productService ?? ''),
              targetAudience: String(userProfile.targetAudience ?? ''),
              mainBenefit: String(userProfile.mainBenefit ?? ''),
          }
        : {
              companyName: activeWorkspace.companyName ?? user.companyName ?? '',
              productService: activeWorkspace.productService ?? user.productService ?? '',
              targetAudience: activeWorkspace.targetAudience ?? user.targetAudience ?? '',
              mainBenefit: activeWorkspace.mainBenefit ?? user.mainBenefit ?? '',
          };

    const { config } = await resolveAiForRole('lead_analysis');
    const { logger } = await import('@/lib/logger');
    logger.info('Analyze using AI provider', { provider: config.provider, role: 'lead_analysis' });

    const result = await analyzeLead(
        businessData as BusinessData,
        profile,
        locale || 'pt',
        userId,
        isBusinessPlan,
        { workspaceId: activeWorkspace.id, userId }
    );

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
