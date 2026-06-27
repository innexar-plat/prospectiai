import { NextResponse } from 'next/server';
import { runBrTrialReactivationCampaign } from '@/lib/br-trial-reactivation';
import { logger } from '@/lib/logger';

/**
 * Cron: send BR trial reactivation promo emails to expired-trial owners.
 * Dry-run unless query `?send=1` or header `x-cron-send: 1`.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const secretHeader = req.headers.get('x-cron-secret');
  const secret = process.env.CRON_SECRET;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : secretHeader;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const send =
    url.searchParams.get('send') === '1' ||
    req.headers.get('x-cron-send') === '1';

  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw != null ? Number(limitRaw) : undefined;

  try {
    const result = await runBrTrialReactivationCampaign({
      dryRun: !send,
      limit: limit != null && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : undefined,
    });

    logger.info('BR trial reactivation cron completed', {
      dryRun: result.dryRun,
      eligible: result.eligible,
      sent: result.sent,
      failed: result.failed,
    });

    return NextResponse.json({
      ok: true,
      dryRun: result.dryRun,
      eligible: result.eligible,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (err) {
    logger.error('BR trial reactivation cron failed', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return NextResponse.json({ error: 'Job failed' }, { status: 500 });
  }
}
