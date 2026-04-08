import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { getCached } from '@/lib/redis';

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
    const job = await getCached<{ status: string; step?: string; result?: unknown; error?: string; httpStatus?: number }>(jobKey);

    if (!job) {
        return jsonWithRequestId({ status: 'not_found', error: 'Job expired or not found' }, { status: 404, requestId });
    }

    if (job.status === 'error') {
        return jsonWithRequestId({ status: 'error', error: job.error }, { status: job.httpStatus ?? 500, requestId });
    }

    return jsonWithRequestId(job, { requestId });
}
