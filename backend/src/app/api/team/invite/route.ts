import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { teamInviteSchema, formatZodError } from '@/lib/validations/schemas';
import { sendTeamInviteEmail } from '@/lib/email';
import { createNotification } from '@/lib/notification-service';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const parsed = teamInviteSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const { email } = parsed.data;

        // 1. Get the current user's workspace (with workspace name for invite email)
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { workspaces: { take: 1, include: { workspace: { select: { name: true } } } } }
        });

        const activeWorkspaceId = currentUser?.workspaces[0]?.workspaceId;
        const currentUserRole = currentUser?.workspaces[0]?.role;
        const workspaceName = currentUser?.workspaces[0]?.workspace?.name ?? 'Workspace';
        const inviterName = currentUser?.name ?? currentUser?.email ?? 'A team member';

        if (!activeWorkspaceId) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        if (currentUserRole !== 'OWNER' && currentUserRole !== 'ADMIN') {
            return NextResponse.json({ error: 'Only owners or admins can invite members' }, { status: 403 });
        }

        // 2. Check if the invited email already exists in the entire system
        let invitedUser = await prisma.user.findUnique({
            where: { email },
            include: { workspaces: true }
        });

        if (invitedUser) {
            // Check if they are already in THIS workspace
            const alreadyInWorkspace = invitedUser.workspaces.some(w => w.workspaceId === activeWorkspaceId);
            if (alreadyInWorkspace) {
                return NextResponse.json({ error: 'User is already in this workspace' }, { status: 400 });
            }

            // A user can technically belong to multiple workspaces, but right now our UI only supports 1
            // If they are in another workspace, we might need to handle workspace switching in the future.
            // For now, let's just add them as a MEMBER to this new workspace as well.
        } else {
            // 3. User doesn't exist. Create a placeholder user record so they can log in later.
            invitedUser = await prisma.user.create({
                data: {
                    email,
                    name: email.split('@')[0], // Give a default name
                },
                include: { workspaces: true }
            });
        }

        // 4. Add the user to the WorkspaceMember table
        const newMember = await prisma.workspaceMember.create({
            data: {
                workspaceId: activeWorkspaceId,
                userId: invitedUser.id,
                role: 'MEMBER'
            },
            include: { user: { select: { id: true, name: true, email: true } } }
        });

        sendTeamInviteEmail(email, inviterName, workspaceName).catch(() => {});

        createNotification({
            userId: invitedUser.id,
            workspaceId: activeWorkspaceId,
            title: 'Você foi convidado para um workspace',
            message: `${inviterName} convidou você para "${workspaceName}". Faça login para acessar.`,
            type: 'INFO',
            link: '/auth/signin',
            sendEmailIfPreferred: true,
            channel: 'team_invite',
        }).catch((err) =>
            import('@/lib/logger').then(({ logger }) => logger.error('Create notification after invite', { error: err instanceof Error ? err.message : 'Unknown' }))
        );

        return NextResponse.json(newMember);
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error inviting Workspace Member', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
