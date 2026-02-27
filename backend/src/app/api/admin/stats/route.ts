import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const [users, workspaces, searchHistory, leadAnalyses, usageAgg] = await Promise.all([
            prisma.user.count(),
            prisma.workspace.count(),
            prisma.searchHistory.count(),
            prisma.leadAnalysis.count(),
            prisma.usageEvent.groupBy({
                by: ['type'],
                _sum: { quantity: true },
            }),
        ]);

        const byType = Object.fromEntries(usageAgg.map((r) => [r.type, r._sum.quantity ?? 0]));
        const googlePlacesSearchTotal = byType.GOOGLE_PLACES_SEARCH ?? 0;
        const googlePlacesDetailsTotal = byType.GOOGLE_PLACES_DETAILS ?? 0;
        const serperRequestsTotal = byType.SERPER_REQUEST ?? 0;

        const aiEvents = await prisma.usageEvent.findMany({
            where: { type: 'AI_TOKENS' },
            select: { metadata: true },
        });
        let aiInputTokensTotal = 0;
        let aiOutputTokensTotal = 0;
        for (const e of aiEvents) {
            const m = e.metadata as { inputTokens?: number; outputTokens?: number } | null;
            if (m) {
                aiInputTokensTotal += Number(m.inputTokens) || 0;
                aiOutputTokensTotal += Number(m.outputTokens) || 0;
            }
        }

        const payload = {
            users,
            workspaces,
            searchHistory,
            leadAnalyses,
            googlePlacesSearchTotal,
            googlePlacesDetailsTotal,
            serperRequestsTotal,
            aiInputTokensTotal,
            aiOutputTokensTotal,
        };
        logAdminAction(session, 'admin.stats', { details: payload }).catch(() => {});
        return NextResponse.json(payload);
    } catch (e) {
        const { logger } = await import('@/lib/logger');
        logger.error('Admin stats error', { error: e instanceof Error ? e.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
