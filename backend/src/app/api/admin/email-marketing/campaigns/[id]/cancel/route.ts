import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { cancelCampaign } from '@/modules/email-marketing';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/email-marketing/campaigns/:id/cancel
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    await cancelCampaign(id);
    return NextResponse.json({ ok: true, message: 'Campaign cancelled' });
  } catch (e) {
    if (e instanceof Error && e.message.includes('Can only cancel')) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const { logger } = await import('@/lib/logger');
    logger.error('Cancel campaign error', { id, error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
