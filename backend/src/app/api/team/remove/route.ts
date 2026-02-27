import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { teamRemoveSchema, formatZodError } from '@/lib/validations/schemas';

export async function DELETE(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const parsed = teamRemoveSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const { userIdToRemove } = parsed.data;

        if (userIdToRemove === session.user.id) {
            return NextResponse.json({ error: 'You cannot remove yourself. Ask another admin or contact support.' }, { status: 400 });
        }

        // 1. Get the current user's workspace
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { workspaces: { take: 1 } }
        });

        const activeWorkspaceId = currentUser?.workspaces[0]?.workspaceId;
        const currentUserRole = currentUser?.workspaces[0]?.role;

        if (!activeWorkspaceId) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        if (currentUserRole !== 'OWNER' && currentUserRole !== 'ADMIN') {
            return NextResponse.json({ error: 'Only owners or admins can remove members' }, { status: 403 });
        }

        // 2. Remove the user from the Workspace
        const removed = await prisma.workspaceMember.deleteMany({
            where: {
                workspaceId: activeWorkspaceId,
                userId: userIdToRemove,
                // Ensure we never accidentally delete another OWNER via this endpoint just in case
                role: { not: 'OWNER' }
            }
        });

        if (removed.count === 0) {
            return NextResponse.json({ error: 'Member not found or cannot be removed (Owner)' }, { status: 400 });
        }

        return NextResponse.json({ success: true, removedUserId: userIdToRemove });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error removing Workspace Member', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
