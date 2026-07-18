import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { teamInviteSchema, formatZodError } from '@/lib/validations/schemas';
import { sendTeamInviteEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/ratelimit';
import { PLANS, type PlanType } from '@/lib/billing-config';
import { getSiteUrlFromRequest } from '@/lib/site-url';
import { getRequestLocale } from '@/lib/i18n/locale';

async function getInviteContext(sessionUserId: string, email: string) {
    const currentUser = await prisma.user.findUnique({
        where: { id: sessionUserId },
        include: { workspaces: { orderBy: { workspace: { createdAt: 'asc' } }, take: 1, include: { workspace: { select: { name: true, plan: true } } } } },
    });
    const activeWorkspaceId = currentUser?.workspaces[0]?.workspaceId;
    const currentUserRole = currentUser?.workspaces[0]?.role;
    const workspaceName = currentUser?.workspaces[0]?.workspace?.name ?? 'Workspace';
    const workspacePlan = (currentUser?.workspaces[0]?.workspace?.plan ?? 'FREE') as PlanType;
    const inviterName = currentUser?.name ?? currentUser?.email ?? 'A team member';
    if (!activeWorkspaceId) return { error: 'Workspace not found' as const, status: 404 as const };
    if (currentUserRole !== 'OWNER' && currentUserRole !== 'ADMIN') return { error: 'Only owners or admins can invite members' as const, status: 403 as const };
    const existingMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId: activeWorkspaceId, user: { email } },
    });
    if (existingMember) return { error: 'User is already in this workspace' as const, status: 400 as const };
    return { currentUser, activeWorkspaceId, workspaceName, workspacePlan, inviterName };
}

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

        const ctx = await getInviteContext(session.user.id, email);
        if ('status' in ctx) {
            return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        }
        const { activeWorkspaceId, workspaceName, workspacePlan, inviterName } = ctx;

        // Rate limit: 10 invites per 5 minutes per workspace
        const rl = await rateLimit(`team-invite:${activeWorkspaceId}`, 10, 300);
        if (!rl.success) {
            return NextResponse.json({ error: 'Muitos convites enviados. Tente novamente em alguns minutos.' }, { status: 429 });
        }

        // Max members per plan
        const maxMembers = PLANS[workspacePlan]?.maxMembers ?? 1;
        const currentMemberCount = await prisma.workspaceMember.count({ where: { workspaceId: activeWorkspaceId } });
        const pendingInviteCount = await prisma.workspaceInvitation.count({ where: { workspaceId: activeWorkspaceId, status: 'PENDING' } });
        if (currentMemberCount + pendingInviteCount >= maxMembers) {
            return NextResponse.json(
                { error: `Limite de membros atingido para o plano ${PLANS[workspacePlan].name} (${maxMembers}). Faça upgrade para adicionar mais membros.` },
                { status: 403 },
            );
        }

        const token = crypto.randomBytes(32).toString('hex');
        const baseUrl = getSiteUrlFromRequest(req).replace(/\/$/, '');
        const locale = getRequestLocale(req);
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

        sendTeamInviteEmail(email, inviterName, workspaceName, acceptInviteUrl, locale, baseUrl)
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
