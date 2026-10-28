import { instrumentCron } from '@/lib/ops-telemetry';
import { NextResponse } from 'next/server';
import { runBillingLifecycleJob } from '@/lib/billing-lifecycle';
import { acquireRedisLock, releaseRedisLock } from '@/lib/redis';
import { logger } from '@/lib/logger';

const LOCK_KEY = 'cron:billing-lifecycle';
const LOCK_TTL_MS = 15 * 60 * 1000;

/**
 * Cron endpoint: daily billing lifecycle (trials, grace, scheduled plan changes, monthly
 * credit expiry, recurring PIX charges, unpaid plan expiry). Schedule daily (e.g. 0 9 * * *).
 * Call with Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 * `?dryRun=1` returns what would change without writing, charging or emailing.
 */
async function handle(req: Request) {
    const authHeader = req.headers.get('authorization');
    const secretHeader = req.headers.get('x-cron-secret');
    const secret = process.env.CRON_SECRET;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : secretHeader;

    if (!secret || token !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';
    const lockToken = `${Date.now()}`;
    if (!dryRun && !(await acquireRedisLock(LOCK_KEY, lockToken, LOCK_TTL_MS))) {
        return NextResponse.json({ error: 'Job already running' }, { status: 409 });
    }

    try {
        const report = await runBillingLifecycleJob({ dryRun });
        return NextResponse.json({ ok: true, ...report });
    } catch (err) {
        logger.error('Billing lifecycle cron failed', { error: err instanceof Error ? err.message : 'Unknown' });
        return NextResponse.json({ error: 'Job failed' }, { status: 500 });
    } finally {
        if (!dryRun) await releaseRedisLock(LOCK_KEY, lockToken);
    }
}

export const GET = instrumentCron('billing-lifecycle', handle);
export const POST = instrumentCron('billing-lifecycle', handle);
