import { NextResponse } from 'next/server';
import { getApiSession } from '@/lib/api-auth';
import { attributionSchema, saveAttribution } from '@/lib/signup-attribution';
import { logger } from '@/lib/logger';

/**
 * POST /api/user/attribution — { firstTouch?, heardFrom?, heardFromOther? }
 * Stores where the user came from (first touch is never overwritten).
 */
export async function POST(req: Request) {
    const session = await getApiSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const parsed = attributionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid attribution' }, { status: 400 });
    try {
        await saveAttribution(session.user.id, parsed.data);
        return NextResponse.json({ ok: true });
    } catch (error) {
        logger.error('Attribution save failed', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
