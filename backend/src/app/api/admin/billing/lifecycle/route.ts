import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { runBillingLifecycleJob } from '@/lib/billing-lifecycle';
import { acquireRedisLock, releaseRedisLock } from '@/lib/redis';
import { recordCronRun } from '@/lib/ops-telemetry';

/**
 * POST /api/admin/billing/lifecycle { dryRun?: boolean } — runs the daily billing job on demand.
 * Real runs charge/email customers, so they share the cron lock and are audited.
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({})) as { dryRun?: unknown };
    const dryRun = body.dryRun !== false;
    const lockToken = `admin-${Date.now()}`;
    if (!dryRun && !(await acquireRedisLock('cron:billing-lifecycle', lockToken, 15 * 60 * 1000))) {
        return NextResponse.json({ error: 'O job já está em execução' }, { status: 409 });
    }
    const start = Date.now();
    try {
        const report = await runBillingLifecycleJob({ dryRun });
        if (!dryRun) {
            await recordCronRun('billing-lifecycle', { ok: report.errors.length === 0, durationMs: Date.now() - start, summary: `manual: ${JSON.stringify(report.counts)}` });
            logAdminAction(session, 'admin.billing.lifecycle-run', { details: { counts: report.counts, errors: report.errors.length } }).catch(() => {});
        }
        return NextResponse.json(report);
    } finally {
        if (!dryRun) await releaseRedisLock('cron:billing-lifecycle', lockToken);
    }
}
