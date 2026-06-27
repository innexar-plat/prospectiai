import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getConversionStats } from '@/lib/lead-intelligence';
import { classifyRouteError } from '@/lib/api-route-errors';
import { MARKET, getRequestMarket } from '@/lib/market';
import type { ProductPlan } from '@/lib/product-modules';

const PRO_PLUS_PLANS: ProductPlan[] = ['PRO', 'BUSINESS', 'SCALE'];

type BriefStats = {
    totalActive: number;
    hotLeads: number;
    avgCloseProbability: number;
    pipelineValue: number;
    conversionRate: number | null;
    avgDealValue: number | null;
    avgCycleDays: number | null;
    totalConverted: number;
    totalLost: number;
    topLostReasons: { reason: string; count: number }[];
};

function emptyBriefStats(): BriefStats {
    return {
        totalActive: 0,
        hotLeads: 0,
        avgCloseProbability: 0,
        pipelineValue: 0,
        conversionRate: null,
        avgDealValue: null,
        avgCycleDays: null,
        totalConverted: 0,
        totalLost: 0,
        topLostReasons: [],
    };
}

function normalizeCachedBrief(cached: {
    recommendations: unknown;
    stats: unknown;
}): { recommendations: unknown[]; stats: BriefStats } {
    const stats = cached.stats as BriefStats | null | undefined;
    return {
        recommendations: Array.isArray(cached.recommendations) ? cached.recommendations : [],
        stats: stats && typeof stats === 'object' ? stats : emptyBriefStats(),
    };
}

/**
 * GET /api/pipeline/daily-brief
 *
 * AI-powered daily pipeline briefing:
 * - Top leads to contact today (ranked by closeProbability + recency)
 * - Conversion funnel stats
 * - Actionable insights
 *
 * Cached per workspace per day via PipelineBrief table.
 */
export async function GET(req?: NextRequest) {
    try {
        let session;
        try {
            session = await auth();
        } catch (authErr) {
            const { logger } = await import('@/lib/logger');
            logger.error('Pipeline daily-brief auth error', {
                error: authErr instanceof Error ? authErr.message : 'Unknown',
            });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

        const [membership, user] = await Promise.all([
            prisma.workspaceMember.findFirst({
                where: { userId },
                select: { workspaceId: true, workspace: { select: { plan: true } } },
            }),
            prisma.user.findUnique({
                where: { id: userId },
                select: { plan: true },
            }),
        ]);

        const workspaceId = membership?.workspaceId;
        const plan = (membership?.workspace?.plan ?? user?.plan ?? 'FREE') as ProductPlan;

        if (!PRO_PLUS_PLANS.includes(plan)) {
            return NextResponse.json({ error: 'Pipeline intelligence is available for PRO+ plans' }, { status: 403 });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (workspaceId) {
            const cached = await prisma.pipelineBrief.findUnique({
                where: { workspaceId_briefDate: { workspaceId, briefDate: today } },
                select: { recommendations: true, stats: true },
            });
            if (cached) {
                return NextResponse.json(normalizeCachedBrief(cached));
            }
        }

        const where = workspaceId ? { workspaceId } : { userId };

        const activeLeads = await prisma.leadAnalysis.findMany({
            where: { ...where, status: { in: ['NEW', 'CONTACTED'] } },
            select: {
                id: true,
                score: true,
                scoreLabel: true,
                status: true,
                closeProbability: true,
                estimatedDealValue: true,
                bestContactWindow: true,
                summary: true,
                contactedAt: true,
                createdAt: true,
                lead: { select: { id: true, placeId: true, name: true, phone: true, website: true, types: true, rating: true } },
            },
            orderBy: [
                { closeProbability: 'desc' },
                { score: 'desc' },
            ],
            take: 100,
        });

        const stats = await getConversionStats(userId, workspaceId || undefined);

        const recommendations = activeLeads
            .filter((lead) => lead.lead != null)
            .slice(0, 10)
            .map((lead, i) => {
                const reasons: string[] = [];
                if (lead.closeProbability && lead.closeProbability >= 70) reasons.push('Alta probabilidade de fechamento');
                if (lead.status === 'CONTACTED' && lead.contactedAt) {
                    const daysSinceContact = Math.floor((Date.now() - lead.contactedAt.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysSinceContact >= 3 && daysSinceContact <= 7) reasons.push(`Follow-up: ${daysSinceContact} dias desde último contato`);
                    if (daysSinceContact > 7) reasons.push(`⚠️ ${daysSinceContact} dias sem contato — risco de esfriar`);
                }
                if (lead.estimatedDealValue && lead.estimatedDealValue >= (stats.avgDealValue || 500) * 1.5) {
                    reasons.push('Deal acima da média');
                }
                if (!lead.lead.website) reasons.push('Sem website (oportunidade digital)');
                if (lead.scoreLabel === 'Muito Quente' || lead.scoreLabel === 'Very Hot') reasons.push('Lead muito quente');
                if (reasons.length === 0) reasons.push('Score favorável');

                return {
                    rank: i + 1,
                    leadId: lead.lead.id,
                    leadPlaceId: lead.lead.placeId,
                    analysisId: lead.id,
                    leadName: lead.lead.name,
                    phone: lead.lead.phone,
                    closeProbability: lead.closeProbability,
                    estimatedDealValue: lead.estimatedDealValue,
                    bestContactWindow: lead.bestContactWindow,
                    scoreLabel: lead.scoreLabel,
                    status: lead.status,
                    reasons,
                    suggestedAction: lead.status === 'NEW' ? 'Fazer primeiro contato' : 'Fazer follow-up',
                };
            });

        const hotLeads = activeLeads.filter((l) => (l.closeProbability ?? 0) >= 60).length;
        const pipelineValue = activeLeads.reduce((acc, l) => acc + (l.estimatedDealValue ?? 0), 0);
        const avgCloseProbability = activeLeads.length > 0
            ? Math.round(activeLeads.reduce((acc, l) => acc + (l.closeProbability ?? 0), 0) / activeLeads.length)
            : 0;

        const briefData = {
            recommendations,
            stats: {
                totalActive: activeLeads.length,
                hotLeads,
                avgCloseProbability,
                pipelineValue: Math.round(pipelineValue),
                conversionRate: stats.conversionRate,
                avgDealValue: stats.avgDealValue,
                avgCycleDays: stats.avgCycleDays,
                totalConverted: stats.converted,
                totalLost: stats.lost,
                topLostReasons: stats.topLostReasons,
            },
        };

        if (workspaceId) {
            await prisma.pipelineBrief.upsert({
                where: { workspaceId_briefDate: { workspaceId, briefDate: today } },
                create: {
                    userId,
                    workspaceId,
                    briefDate: today,
                    recommendations: JSON.parse(JSON.stringify(briefData.recommendations)),
                    stats: JSON.parse(JSON.stringify(briefData.stats)),
                },
                update: {
                    recommendations: JSON.parse(JSON.stringify(briefData.recommendations)),
                    stats: JSON.parse(JSON.stringify(briefData.stats)),
                },
            });
        }

        return NextResponse.json(briefData);
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        const market = req ? getRequestMarket(req) : MARKET;
        const classified = classifyRouteError(error, 'Internal Server Error', market);
        logger.error('Pipeline daily-brief error', {
            error: error instanceof Error ? error.message : 'Unknown',
            status: classified.status,
        });
        return NextResponse.json({ error: classified.message }, { status: classified.status });
    }
}
