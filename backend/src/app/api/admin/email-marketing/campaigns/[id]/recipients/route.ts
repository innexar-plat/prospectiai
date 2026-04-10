import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { getCampaignRecipients } from '@/modules/email-marketing';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/email-marketing/campaigns/:id/recipients
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  try {
    const result = await getCampaignRecipients(id, { status, limit, offset });
    return NextResponse.json(result);
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Get recipients error', { id, error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
