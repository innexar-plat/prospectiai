import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { teamInviteSchema, formatZodError } from '@/lib/validations/schemas';
import { sendTeamInviteEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

const SITE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** POST /api/team/invite — cria convite pendente e envia email; usuário só entra ao aceitar. */
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
        const email = parsed.data.email.trim().toLowerCase();

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { workspaces: { take: 1, include: { workspace: { select: { name: true } } } } },
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

        const existingMember = await prisma.workspaceMember.findFirst({
            where: {
                workspaceId: activeWorkspaceId,
                user: { email },
            },
        });
        if (existingMember) {
            return NextResponse.json({ error: 'User is already in this workspace' }, { status: 400 });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const baseUrl = SITE_URL.replace(/\/$/, '');
        const acceptInviteUrl = `${baseUrl}/accept-invite?token=${encodeURIComponent(token)}`;

        const invitation = await prisma.workspaceInvitation.upsert({
            where: {
                email_workspaceId: { email, workspaceId: activeWorkspaceId },
            },
            create: {
                email,
                workspaceId: activeWorkspaceId,
                invitedById: session.user.id,
                token,
                status: 'PENDING',
            },
            update: {
                token,
                lastSentAt: new Date(),
                status: 'PENDING',
            },
        });

        sendTeamInviteEmail(email, inviterName, workspaceName, acceptInviteUrl)
            .then((result) => {
                if (!result.sent) {
                    logger.warn('Team invite email not sent', { email, reason: result.error ?? 'no config' });
                } else {
                    logger.info('Team invite email sent', { email });
                }
            })
            .catch((err) => {
                logger.error('Team invite email failed', { email, error: err instanceof Error ? err.message : 'Unknown' });
            });

        return NextResponse.json({
            ok: true,
            pendingInvite: {
                id: invitation.id,
                email: invitation.email,
                createdAt: invitation.createdAt.toISOString(),
                lastSentAt: invitation.lastSentAt.toISOString(),
            },
        });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error inviting Workspace Member', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
