import type { AnalyzeInput } from '@/lib/validations/schemas';
import { runAnalyze } from './analyze.service';

export type AnalyzeBatchJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface AnalyzeBatchItem {
    placeId: string;
    name: string;
    locale?: string;
    websiteUri?: string;
    website?: string;
    formattedAddress?: string;
    address?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    phone?: string;
    rating?: number;
    userRatingCount?: number;
    reviewCount?: number;
    types?: string[];
    primaryType?: string;
    businessStatus?: string;
    reviews?: Array<{
        rating: number;
        text?: { text?: string };
        authorAttribution?: { displayName?: string };
        relativePublishTimeDescription?: string;
    }>;
    currentOpeningHours?: {
        openNow?: boolean;
        weekdayDescriptions?: string[];
    };
}

export interface AnalyzeBatchJob {
    id: string;
    userId: string;
    status: AnalyzeBatchJobStatus;
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    startedAt: string;
    finishedAt?: string;
    errors: Array<{ placeId: string; message: string }>;
}

const jobs = new Map<string, AnalyzeBatchJob>();

function toAnalyzeInput(item: AnalyzeBatchItem): AnalyzeInput {
    return {
        placeId: item.placeId,
        name: item.name,
        locale: item.locale,
        websiteUri: item.websiteUri,
        website: item.website,
        formattedAddress: item.formattedAddress,
        address: item.address,
        nationalPhoneNumber: item.nationalPhoneNumber,
        internationalPhoneNumber: item.internationalPhoneNumber,
        phone: item.phone,
        rating: item.rating,
        userRatingCount: item.userRatingCount,
        reviewCount: item.reviewCount,
        types: item.types,
        primaryType: item.primaryType,
        businessStatus: item.businessStatus,
        reviews: item.reviews?.map((r) => ({
            rating: r.rating,
            text: r.text?.text ? { text: r.text.text } : undefined,
            authorAttribution: r.authorAttribution?.displayName
                ? { displayName: r.authorAttribution.displayName }
                : undefined,
            relativePublishTimeDescription: r.relativePublishTimeDescription,
        })),
        currentOpeningHours: item.currentOpeningHours,
    };
}

export function createBatchJob(userId: string, items: AnalyzeBatchItem[]): AnalyzeBatchJob {
    const id = crypto.randomUUID();
    const job: AnalyzeBatchJob = {
        id,
        userId,
        status: 'queued',
        total: items.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
        startedAt: new Date().toISOString(),
        errors: [],
    };
    jobs.set(id, job);

    void processBatch(job, items);
    return job;
}

async function processBatch(job: AnalyzeBatchJob, items: AnalyzeBatchItem[]): Promise<void> {
    job.status = 'running';
    const concurrency = 2;
    let current = 0;

    async function worker(): Promise<void> {
        while (current < items.length) {
            const idx = current;
            current += 1;
            const item = items[idx];
            try {
                await runAnalyze(toAnalyzeInput(item), job.userId);
                job.succeeded += 1;
            } catch (error) {
                job.failed += 1;
                job.errors.push({
                    placeId: item.placeId,
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
            } finally {
                job.processed += 1;
            }
        }
    }

    try {
        await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
        job.status = job.failed > 0 ? 'failed' : 'completed';
    } finally {
        job.finishedAt = new Date().toISOString();
    }
}

export function getBatchJob(id: string, userId: string): AnalyzeBatchJob | null {
    const job = jobs.get(id);
    if (!job || job.userId !== userId) return null;
    return job;
}
