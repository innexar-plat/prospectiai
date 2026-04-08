import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { rateLimit } from '@/lib/ratelimit';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { analyzeSchema, formatZodError } from '@/lib/validations/schemas';
import { runAnalyze, AnalyzeHttpError, runAnalyzePreChecks } from '@/modules/analyze';
import { setCached } from '@/lib/redis';
import { randomUUID } from 'crypto';

/**
 * POST /api/analyze
 *
 * Async fire-and-poll pattern:
 * 1. Validates input, auth, limits (fast — <500ms)
 * 2. Returns { jobId, status: 'processing' } immediately
 * 3. Runs AI analysis in background, stores result in Redis
 * 4. Frontend polls GET /api/analyze/status?jobId=X
 */
export async function POST(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const { success } = await rateLimit(`analyze:${ip}`, 15, 60);
        if (!success) {
            return jsonWithRequestId({ error: 'Too many requests. Try again later.' }, { status: 429, requestId });
        }

        const body = await req.json();
        const parsed = analyzeSchema.safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId({ error: formatZodError(parsed) }, { status: 400, requestId });
        }

        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        // Pre-checks: existing analysis cache, limits, onboarding (fast, no AI call)
        const preCheck = await runAnalyzePreChecks(parsed.data, session.user.id);
        if (preCheck.cached) {
            // Already analyzed — return immediately
            return jsonWithRequestId(preCheck.cached, { requestId });
        }

        // Start async job
        const jobId = randomUUID();
        const jobKey = `analyze:job:${jobId}`;

        // Store initial job state in Redis (TTL 5 min)
        await setCached(jobKey, { status: 'processing', step: 'profile' }, 300);

        // Fire background analysis (no await — runs after response is sent)
        runAnalyze(parsed.data, session.user.id, async (step) => {
            // Update progress in Redis
            await setCached(jobKey, { status: 'processing', step }, 300).catch(() => {});
        }).then(async (result) => {
            await setCached(jobKey, { status: 'done', result }, 300);
        }).catch(async (err) => {
            const msg = err instanceof AnalyzeHttpError ? err.body.error : (err instanceof Error ? err.message : 'Internal error');
            const status = err instanceof AnalyzeHttpError ? err.status : 500;
            await setCached(jobKey, { status: 'error', error: msg, httpStatus: status }, 300);
        });

        return jsonWithRequestId({ jobId, status: 'processing' }, { requestId });
    } catch (err) {
        if (err instanceof AnalyzeHttpError) {
            return jsonWithRequestId(err.body, { status: err.status, requestId });
        }
        const { logger } = await import('@/lib/logger');
        logger.error('Analyze error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
