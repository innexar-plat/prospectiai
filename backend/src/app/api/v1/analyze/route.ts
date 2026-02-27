import { NextRequest } from 'next/server';
import { analyzeLead, type BusinessData, type UserBusinessProfile } from '@/lib/gemini';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { v1AnalyzeSchema, formatZodError } from '@/lib/validations/schemas';

export async function POST(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const body = await req.json();
        const parsed = v1AnalyzeSchema.safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId({ error: formatZodError(parsed) }, { status: 400, requestId });
        }
        const { userProfile, locale, userId, ...businessData } = parsed.data;

        const result = await analyzeLead(businessData as BusinessData, userProfile as UserBusinessProfile | undefined, locale || 'pt', userId);

        return jsonWithRequestId(result.analysis, { requestId });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('V1 analyze error', { error: error instanceof Error ? error.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
