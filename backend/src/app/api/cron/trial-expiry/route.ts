import { NextResponse } from 'next/server';
import { runTrialExpiryJob } from '@/lib/trial';
import { logger } from '@/lib/logger';

/**
 * Cron endpoint: expire trials past currentPeriodEnd.
 * Call with Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    const secretHeader = req.headers.get('x-cron-secret');
    const secret = process.env.CRON_SECRET;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : secretHeader;

    if (!secret || token !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const expired = await runTrialExpiryJob();
        logger.info('Trial expiry cron completed', { expired });
        return NextResponse.json({ ok: true, expired });
    } catch (err) {
        logger.error('Trial expiry cron failed', { error: err instanceof Error ? err.message : 'Unknown' });
        return NextResponse.json({ error: 'Job failed' }, { status: 500 });
    }
}
