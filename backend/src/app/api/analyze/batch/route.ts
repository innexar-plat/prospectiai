import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createBatchJob, type AnalyzeBatchItem } from '@/modules/analyze/application/batch-jobs';

function normalizeBatchItems(raw: unknown): AnalyzeBatchItem[] {
    if (!Array.isArray(raw)) return [];
    const mapped = raw
        .map((item) => {
            const row = item as Record<string, unknown>;
            const placeId = String(row.placeId ?? '').trim();
            const name = String(row.name ?? '').trim();
            if (!placeId || !name) return null;
            return {
                placeId,
                name,
                locale: typeof row.locale === 'string' ? row.locale : undefined,
                websiteUri: typeof row.websiteUri === 'string' ? row.websiteUri : undefined,
                website: typeof row.website === 'string' ? row.website : undefined,
                formattedAddress: typeof row.formattedAddress === 'string' ? row.formattedAddress : undefined,
                address: typeof row.address === 'string' ? row.address : undefined,
                nationalPhoneNumber: typeof row.nationalPhoneNumber === 'string' ? row.nationalPhoneNumber : undefined,
                internationalPhoneNumber: typeof row.internationalPhoneNumber === 'string' ? row.internationalPhoneNumber : undefined,
                phone: typeof row.phone === 'string' ? row.phone : undefined,
                rating: typeof row.rating === 'number' ? row.rating : undefined,
                userRatingCount: typeof row.userRatingCount === 'number' ? row.userRatingCount : undefined,
                reviewCount: typeof row.reviewCount === 'number' ? row.reviewCount : undefined,
                types: Array.isArray(row.types) ? row.types.filter((v): v is string => typeof v === 'string') : undefined,
                primaryType: typeof row.primaryType === 'string' ? row.primaryType : undefined,
                businessStatus: typeof row.businessStatus === 'string' ? row.businessStatus : undefined,
                reviews: Array.isArray(row.reviews)
                    ? row.reviews
                          .map((r) => {
                              const rr = r as Record<string, unknown>;
                              const rating = typeof rr.rating === 'number' ? rr.rating : undefined;
                              if (rating == null) return null;
                              const textObj = rr.text as { text?: string } | undefined;
                              const authorObj = rr.authorAttribution as { displayName?: string } | undefined;
                              return {
                                  rating,
                                  text: typeof textObj?.text === 'string' ? { text: textObj.text } : undefined,
                                  authorAttribution:
                                      typeof authorObj?.displayName === 'string'
                                          ? { displayName: authorObj.displayName }
                                          : undefined,
                                  relativePublishTimeDescription:
                                      typeof rr.relativePublishTimeDescription === 'string'
                                          ? rr.relativePublishTimeDescription
                                          : undefined,
                              };
                          })
                          .filter((v): v is NonNullable<typeof v> => v != null)
                    : undefined,
                currentOpeningHours:
                    row.currentOpeningHours && typeof row.currentOpeningHours === 'object'
                        ? {
                              openNow:
                                  typeof (row.currentOpeningHours as { openNow?: unknown }).openNow === 'boolean'
                                      ? (row.currentOpeningHours as { openNow: boolean }).openNow
                                      : undefined,
                              weekdayDescriptions: Array.isArray(
                                  (row.currentOpeningHours as { weekdayDescriptions?: unknown }).weekdayDescriptions
                              )
                                  ? ((row.currentOpeningHours as { weekdayDescriptions: unknown[] }).weekdayDescriptions.filter(
                                        (v): v is string => typeof v === 'string'
                                    ) as string[])
                                  : undefined,
                          }
                        : undefined,
            };
        })
        .filter((v) => v != null);
    return mapped as AnalyzeBatchItem[];
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = (await req.json()) as { items?: unknown };
        const items = normalizeBatchItems(body.items);
        if (items.length === 0) {
            return NextResponse.json({ error: 'At least one valid item is required' }, { status: 400 });
        }
        if (items.length > 30) {
            return NextResponse.json({ error: 'Batch limit is 30 leads per run' }, { status: 400 });
        }

        const job = createBatchJob(session.user.id, items);
        return NextResponse.json({
            jobId: job.id,
            status: job.status,
            total: job.total,
            processed: job.processed,
            succeeded: job.succeeded,
            failed: job.failed,
            startedAt: job.startedAt,
        });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Analyze batch start error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
