import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { z } from 'zod';

const creditsSchema = z.object({
    memberId: z.string().min(1),
    dailyLeadsLimit: z.number().int().min(0).nullable().optional(),
    weeklyLeadsLimit: z.number().int().min(0).nullable().optional(),
    monthlyLeadsLimit: z.number().int().min(0).nullable().optional(),
});

/**
 * PUT /api/team/credits — Admin/Owner sets credit limits for a specific team member.
 * null = no individual cap (uses workspace pool only).
 */
export async function PUT(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const body = await req.json().catch(() => ({}));
        const parsed = creditsSchema.safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId(
                { error: 'Invalid input', details: parsed.error.flatten() },
                { status: 400, requestId },
            );
        }

        const caller = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            include: { workspace: true },
        });

        if (!caller || !['OWNER', 'ADMIN'].includes(caller.role)) {
            return jsonWithRequestId({ error: 'Only admins can set credit limits' }, { status: 403, requestId });
        }

        const target = await prisma.workspaceMember.findFirst({
            where: { id: parsed.data.memberId, workspaceId: caller.workspaceId },
        });

        if (!target) {
            return jsonWithRequestId({ error: 'Member not found in workspace' }, { status: 404, requestId });
        }

        const updated = await prisma.workspaceMember.update({
            where: { id: parsed.data.memberId },
            data: {
                dailyLeadsLimit: parsed.data.dailyLeadsLimit ?? undefined,
                weeklyLeadsLimit: parsed.data.weeklyLeadsLimit ?? undefined,
                monthlyLeadsLimit: parsed.data.monthlyLeadsLimit ?? undefined,
            },
            select: {
                id: true,
                dailyLeadsLimit: true,
                weeklyLeadsLimit: true,
                monthlyLeadsLimit: true,
                user: { select: { name: true, email: true } },
            },
        });

        return jsonWithRequestId({ ok: true, member: updated }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Team credits error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
