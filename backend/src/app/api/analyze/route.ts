import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { rateLimit } from '@/lib/ratelimit';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { analyzeSchema, formatZodError } from '@/lib/validations/schemas';
import { runAnalyze, AnalyzeHttpError } from '@/modules/analyze';

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

        const result = await runAnalyze(parsed.data, session.user.id);
        return jsonWithRequestId(result, { requestId });
    } catch (err) {
        if (err instanceof AnalyzeHttpError) {
            return jsonWithRequestId(err.body, { status: err.status, requestId });
        }
        const { logger } = await import('@/lib/logger');
        logger.error('Analyze error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
