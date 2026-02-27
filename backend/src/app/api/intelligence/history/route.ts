import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';

/**
 * GET /api/intelligence/history
 * Lists saved intelligence reports for the user's workspace.
 * Query: ?module=COMPETITORS&limit=20&offset=0
 */
export async function GET(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { workspaces: { take: 1, select: { workspaceId: true } } },
        });

        if (!user?.workspaces?.length) {
            return jsonWithRequestId({ error: 'Workspace not found' }, { status: 404, requestId });
        }

        const workspaceId = user.workspaces[0].workspaceId;
        const moduleKey = req.nextUrl.searchParams.get('module') || undefined;
        const favoriteOnly = req.nextUrl.searchParams.get('favoriteOnly') === 'true';
        const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20', 10), 100);
        const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

        const where: Record<string, unknown> = { workspaceId };
        if (moduleKey) where.module = moduleKey;
        if (favoriteOnly) where.isFavorite = true;

        const [items, total] = await Promise.all([
            prisma.intelligenceReport.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    module: true,
                    inputQuery: true,
                    inputCity: true,
                    inputState: true,
                    isFavorite: true,
                    createdAt: true,
                },
            }),
            prisma.intelligenceReport.count({ where }),
        ]);

        return jsonWithRequestId({ items, total, limit, offset }, { requestId });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Intelligence history error', { error: error instanceof Error ? error.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
