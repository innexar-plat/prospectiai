import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { z } from 'zod';

// GET /api/tags?leadId=xxx — list tags for a lead
export async function GET(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const leadId = req.nextUrl.searchParams.get('leadId');
        if (!leadId) {
            // Return all tags for the user
            const tags = await prisma.leadTag.findMany({
                where: { userId: session.user.id },
                orderBy: { createdAt: 'desc' },
                take: 500,
            });
            return jsonWithRequestId({ tags }, { requestId });
        }

        const tags = await prisma.leadTag.findMany({
            where: { userId: session.user.id, leadId },
            orderBy: { createdAt: 'asc' },
        });

        return jsonWithRequestId({ tags }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Tags GET error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}

// POST /api/tags — add a tag to a lead
export async function POST(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const body = await req.json();
        const schema = z.object({
            leadId: z.string().min(1),
            label: z.string().min(1).max(50),
            color: z.string().max(20).optional().default('gray'),
        });

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId({ error: 'Dados inválidos' }, { status: 400, requestId });
        }

        const tag = await prisma.leadTag.upsert({
            where: {
                userId_leadId_label: {
                    userId: session.user.id,
                    leadId: parsed.data.leadId,
                    label: parsed.data.label,
                },
            },
            update: { color: parsed.data.color },
            create: {
                userId: session.user.id,
                leadId: parsed.data.leadId,
                label: parsed.data.label,
                color: parsed.data.color,
            },
        });

        return jsonWithRequestId({ tag }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Tags POST error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}

// DELETE /api/tags — remove a tag
export async function DELETE(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const tagId = req.nextUrl.searchParams.get('id');
        if (!tagId) {
            return jsonWithRequestId({ error: 'Tag ID required' }, { status: 400, requestId });
        }

        await prisma.leadTag.deleteMany({
            where: { id: tagId, userId: session.user.id },
        });

        return jsonWithRequestId({ ok: true }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Tags DELETE error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
