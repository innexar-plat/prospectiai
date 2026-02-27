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
            include: { workspaces: { take: 1 } }
        });

        const activeWorkspaceId = userWithWorkspace?.workspaces[0]?.workspaceId;

        if (!activeWorkspaceId) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        const members = await prisma.workspaceMember.findMany({
            where: { workspaceId: activeWorkspaceId },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'asc' }
        });

        return NextResponse.json(members);
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error fetching Workspace Members', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
