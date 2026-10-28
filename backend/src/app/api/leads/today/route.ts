import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { getTodayAgenda } from '@/lib/sales-routine';

/**
 * GET /api/leads/today?tz=<Date#getTimezoneOffset>
 * Sales routine: due follow-ups + best uncontacted saved leads (workspace-scoped).
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getApiSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tzRaw = Number(req.nextUrl.searchParams.get('tz'));
        const tz = Number.isFinite(tzRaw) && Math.abs(tzRaw) <= 14 * 60 ? tzRaw : undefined;

        const membership = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            orderBy: { workspace: { createdAt: 'asc' } },
            select: { workspaceId: true },
        });

        const agenda = await getTodayAgenda({ userId: session.user.id, workspaceId: membership?.workspaceId }, new Date(), tz);
        return NextResponse.json(agenda);
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error loading sales agenda', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
