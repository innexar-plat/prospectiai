import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/api-auth';
import { getRadar } from '@/lib/radar';
import { logger } from '@/lib/logger';

/**
 * GET /api/radar[?fresh=1]
 * Companies that recently opened in the niches/places the user searches (cached 12 h).
 */
export async function GET(req: NextRequest) {
    const session = await getApiSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const radar = await getRadar(session.user.id, { fresh: req.nextUrl.searchParams.get('fresh') === '1' });
        return NextResponse.json(radar);
    } catch (error) {
        logger.error('Radar error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
