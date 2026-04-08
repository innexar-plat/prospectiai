import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getConversionStats } from '@/lib/lead-intelligence';

/**
 * GET /api/pipeline/stats
 *
 * Returns conversion statistics for the user/workspace.
 * Used for the pipeline dashboard KPIs.
 */
export async function GET() {
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
        logger.error('Pipeline stats error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
