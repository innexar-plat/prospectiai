import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { searchHistoryQuerySchema, formatZodError } from '@/lib/validations/schemas';

/**
 * GET /api/search/history
 * Lista o histórico de buscas do workspace do usuário (para reaproveitamento e auditoria).
 * Query: ?limit=20&offset=0
 */
export async function GET(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const parsed = searchHistoryQuerySchema.safeParse({
            limit: req.nextUrl.searchParams.get('limit') ?? undefined,
            offset: req.nextUrl.searchParams.get('offset') ?? undefined,
        });
        if (!parsed.success) {
            return jsonWithRequestId({ error: formatZodError(parsed) }, { status: 400, requestId });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { workspaces: { take: 1, select: { workspaceId: true } } }
        });

        if (!user?.workspaces?.length) {
            return jsonWithRequestId({ error: 'Workspace not found' }, { status: 404, requestId });
        }

        const workspaceId = user.workspaces[0].workspaceId;
        const limit = Math.min(parsed.data.limit ?? 20, 100);
        const offset = parsed.data.offset ?? 0;

        const [items, total] = await Promise.all([
            prisma.searchHistory.findMany({
                where: { workspaceId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    textQuery: true,
                    pageSize: true,
                    filters: true,
                    resultsCount: true,
                    createdAt: true,
                    user: { select: { name: true, email: true } }
                }
            }),
            prisma.searchHistory.count({ where: { workspaceId } })
        ]);

        return jsonWithRequestId({ items, total, limit, offset }, { requestId });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Search history error', { error: error instanceof Error ? error.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
