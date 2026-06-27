import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getConversionStats } from '@/lib/lead-intelligence';
import { classifyRouteError } from '@/lib/api-route-errors';
import { MARKET, getRequestMarket } from '@/lib/market';

/**
 * GET /api/pipeline/stats
 *
 * Returns conversion statistics for the user/workspace.
 * Used for the pipeline dashboard KPIs.
 */
export async function GET(req?: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const membership = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            select: { workspaceId: true },
        });

        const stats = await getConversionStats(session.user.id, membership?.workspaceId);
        return NextResponse.json(stats);
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        const market = req ? getRequestMarket(req) : MARKET;
        const classified = classifyRouteError(error, 'Internal Server Error', market);
        logger.error('Pipeline stats error', { error: error instanceof Error ? error.message : 'Unknown', status: classified.status });
        return NextResponse.json({ error: classified.message }, { status: classified.status });
    }
}
