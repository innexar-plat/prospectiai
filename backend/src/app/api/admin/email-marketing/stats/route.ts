import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { getEmailMarketingStats } from '@/modules/email-marketing';

/**
 * GET /api/admin/email-marketing/stats
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const stats = await getEmailMarketingStats();
    return NextResponse.json(stats);
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Email marketing stats error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
