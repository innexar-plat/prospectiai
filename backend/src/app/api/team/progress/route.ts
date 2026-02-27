import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';

/**
 * GET /api/team/progress — Current user's daily and monthly progress + goals.
 * Used to show the vendedor their personal dashboard with meta cards.
 */
export async function GET(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const membership = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            include: { workspace: true },
        });

        if (!membership) {
            return jsonWithRequestId({ error: 'No workspace found' }, { status: 404, requestId });
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Today's search count (leads prospected)
        const todaySearches = await prisma.searchHistory.count({
            where: {
                userId: session.user.id,
                workspaceId: membership.workspaceId,
                createdAt: { gte: todayStart },
            },
        });

        // Today's analyses
        const todayAnalyses = await prisma.leadAnalysis.count({
            where: {
                userId: session.user.id,
                workspaceId: membership.workspaceId,
                createdAt: { gte: todayStart },
            },
        });

        // Monthly totals
        const monthSearches = await prisma.searchHistory.count({
            where: {
                userId: session.user.id,
                workspaceId: membership.workspaceId,
                createdAt: { gte: monthStart },
            },
        });

        const monthAnalyses = await prisma.leadAnalysis.count({
            where: {
                userId: session.user.id,
                workspaceId: membership.workspaceId,
                createdAt: { gte: monthStart },
            },
        });

        // Monthly actions (audit log entries as proxy for pipeline activity)
        const monthActions = await prisma.auditLog.count({
            where: {
                userId: session.user.id,
                createdAt: { gte: monthStart },
            },
        });

        // Streak: count consecutive days (up to 30) where user had at least 1 search
        let streak = 0;
        for (let d = 0; d < 30; d++) {
            const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
            const dayEnd = new Date(dayStart.getTime() + 86400000);
            const count = await prisma.searchHistory.count({
                where: {
                    userId: session.user.id,
                    workspaceId: membership.workspaceId,
                    createdAt: { gte: dayStart, lt: dayEnd },
                },
            });
            if (count > 0) {
                streak++;
            } else if (d > 0) {
                // Skip today if no activity yet, but break on previous days
                break;
            }
        }

        // Mini ranking: get all workspace members' monthly totals
        const allMembers = await prisma.workspaceMember.findMany({
            where: { workspaceId: membership.workspaceId },
            select: { userId: true, user: { select: { name: true } } },
        });

        const memberSearchCounts = await prisma.searchHistory.groupBy({
            by: ['userId'],
            where: {
                workspaceId: membership.workspaceId,
                userId: { in: allMembers.map((m) => m.userId) },
                createdAt: { gte: monthStart },
            },
            _count: { id: true },
        });

        const searchMap = new Map(memberSearchCounts.map((c) => [c.userId, c._count.id]));
        const ranking = allMembers
            .map((m) => ({
                userId: m.userId,
                name: m.user.name || 'Sem nome',
                monthlySearches: searchMap.get(m.userId) ?? 0,
            }))
            .sort((a, b) => b.monthlySearches - a.monthlySearches);

        const myRank = ranking.findIndex((r) => r.userId === session.user.id) + 1;

        return jsonWithRequestId({
            goals: {
                dailyLeadsGoal: membership.dailyLeadsGoal,
                dailyAnalysesGoal: membership.dailyAnalysesGoal,
                monthlyConversionsGoal: membership.monthlyConversionsGoal,
            },
            today: {
                searches: todaySearches,
                analyses: todayAnalyses,
            },
            month: {
                searches: monthSearches,
                analyses: monthAnalyses,
                actions: monthActions,
            },
            streak,
            ranking: {
                position: myRank,
                total: ranking.length,
                top5: ranking.slice(0, 5),
            },
        }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Team progress error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
