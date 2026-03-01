import { NextRequest, NextResponse } from 'next/server';
import { textSearch } from '@/lib/google-places';
import { getCached } from '@/lib/redis';
import { syncLeads } from '@/lib/db-sync';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { searchSchema, formatZodError } from '@/lib/validations/schemas';
import { recordUsageEvent } from '@/lib/usage';

type WorkspaceWithLimit = { id: string; leadsUsed: number; leadsLimit: number };

async function getActiveWorkspaceOrError(
    userId: string,
    requestId: string,
): Promise<{ ok: true; workspace: WorkspaceWithLimit } | { ok: false; response: NextResponse }> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { workspaces: { include: { workspace: true }, take: 1 } }
    });
    if (!user || user.workspaces.length === 0) {
        return { ok: false, response: jsonWithRequestId({ error: 'Workspace not found' }, { status: 404, requestId }) };
    }
    const activeWorkspace = user.workspaces[0].workspace as WorkspaceWithLimit;
    if (activeWorkspace.leadsUsed >= activeWorkspace.leadsLimit) {
        return {
            ok: false,
            response: jsonWithRequestId({
                error: 'Limit reached',
                code: 'LIMIT_EXCEEDED',
                limit: activeWorkspace.leadsLimit,
                used: activeWorkspace.leadsUsed
            }, { status: 403, requestId })
        };
    }
    return { ok: true, workspace: activeWorkspace };
}

async function runSearchAndRecord(
    workspace: WorkspaceWithLimit,
    data: { textQuery: string; includedType?: string | null; pageSize?: number | null; pageToken?: string | null },
    userId: string,
    requestId: string,
): Promise<NextResponse> {
    const { textQuery, includedType, pageSize, pageToken } = data;
    if (!pageToken) {
        const cacheKey = `search:${textQuery}:${includedType || ''}:${pageSize || 20}`;
        const cached = await getCached<ReturnType<typeof textSearch>>(cacheKey);
        if (cached) return jsonWithRequestId({ ...cached, fromCache: true }, { requestId });
    }
    const result = await textSearch({
        textQuery,
        includedType: includedType || undefined,
        pageSize: pageSize || 20,
        pageToken: pageToken || undefined,
    });
    recordUsageEvent({ workspaceId: workspace.id, userId, type: 'GOOGLE_PLACES_SEARCH', quantity: 1 });
    if (result.places && result.places.length > 0) {
        syncLeads(result.places).catch((err) => import('@/lib/logger').then(({ logger }) => logger.error('Background sync error', { error: err instanceof Error ? err.message : 'Unknown' })));
    }
    await prisma.workspace.update({
        where: { id: workspace.id },
        data: { leadsUsed: { increment: 1 } },
    });
    return jsonWithRequestId(result, { requestId });
}

async function executeSearch(
    data: { textQuery: string; includedType?: string | null; pageSize?: number | null; pageToken?: string | null },
    userId: string,
    requestId: string,
): Promise<NextResponse> {
    const workspaceResult = await getActiveWorkspaceOrError(userId, requestId);
    if (!workspaceResult.ok) return workspaceResult.response;
    return runSearchAndRecord(workspaceResult.workspace, data, userId, requestId);
}

export async function POST(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const body = await req.json();
        const parsed = searchSchema.safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId({ error: formatZodError(parsed) }, { status: 400, requestId });
        }
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }
        return executeSearch(parsed.data, session.user.id, requestId);
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('V1 search error', { error: error instanceof Error ? error.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
