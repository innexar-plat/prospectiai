import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { rateLimit } from '@/lib/ratelimit';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { searchSchema, formatZodError } from '@/lib/validations/schemas';
import { runSearch, SearchHttpError } from '@/modules/search';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export async function POST(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const { success } = await rateLimit(`search:${ip}`, 30, 60);
        if (!success) {
            return jsonWithRequestId({ error: 'Too many requests. Try again later.' }, { status: 429, requestId });
        }

        const body = await req.json();
        const parsed = searchSchema.safeParse(body);
        if (!parsed.success) {
            logger.info('Search API: validation failed', { requestId, errors: z.flattenError(parsed.error) });
            return jsonWithRequestId({ error: formatZodError(parsed) }, { status: 400, requestId });
        }

        const session = await auth();
        if (!session?.user?.id) {
            logger.info('Search API: unauthenticated', { requestId });
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        logger.info('Search API: running search', { requestId, textQuery: parsed.data.textQuery });
        const result = await runSearch(parsed.data, session.user.id);
        logger.info('Search API: done', { requestId, placesCount: result.places?.length ?? 0 });
        return jsonWithRequestId(result, { requestId });
    } catch (err) {
        if (err instanceof SearchHttpError) {
            return jsonWithRequestId(err.body, { status: err.status, requestId });
        }
        const { logger } = await import('@/lib/logger');
        logger.error('Search error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
