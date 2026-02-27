import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userWithWorkspace = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { workspaces: { take: 1 } }
        });

        const workspaceId = userWithWorkspace?.workspaces[0]?.workspaceId;

        // If no workspace yet (should not happen after migration), fallback to their personal userId
        const filter = workspaceId ? { workspaceId } : { userId: session.user.id };

        const analyses = await prisma.leadAnalysis.findMany({
            where: filter,
            include: { lead: true },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(analyses);
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error fetching leads', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
