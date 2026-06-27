import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { getCached } from '@/lib/redis';

const DEFAULT_STALE_JOB_MS = 720_000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getStaleJobMs(): number {
    return parsePositiveInt(process.env.ANALYZE_JOB_STALE_MS, DEFAULT_STALE_JOB_MS);
}

type AnalyzeJobCache = {
    status: string;
    step?: string;
    result?: unknown;
    error?: string;
    httpStatus?: number;
    updatedAt?: number;
};

/**
 * GET /api/analyze/status?jobId=X
 *
 * Returns the current state of an async analyze job.
 * Responses:
 *   { status: 'processing', step: 'ai_call' }
 *   { status: 'done', result: { score, summary, ... } }
 *   { status: 'error', error: 'message' }
 */
export async function GET(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);

    const session = await auth();
    if (!session?.user?.id) {
        return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
    }

    const jobId = req.nextUrl.searchParams.get('jobId');
    if (!jobId || jobId.length < 10) {
        return jsonWithRequestId({ error: 'Missing or invalid jobId' }, { status: 400, requestId });
    }

    const jobKey = `analyze:job:${jobId}`;
    const job = await getCached<AnalyzeJobCache>(jobKey);

    if (!job) {
        return jsonWithRequestId({ status: 'not_found', error: 'Job expired or not found' }, { status: 404, requestId });
    }

    if (job.status === 'processing' && job.updatedAt) {
        const staleMs = getStaleJobMs();
        if (Date.now() - job.updatedAt > staleMs) {
            return jsonWithRequestId(
                {
                    status: 'error',
                    errorCode: 'ANALYSIS_STALE',
                    error: 'Analysis timed out or was interrupted. Please try again.',
                },
                { status: 504, requestId },
            );
        }
    }

    if (job.status === 'error') {
        return jsonWithRequestId({ status: 'error', error: job.error }, { status: job.httpStatus ?? 500, requestId });
    }

    return jsonWithRequestId(job, { requestId });
}
