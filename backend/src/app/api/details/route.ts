import { NextRequest } from 'next/server';
import { getPlaceDetails } from '@/lib/google-places';
import { getCached, setCached } from '@/lib/redis';
import { syncLead } from '@/lib/db-sync';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { detailsQuerySchema, formatZodError } from '@/lib/validations/schemas';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { recordUsageEvent } from '@/lib/usage';

export async function GET(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const parsed = detailsQuerySchema.safeParse({
            placeId: req.nextUrl.searchParams.get('placeId') ?? '',
        });
        if (!parsed.success) {
            return jsonWithRequestId({ error: formatZodError(parsed) }, { status: 400, requestId });
        }
        const { placeId } = parsed.data;

        // Check cache
        const cacheKey = `details:${placeId}`;
        const cached = await getCached(cacheKey);
        if (cached) {
            return jsonWithRequestId({ ...cached as Record<string, unknown>, fromCache: true }, { requestId });
        }

        const result = await getPlaceDetails(placeId);

        const session = await auth();
        if (session?.user?.id) {
            const user = await prisma.user.findFirst({
                where: { id: session.user.id },
                include: { workspaces: { include: { workspace: true }, take: 1 } },
            });
            if (user?.workspaces && user.workspaces.length > 0) {
                recordUsageEvent({
                    workspaceId: user.workspaces[0].workspace.id,
                    userId: session.user.id,
                    type: 'GOOGLE_PLACES_DETAILS',
                    quantity: 1,
                });
            }
        }

        // Cache for 15 min
        await setCached(cacheKey, result, 900);

        // Sync with Database (Enrich lead info)
        syncLead(result).catch(err => {
            import('@/lib/logger').then(({ logger }) => logger.error('Background sync detail error', { error: err instanceof Error ? err.message : 'Unknown' }));
        });

        return jsonWithRequestId(result, { requestId });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Details error', { error: error instanceof Error ? error.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
