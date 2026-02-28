import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';

type MemberWithUser = Awaited<ReturnType<typeof prisma.workspaceMember.findMany>>[number] & {
    user: { id: string; name: string | null; email: string | null; image: string | null };
};

function buildDashboardRows(
    members: MemberWithUser[],
    todaySearchMap: Map<string, number>,
    todayAnalysisMap: Map<string, number>,
    monthSearchMap: Map<string, number>,
    monthAnalysisMap: Map<string, number>,
    monthActionMap: Map<string, number>,
    now: Date,
) {
    return members.map((m) => {
        const uid = m.user.id;
        const todayLeads = todaySearchMap.get(uid) ?? 0;
        const todayAnal = todayAnalysisMap.get(uid) ?? 0;
        const monthLeads = monthSearchMap.get(uid) ?? 0;
        const monthAnal = monthAnalysisMap.get(uid) ?? 0;
        const monthActs = monthActionMap.get(uid) ?? 0;
        const dailyLeadsPct = m.dailyLeadsGoal ? Math.round((todayLeads / m.dailyLeadsGoal) * 100) : null;
        const dailyAnalysesPct = m.dailyAnalysesGoal ? Math.round((todayAnal / m.dailyAnalysesGoal) * 100) : null;
        const monthlyConvPct = m.monthlyConversionsGoal ? Math.round((monthActs / m.monthlyConversionsGoal) * 100) : null;
        const isAfternoon = now.getHours() >= 12;
        const belowGoal = isAfternoon && (
            (dailyLeadsPct !== null && dailyLeadsPct < 50) ||
            (dailyAnalysesPct !== null && dailyAnalysesPct < 50)
        );
        return {
            memberId: m.id,
            userId: uid,
            name: m.user.name || 'Sem nome',
            email: m.user.email,
            image: m.user.image,
            role: m.role,
            goals: {
                dailyLeadsGoal: m.dailyLeadsGoal,
                dailyAnalysesGoal: m.dailyAnalysesGoal,
                monthlyConversionsGoal: m.monthlyConversionsGoal,
            },
            today: { leads: todayLeads, analyses: todayAnal },
            month: { leads: monthLeads, analyses: monthAnal, actions: monthActs },
            progress: { dailyLeadsPct, dailyAnalysesPct, monthlyConvPct },
            belowGoal,
        };
    });
}

/**
 * GET /api/team/dashboard — Gestor/Admin view with all members' progress vs goals.
 */
export async function GET(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const caller = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            include: { workspace: true },
        });

        if (!caller) {
            return jsonWithRequestId({ error: 'No workspace found' }, { status: 404, requestId });
        }

        if (!['OWNER', 'ADMIN'].includes(caller.role)) {
            return jsonWithRequestId({ error: 'Only admins can view team dashboard' }, { status: 403, requestId });
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const members = await prisma.workspaceMember.findMany({
            where: { workspaceId: caller.workspaceId },
            include: {
                user: { select: { id: true, name: true, email: true, image: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        const userIds = members.map((m) => m.user.id);

        // Today: searches per user
        const todaySearches = await prisma.searchHistory.groupBy({
            by: ['userId'],
            where: { workspaceId: caller.workspaceId, userId: { in: userIds }, createdAt: { gte: todayStart } },
            _count: { id: true },
        });
        const todaySearchMap = new Map(todaySearches.map((s) => [s.userId, s._count.id]));

        // Today: analyses per user
        const todayAnalyses = await prisma.leadAnalysis.groupBy({
            by: ['userId'],
            where: { workspaceId: caller.workspaceId, userId: { in: userIds }, createdAt: { gte: todayStart } },
            _count: { id: true },
        });
        const todayAnalysisMap = new Map(todayAnalyses.map((a) => [a.userId, a._count.id]));

        // Month: searches per user
        const monthSearches = await prisma.searchHistory.groupBy({
            by: ['userId'],
            where: { workspaceId: caller.workspaceId, userId: { in: userIds }, createdAt: { gte: monthStart } },
            _count: { id: true },
        });
        const monthSearchMap = new Map(monthSearches.map((s) => [s.userId, s._count.id]));

        // Month: analyses per user
        const monthAnalyses = await prisma.leadAnalysis.groupBy({
            by: ['userId'],
            where: { workspaceId: caller.workspaceId, userId: { in: userIds }, createdAt: { gte: monthStart } },
            _count: { id: true },
        });
        const monthAnalysisMap = new Map(monthAnalyses.map((a) => [a.userId, a._count.id]));

        // Month: actions per user
        const monthActions = await prisma.auditLog.groupBy({
            by: ['userId'],
            where: { userId: { in: userIds }, createdAt: { gte: monthStart } },
            _count: { id: true },
        });
        const monthActionMap = new Map(monthActions.map((a) => [a.userId, a._count.id]));

        const dashboard = buildDashboardRows(
            members,
            todaySearchMap,
            todayAnalysisMap,
            monthSearchMap,
            monthAnalysisMap,
            monthActionMap,
            now,
        );

        const teamTotals = {
            todayLeads: dashboard.reduce((s, m) => s + m.today.leads, 0),
            todayAnalyses: dashboard.reduce((s, m) => s + m.today.analyses, 0),
            monthLeads: dashboard.reduce((s, m) => s + m.month.leads, 0),
            monthAnalyses: dashboard.reduce((s, m) => s + m.month.analyses, 0),
            monthActions: dashboard.reduce((s, m) => s + m.month.actions, 0),
            membersCount: dashboard.length,
            belowGoalCount: dashboard.filter((m) => m.belowGoal).length,
        };

        return jsonWithRequestId({ members: dashboard, totals: teamTotals }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Team dashboard error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
