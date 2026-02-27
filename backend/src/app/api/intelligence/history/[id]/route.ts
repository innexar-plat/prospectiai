import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';

/**
 * GET /api/intelligence/history/[id]
 * Returns a single saved intelligence report with full results data.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const { id } = await params;
        if (!id) {
            return jsonWithRequestId({ error: 'Missing id parameter' }, { status: 400, requestId });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { workspaces: { take: 1, select: { workspaceId: true } } },
        });

        if (!user?.workspaces?.length) {
            return jsonWithRequestId({ error: 'Workspace not found' }, { status: 404, requestId });
        }

        const workspaceId = user.workspaces[0].workspaceId;

        const item = await prisma.intelligenceReport.findFirst({
            where: { id, workspaceId },
        });

        if (!item) {
            return jsonWithRequestId({ error: 'Report not found' }, { status: 404, requestId });
        }

        return jsonWithRequestId(item, { requestId });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Intelligence detail error', { error: error instanceof Error ? error.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}

/**
 * PATCH /api/intelligence/history/[id]
 * Updates isFavorite for a saved intelligence report.
 * Body: { isFavorite: boolean }
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const { id } = await params;
        if (!id) {
            return jsonWithRequestId({ error: 'Missing id parameter' }, { status: 400, requestId });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { workspaces: { take: 1, select: { workspaceId: true } } },
        });

        if (!user?.workspaces?.length) {
            return jsonWithRequestId({ error: 'Workspace not found' }, { status: 404, requestId });
        }

        const workspaceId = user.workspaces[0].workspaceId;

        const body = await req.json().catch(() => ({}));
        const isFavorite = typeof body.isFavorite === 'boolean' ? body.isFavorite : undefined;
        if (isFavorite === undefined) {
            return jsonWithRequestId({ error: 'isFavorite (boolean) required' }, { status: 400, requestId });
        }

        const item = await prisma.intelligenceReport.updateMany({
            where: { id, workspaceId },
            data: { isFavorite },
        });

        if (item.count === 0) {
            return jsonWithRequestId({ error: 'Report not found' }, { status: 404, requestId });
        }

        const updated = await prisma.intelligenceReport.findFirstOrThrow({
            where: { id, workspaceId },
        });
        return jsonWithRequestId(updated, { requestId });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Intelligence PATCH error', { error: error instanceof Error ? error.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
