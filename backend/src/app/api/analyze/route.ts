import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { rateLimit } from '@/lib/ratelimit';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { analyzeSchema, formatZodError } from '@/lib/validations/schemas';
import { runAnalyze, AnalyzeHttpError, runAnalyzePreChecks } from '@/modules/analyze';
import { acquireRedisLock, releaseRedisLock, setCached, waitForCached } from '@/lib/redis';
import { randomUUID } from 'crypto';
import { withAnalyzeBulkhead } from '@/lib/analyze-bulkhead';
import { hydrateAiRuntimeControlsFromSql } from '@/lib/ai-runtime-controls';
import { resolveAiRequestLocale } from '@/lib/i18n/locale';

const DEFAULT_JOB_TTL_SECONDS = 900;
const DEFAULT_LOCK_TTL_MS = 120000;
const DEFAULT_WAIT_RESULT_TIMEOUT_MS = 15000;
const DEFAULT_ANALYZE_RATE_LIMIT_MAX = 15;
const DEFAULT_ANALYZE_RATE_LIMIT_WINDOW_SECONDS = 60;

type AnalyzeJobState = {
    status: 'processing' | 'done' | 'error';
    step?: string;
    result?: unknown;
    error?: string;
    httpStatus?: number;
    jobId?: string;
    updatedAt?: number;
};

function withJobTimestamp(state: AnalyzeJobState): AnalyzeJobState {
    return { ...state, updatedAt: Date.now() };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getJobTtlSeconds(): number {
    return parsePositiveInt(process.env.ANALYZE_JOB_TTL_SECONDS, DEFAULT_JOB_TTL_SECONDS);
}

function getLockTtlMs(): number {
    return parsePositiveInt(process.env.ANALYZE_LOCK_TTL_MS, DEFAULT_LOCK_TTL_MS);
}

function getWaitResultTimeoutMs(): number {
    return parsePositiveInt(process.env.ANALYZE_WAIT_RESULT_TIMEOUT_MS, DEFAULT_WAIT_RESULT_TIMEOUT_MS);
}

function getAnalyzeRateLimitMax(): number {
    return parsePositiveInt(process.env.ANALYZE_RATE_LIMIT_MAX, DEFAULT_ANALYZE_RATE_LIMIT_MAX);
}

function getAnalyzeRateLimitWindowSeconds(): number {
    return parsePositiveInt(process.env.ANALYZE_RATE_LIMIT_WINDOW_SECONDS, DEFAULT_ANALYZE_RATE_LIMIT_WINDOW_SECONDS);
}

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
        await hydrateAiRuntimeControlsFromSql();

        const body = await req.json().catch(() => null);
        if (body === null) {
            return jsonWithRequestId({ error: 'Invalid JSON body' }, { status: 400, requestId });
        }
        const parsed = analyzeSchema.safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId({ error: formatZodError(parsed) }, { status: 400, requestId });
        }

        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const workspaceHint = req.headers.get('x-workspace-id')?.trim() || 'default';
        const rateIdentifier = `analyze:${workspaceHint}:${session.user.id}:${ip}`;
        const { success } = await rateLimit(
            rateIdentifier,
            getAnalyzeRateLimitMax(),
            getAnalyzeRateLimitWindowSeconds(),
        );
        if (!success) {
            return jsonWithRequestId({ error: 'Too many requests. Try again later.' }, { status: 429, requestId });
        }

        // Pre-checks: existing analysis cache, limits, onboarding (fast, no AI call)
        const preCheck = await runAnalyzePreChecks(parsed.data, session.user.id);
        if (preCheck.cached) {
            // Already analyzed — return immediately
            return jsonWithRequestId(preCheck.cached, { requestId });
        }

        const lockKey = `analyze:lock:${session.user.id}:${parsed.data.placeId}`;
        const sharedJobKey = `analyze:shared:${session.user.id}:${parsed.data.placeId}`;
        const lockToken = randomUUID();
        const lockAcquired = await acquireRedisLock(lockKey, lockToken, getLockTtlMs());

        if (!lockAcquired) {
            const sharedResult = await waitForCached<AnalyzeJobState>(sharedJobKey, getWaitResultTimeoutMs(), 250);
            if (sharedResult?.status === 'done' && sharedResult.result) {
                return jsonWithRequestId(sharedResult.result, { requestId });
            }

            if (sharedResult?.status === 'error') {
                return jsonWithRequestId(
                    { error: sharedResult.error || 'Analysis failed', status: 'error' },
                    { status: sharedResult.httpStatus ?? 500, requestId },
                );
            }

            return jsonWithRequestId(
                { status: 'processing', error: 'Analysis already running for this lead. Keep polling status endpoint.' },
                { status: 202, requestId },
            );
        }

        // Start async job
        const jobId = randomUUID();
        const jobKey = `analyze:job:${jobId}`;
        const jobTtlSeconds = getJobTtlSeconds();
        const processingState = withJobTimestamp({ status: 'processing', step: 'profile', jobId });
        const analyzeLocale = resolveAiRequestLocale(req, parsed.data.locale);
        const analyzeInput = { ...parsed.data, locale: analyzeLocale };

        // Store initial job state in Redis
        await Promise.all([
            setCached(jobKey, processingState, jobTtlSeconds),
            setCached(sharedJobKey, processingState, jobTtlSeconds),
        ]);

        // Fire background analysis (no await — runs after response is sent)
        withAnalyzeBulkhead(() =>
            runAnalyze(analyzeInput, session.user.id, async (step) => {
                const state = withJobTimestamp({ status: 'processing', step, jobId });
                await Promise.all([
                    setCached(jobKey, state, jobTtlSeconds),
                    setCached(sharedJobKey, state, jobTtlSeconds),
                ]).catch(() => {});
            })
        )
            .then(async (result) => {
                const state = withJobTimestamp({ status: 'done', result, jobId });
                await Promise.all([
                    setCached(jobKey, state, jobTtlSeconds),
                    setCached(sharedJobKey, state, jobTtlSeconds),
                ]);
            })
            .catch(async (err) => {
                const msg = err instanceof AnalyzeHttpError ? err.body.error : (err instanceof Error ? err.message : 'Internal error');
                const status = err instanceof AnalyzeHttpError ? err.status : (err instanceof Error && err.message === 'ANALYZE_BULKHEAD_TIMEOUT' ? 503 : 500);
                const state = withJobTimestamp({
                    status: 'error',
                    error: typeof msg === 'string' ? msg : 'Internal error',
                    httpStatus: status,
                    jobId,
                });
                await Promise.all([
                    setCached(jobKey, state, jobTtlSeconds),
                    setCached(sharedJobKey, state, jobTtlSeconds),
                ]);
            })
            .finally(async () => {
                await releaseRedisLock(lockKey, lockToken);
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
