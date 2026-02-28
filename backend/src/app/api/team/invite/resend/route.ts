import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { sendTeamInviteEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const SITE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const body = await req.json();
        const parsed = z.object({ invitationId: z.string().min(1) }).safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId({ error: 'invitationId obrigatório' }, { status: 400, requestId });
        }

        const invitation = await prisma.workspaceInvitation.findUnique({
            where: { id: parsed.data.invitationId },
            include: { workspace: true, inviter: { select: { name: true, email: true } } },
        });

        if (!invitation || invitation.status !== 'PENDING') {
            return jsonWithRequestId({ error: 'Convite não encontrado ou já aceito' }, { status: 404, requestId });
        }

        const membership = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id, workspaceId: invitation.workspaceId },
        });
        if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
            return jsonWithRequestId({ error: 'Forbidden' }, { status: 403, requestId });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const baseUrl = SITE_URL.replace(/\/$/, '');
        const acceptInviteUrl = `${baseUrl}/accept-invite?token=${encodeURIComponent(token)}`;

        await prisma.workspaceInvitation.update({
            where: { id: invitation.id },
            data: { token, lastSentAt: new Date() },
        });

        const inviterName = invitation.inviter.name ?? invitation.inviter.email ?? 'Alguém';
        const workspaceName = invitation.workspace.name ?? 'Workspace';

        const result = await sendTeamInviteEmail(
            invitation.email,
            inviterName,
            workspaceName,
            acceptInviteUrl
        );

        if (!result.sent) {
            logger.warn('Team invite resend failed', { email: invitation.email, reason: result.error }, requestId);
            return jsonWithRequestId({ error: result.error ?? 'Falha ao enviar email' }, { status: 502, requestId });
        }

        return jsonWithRequestId({
            ok: true,
            lastSentAt: new Date().toISOString(),
        }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Team invite resend error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
