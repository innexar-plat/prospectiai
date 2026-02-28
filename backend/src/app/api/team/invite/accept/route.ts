import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { z } from 'zod';

/** POST /api/team/invite/accept — aceitar convite com token (usuário deve estar logado com o mesmo email) */
export async function POST(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.email) {
            return jsonWithRequestId({ error: 'Faça login para aceitar o convite' }, { status: 401, requestId });
        }

        const body = await req.json().catch(() => ({}));
        const parsed = z.object({ token: z.string().min(1) }).safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId({ error: 'Token inválido' }, { status: 400, requestId });
        }

        const invitation = await prisma.workspaceInvitation.findUnique({
            where: { token: parsed.data.token },
            include: { workspace: true },
        });

        if (!invitation || invitation.status !== 'PENDING') {
            return jsonWithRequestId({ error: 'Convite não encontrado ou já utilizado' }, { status: 404, requestId });
        }

        const emailLower = session.user.email.trim().toLowerCase();
        const inviteEmailLower = invitation.email.trim().toLowerCase();
        if (emailLower !== inviteEmailLower) {
            return jsonWithRequestId(
                { error: 'Use a conta com o email que recebeu o convite para aceitar' },
                { status: 403, requestId }
            );
        }

        let user = await prisma.user.findUnique({
            where: { id: session.user.id },
        });
        if (!user) {
            return jsonWithRequestId({ error: 'User not found' }, { status: 404, requestId });
        }

        const existing = await prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: { userId: user.id, workspaceId: invitation.workspaceId },
            },
        });
        if (existing) {
            await prisma.workspaceInvitation.update({
                where: { id: invitation.id },
                data: { status: 'ACCEPTED' },
            });
            return jsonWithRequestId({ ok: true, alreadyMember: true }, { requestId });
        }

        await prisma.$transaction([
            prisma.workspaceMember.create({
                data: {
                    userId: user.id,
                    workspaceId: invitation.workspaceId,
                    role: 'MEMBER',
                },
            }),
            prisma.workspaceInvitation.update({
                where: { id: invitation.id },
                data: { status: 'ACCEPTED' },
            }),
        ]);

        return jsonWithRequestId({ ok: true }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Team invite accept error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
