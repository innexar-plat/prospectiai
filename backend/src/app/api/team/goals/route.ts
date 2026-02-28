import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { z } from 'zod';

const goalsSchema = z.object({
    memberId: z.string().min(1),
    dailyLeadsGoal: z.number().int().min(0).max(500).nullable().optional(),
    dailyAnalysesGoal: z.number().int().min(0).max(200).nullable().optional(),
    monthlyConversionsGoal: z.number().int().min(0).max(1000).nullable().optional(),
});

/**
 * PUT /api/team/goals — Admin/Owner sets goals for a specific team member.
 */
export async function PUT(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const body = await req.json();
        const parsed = goalsSchema.safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId({ error: 'Invalid input', details: z.flattenError(parsed.error) }, { status: 400, requestId });
        }

        // Verify caller is OWNER or ADMIN
        const caller = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            include: { workspace: true },
        });

        if (!caller || !['OWNER', 'ADMIN'].includes(caller.role)) {
            return jsonWithRequestId({ error: 'Only admins can set goals' }, { status: 403, requestId });
        }

        // Verify target member is in the same workspace
        const target = await prisma.workspaceMember.findFirst({
            where: { id: parsed.data.memberId, workspaceId: caller.workspaceId },
        });

        if (!target) {
            return jsonWithRequestId({ error: 'Member not found in workspace' }, { status: 404, requestId });
        }

        const updated = await prisma.workspaceMember.update({
            where: { id: parsed.data.memberId },
            data: {
                dailyLeadsGoal: parsed.data.dailyLeadsGoal ?? undefined,
                dailyAnalysesGoal: parsed.data.dailyAnalysesGoal ?? undefined,
                monthlyConversionsGoal: parsed.data.monthlyConversionsGoal ?? undefined,
            },
            select: {
                id: true,
                dailyLeadsGoal: true,
                dailyAnalysesGoal: true,
                monthlyConversionsGoal: true,
                user: { select: { name: true, email: true } },
            },
        });

        return jsonWithRequestId({ ok: true, member: updated }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Team goals error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
