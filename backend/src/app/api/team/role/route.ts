import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { z } from 'zod';

const bodySchema = z.object({
    memberId: z.string().min(1),
    role: z.enum(['MEMBER', 'ADMIN']),
});

/**
 * PUT /api/team/role — Admin/Owner updates a member's role (MEMBER | ADMIN).
 * Only OWNER can set ADMIN; ADMIN can set MEMBER.
 */
export async function PUT(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const body = await req.json();
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400, requestId });
        }

        const caller = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
        });

        if (!caller || !['OWNER', 'ADMIN'].includes(caller.role)) {
            return jsonWithRequestId({ error: 'Only admins can change roles' }, { status: 403, requestId });
        }

        if (parsed.data.role === 'ADMIN' && caller.role !== 'OWNER') {
            return jsonWithRequestId({ error: 'Only the owner can assign ADMIN role' }, { status: 403, requestId });
        }

        const target = await prisma.workspaceMember.findFirst({
            where: { id: parsed.data.memberId, workspaceId: caller.workspaceId },
        });

        if (!target) {
            return jsonWithRequestId({ error: 'Member not found in workspace' }, { status: 404, requestId });
        }

        if (target.role === 'OWNER') {
            return jsonWithRequestId({ error: 'Cannot change owner role' }, { status: 400, requestId });
        }

        await prisma.workspaceMember.update({
            where: { id: parsed.data.memberId },
            data: { role: parsed.data.role },
        });

        return jsonWithRequestId({ ok: true, role: parsed.data.role }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Team role update error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
