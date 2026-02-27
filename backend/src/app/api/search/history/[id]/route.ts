import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCached, setCached } from '@/lib/redis';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';

/**
 * GET /api/search/history/[id]
 * Returns a single search history item with its results data.
 * Results are cached in Redis (1h TTL) for fast access.
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

        // Try Redis cache first
        const cacheKey = `searchHistory:${id}`;
        const cached = await getCached<Record<string, unknown>>(cacheKey);
        if (cached) {
            return jsonWithRequestId(cached, { requestId });
        }

        // Get user workspace
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { workspaces: { take: 1, select: { workspaceId: true } } },
        });

        if (!user?.workspaces?.length) {
            return jsonWithRequestId({ error: 'Workspace not found' }, { status: 404, requestId });
        }

        const workspaceId = user.workspaces[0].workspaceId;

        // Fetch the item, ensuring it belongs to the user's workspace
        const item = await prisma.searchHistory.findFirst({
            where: { id, workspaceId },
            select: {
                id: true,
                textQuery: true,
                pageSize: true,
                filters: true,
                resultsCount: true,
                resultsData: true,
                createdAt: true,
                user: { select: { name: true, email: true } },
            },
        });

        if (!item) {
            return jsonWithRequestId({ error: 'History item not found' }, { status: 404, requestId });
        }

        const responseData = {
            ...item,
            resultsData: item.resultsData ?? [],
        };

        // Cache in Redis for 1 hour
        await setCached(cacheKey, responseData, 3600).catch(() => { });

        return jsonWithRequestId(responseData, { requestId });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Search history detail error', {
            error: error instanceof Error ? error.message : 'Unknown',
        }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
