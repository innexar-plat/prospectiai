import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { z } from 'zod';

const activitySchema = z.object({
    action: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const body = await req.json();
        const parsed = activitySchema.safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId({ error: 'Invalid action' }, { status: 400, requestId });
        }

        // Find user's workspace
        const membership = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            select: { workspaceId: true },
        });

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: parsed.data.action,
                resource: 'activity',
                details: (parsed.data.metadata ?? {}) as Prisma.InputJsonValue,
            },
        });

        return jsonWithRequestId({ ok: true }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Activity tracking error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ ok: true }, { requestId }); // Don't fail the user's action
    }
}
