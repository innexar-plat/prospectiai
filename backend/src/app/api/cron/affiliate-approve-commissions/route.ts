import { NextResponse } from 'next/server';
import { approveCommissionsByAvailableAt } from '@/lib/affiliate';
import { logger } from '@/lib/logger';

/**
 * Cron: aprova comissões cujo availableAt já passou (PENDING -> APPROVED).
 * Chamar com Authorization: Bearer <CRON_SECRET> ou header x-cron-secret.
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
    const count = await approveCommissionsByAvailableAt();
    logger.info('Affiliate approve commissions cron completed', { count });
    return NextResponse.json({ ok: true, approved: count });
  } catch (err) {
    logger.error('Affiliate approve commissions cron failed', { error: err instanceof Error ? err.message : 'Unknown' });
    return NextResponse.json({ error: 'Job failed' }, { status: 500 });
  }
}
