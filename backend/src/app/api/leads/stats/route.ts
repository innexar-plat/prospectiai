import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userWithWorkspace = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { workspaces: { take: 1 } },
        });
        const workspaceId = userWithWorkspace?.workspaces[0]?.workspaceId;
        const filter = workspaceId ? { workspaceId } : { userId: session.user.id };

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const [total, highScore, favorites, searchesThisMonth] = await Promise.all([
            prisma.leadAnalysis.count({ where: filter }),
            prisma.leadAnalysis.count({ where: { ...filter, score: { gte: 60 } } }),
            prisma.leadAnalysis.count({ where: { ...filter, isFavorite: true } }),
            prisma.searchHistory.count({
                where: {
                    ...(workspaceId ? { workspaceId } : { userId: session.user.id }),
                    createdAt: { gte: startOfMonth },
                },
            }),
        ]);

        return NextResponse.json({ total, highScore, favorites, searchesThisMonth });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error fetching lead stats', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
