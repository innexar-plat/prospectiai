import { NextRequest } from 'next/server';
import { getPlaceDetails } from '@/lib/google-places';
import { getCached, setCached } from '@/lib/redis';
import { syncLead } from '@/lib/db-sync';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { detailsQuerySchema, formatZodError } from '@/lib/validations/schemas';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { recordUsageEvent } from '@/lib/usage';

function buildDetailsFromLead(lead: {
    placeId: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    recommendedPhone: string | null;
    recommendedEmail: string | null;
    recommendedWebsite: string | null;
    contactsHealthScore: number | null;
    rating: number | null;
    reviewCount: number | null;
    types: unknown;
    businessStatus: string | null;
}) {
    return {
        id: lead.placeId,
        displayName: { text: lead.name, languageCode: 'pt-BR' },
        formattedAddress: lead.address ?? undefined,
        nationalPhoneNumber: lead.recommendedPhone ?? lead.phone ?? undefined,
        email: lead.recommendedEmail ?? lead.email ?? undefined,
        websiteUri: lead.recommendedWebsite ?? lead.website ?? undefined,
        rating: lead.rating ?? undefined,
        userRatingCount: lead.reviewCount ?? undefined,
        types: Array.isArray(lead.types) ? lead.types : [],
        businessStatus: lead.businessStatus ?? undefined,
        recommendedPhone: lead.recommendedPhone ?? undefined,
        recommendedEmail: lead.recommendedEmail ?? undefined,
        recommendedWebsite: lead.recommendedWebsite ?? undefined,
        contactsHealthScore: lead.contactsHealthScore ?? undefined,
    };
}

export async function GET(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const parsed = detailsQuerySchema.safeParse({
            placeId: req.nextUrl.searchParams.get('placeId') ?? '',
        });
        if (!parsed.success) {
            return jsonWithRequestId({ error: formatZodError(parsed) }, { status: 400, requestId });
        }
        const { placeId: rawPlaceId } = parsed.data;

        // If the provided ID is a Prisma CUID (not a Google Place ID), resolve it from the DB.
        const isGooglePlaceId = rawPlaceId.startsWith('ChIJ') || rawPlaceId.startsWith('Eh');
        let placeId = rawPlaceId;

        let resolvedLead: {
            placeId: string;
            name: string;
            address: string | null;
            phone: string | null;
            email: string | null;
            website: string | null;
            recommendedPhone: string | null;
            recommendedEmail: string | null;
            recommendedWebsite: string | null;
            contactsHealthScore: number | null;
            rating: number | null;
            reviewCount: number | null;
            types: unknown;
            businessStatus: string | null;
        } | null = null;

        if (!isGooglePlaceId) {
            resolvedLead = await prisma.lead.findFirst({
                where: {
                    OR: [{ id: rawPlaceId }, { placeId: rawPlaceId }],
                },
                select: {
                    placeId: true,
                    name: true,
                    address: true,
                    phone: true,
                    email: true,
                    website: true,
                    recommendedPhone: true,
                    recommendedEmail: true,
                    recommendedWebsite: true,
                    contactsHealthScore: true,
                    rating: true,
                    reviewCount: true,
                    types: true,
                    businessStatus: true,
                },
            });

            if (resolvedLead?.placeId) {
                placeId = resolvedLead.placeId;
            } else {
                return jsonWithRequestId({ error: 'Lead not found' }, { status: 404, requestId });
            }

            // RF/local leads don't exist in Google Places details API.
            if (placeId.startsWith('rf_')) {
                return jsonWithRequestId(buildDetailsFromLead(resolvedLead), { requestId });
            }
        }

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
                include: { workspaces: { include: { workspace: true }, orderBy: { workspace: { createdAt: 'asc' } }, take: 1 } },
            });
            if (user?.workspaces && user.workspaces.length > 0) {
                recordUsageEvent({
                    workspaceId: user.workspaces[0]!.workspace.id,
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
