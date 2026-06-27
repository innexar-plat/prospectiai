import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSmartRelations } from '@/lib/smart-relations';
import { getRequestMarket, isMarketFeatureEnabled } from '@/lib/market';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { logger } from '@/lib/logger';

const RELATIONS_TIMEOUT_MS = 8000;

function buildEmptyRelations(placeId: string) {
    return {
        lead: { placeId, name: '', cnpj: null as string | null },
        relations: [],
        clusters: { sameSector: [], sameRegion: [], contactNetwork: [], userLeads: [] },
        stats: { totalFound: 0, sameSector: 0, sameRegion: 0, contactNetwork: 0, userLeads: 0 },
    };
}

/**
 * GET /api/leads/[id]/relations
 * Returns smart relations (knowledge graph style) for a lead.
 * `id` can be a Lead.id (CUID) or a placeId.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const requestId = getOrCreateRequestId(req);
    const startedAt = Date.now();
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const { id } = await params;

        const market = getRequestMarket(req);
        if (!isMarketFeatureEnabled('smartRelations', market)) {
            const placeId = id?.trim() || '';
            return jsonWithRequestId({ data: buildEmptyRelations(placeId) }, { requestId });
        }

        if (!id || !id.trim()) {
            return jsonWithRequestId({ error: 'Missing id parameter' }, { status: 400, requestId });
        }

        // Resolve placeId from id (could be CUID or placeId)
        let placeId = id;
        if (!id.startsWith('ChIJ') && !id.startsWith('Eh') && !id.startsWith('rf_')) {
            const lead = await prisma.lead.findUnique({
                where: { id },
                select: { placeId: true },
            });
            if (lead?.placeId) placeId = lead.placeId;
        }

        const timeoutPromise = new Promise<ReturnType<typeof buildEmptyRelations>>((resolve) => {
            setTimeout(() => resolve(buildEmptyRelations(placeId)), RELATIONS_TIMEOUT_MS);
        });

        const result = await Promise.race([
            getSmartRelations(placeId, session.user.id),
            timeoutPromise,
        ]);

        const durationMs = Date.now() - startedAt;
        if (!result || !result.stats || typeof result.stats.totalFound !== 'number') {
            logger.warn('Lead relations: invalid result payload, returning empty', {
                placeId,
                userId: session.user.id,
                requestId,
                durationMs,
            });
            return jsonWithRequestId({ data: buildEmptyRelations(placeId) }, { requestId });
        }

        if (result.stats.totalFound === 0) {
            logger.info('Lead relations: empty or timed out', {
                placeId,
                userId: session.user.id,
                requestId,
                durationMs,
            });
        }

        return jsonWithRequestId({ data: result }, { requestId });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Lead relations error', { error: msg, durationMs: Date.now() - startedAt }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
