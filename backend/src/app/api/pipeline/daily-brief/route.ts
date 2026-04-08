import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getConversionStats } from '@/lib/lead-intelligence';

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
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

        // Find user's workspace
        const membership = await prisma.workspaceMember.findFirst({
            where: { userId },
            select: { workspaceId: true, workspace: { select: { plan: true } } },
        });
        const workspaceId = membership?.workspaceId;
        const plan = membership?.workspace?.plan || 'FREE';

        // Check plan access (PRO+)
        if (!['PRO', 'BUSINESS', 'SCALE'].includes(plan)) {
            return NextResponse.json({ error: 'Pipeline intelligence is available for PRO+ plans' }, { status: 403 });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check cache
        if (workspaceId) {
            const cached = await prisma.pipelineBrief.findUnique({
                where: { workspaceId_briefDate: { workspaceId, briefDate: today } },
            });
            if (cached) {
                return NextResponse.json(cached);
            }
        }

        // Build fresh brief
        const where = workspaceId ? { workspaceId } : { userId };

        // Get active leads (not CONVERTED/LOST) with close probability
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

        // Get conversion stats
        const stats = await getConversionStats(userId, workspaceId || undefined);

        // Build recommendations
        const recommendations = activeLeads
            .slice(0, 10)
            .map((lead, i) => {
                // Determine reason for recommendation
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

        // Compute funnel stats
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

        // Cache the brief
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
        logger.error('Pipeline daily-brief error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
