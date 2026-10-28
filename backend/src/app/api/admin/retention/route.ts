import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { getRetentionReport } from '@/lib/admin-retention';

const ALLOWED_COHORTS = [30, 90, 180];

/** GET /api/admin/retention?days=30|90|180 — activation funnel, weekly engagement, AI cost. */
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const requested = Number(req.nextUrl.searchParams.get('days'));
    const days = ALLOWED_COHORTS.includes(requested) ? requested : 90;
    try {
        return NextResponse.json(await getRetentionReport(days));
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Admin retention report failed', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
