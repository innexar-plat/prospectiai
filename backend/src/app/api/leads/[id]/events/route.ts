import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/leads/[id]/events
 *
 * Returns the event timeline for a specific lead.
 * Used to show score evolution, status changes, and interaction history.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: leadId } = await params;

        // Verify user has access to this lead (via LeadAnalysis)
        const hasAccess = await prisma.leadAnalysis.findFirst({
            where: { leadId, userId: session.user.id },
            select: { id: true },
        });

        if (!hasAccess) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const events = await prisma.leadEvent.findMany({
            where: { leadId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        return NextResponse.json({ events });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Lead events error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
