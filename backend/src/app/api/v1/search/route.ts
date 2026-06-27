import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { rateLimit } from '@/lib/ratelimit';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { searchSchema, formatZodError } from '@/lib/validations/schemas';
import { runSearch, SearchHttpError } from '@/modules/search';

function getClientIp(req: NextRequest): string {
    const forwardedFor = req.headers.get('x-forwarded-for');
    if (!forwardedFor) return '127.0.0.1';
    const firstIp = forwardedFor.split(',')[0]?.trim();
    return firstIp || '127.0.0.1';
}

function parseEnvInt(name: string, fallback: number): number {
    const value = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function POST(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);

    try {
        const session = await auth();
        const ip = getClientIp(req);
        const isAuthenticated = Boolean(session?.user?.id);
        const rateLimitMax = isAuthenticated
            ? parseEnvInt('SEARCH_RATE_LIMIT_AUTH_MAX', parseEnvInt('SEARCH_RATE_LIMIT_MAX', 240))
            : parseEnvInt('SEARCH_RATE_LIMIT_ANON_MAX', 30);
        const rateLimitWindowSeconds = parseEnvInt('SEARCH_RATE_LIMIT_WINDOW_SECONDS', 60);
        const workspaceHint = req.headers.get('x-workspace-id')?.trim() || 'default';
        const userHint = session?.user?.id?.trim() || req.headers.get('x-user-id')?.trim() || 'anonymous';
        const rateId = `search:v1:${workspaceHint}:${userHint}:${ip}`;
        const { success } = await rateLimit(rateId, rateLimitMax, rateLimitWindowSeconds);
        if (!success) {
            return jsonWithRequestId({ error: 'Too many requests. Try again later.' }, { status: 429, requestId });
        }

        const body = await req.json();
        const parsed = searchSchema.safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId({ error: formatZodError(parsed) }, { status: 400, requestId });
        }

        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const result = await runSearch(parsed.data, session.user.id);
        return jsonWithRequestId(result, { requestId });
    } catch (error) {
        if (error instanceof SearchHttpError) {
            return jsonWithRequestId(error.body, { status: error.status, requestId });
        }

        const { logger } = await import('@/lib/logger');
        logger.error('V1 search error', { error: error instanceof Error ? error.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
