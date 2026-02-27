import { NextResponse } from 'next/server';
import { runGracePeriodExpiryJob } from '@/lib/grace-period';
import { logger } from '@/lib/logger';

/**
 * Cron endpoint: pause workspaces whose grace period has expired (past_due, gracePeriodEnd < now).
 * Call with Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 * Schedule daily (e.g. 0 2 * * *).
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
        const paused = await runGracePeriodExpiryJob();
        logger.info('Grace period cron completed', { paused });
        return NextResponse.json({ ok: true, paused });
    } catch (err) {
        logger.error('Grace period cron failed', { error: err instanceof Error ? err.message : 'Unknown' });
        return NextResponse.json({ error: 'Job failed' }, { status: 500 });
    }
}
