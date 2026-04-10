import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { listCampaigns, createCampaign } from '@/modules/email-marketing';
import { createCampaignSchema } from '@/modules/email-marketing/domain/types';

/**
 * GET /api/admin/email-marketing/campaigns
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  try {
    const result = await listCampaigns({ status, limit, offset });
    return NextResponse.json(result);
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('List campaigns error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/email-marketing/campaigns
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = createCampaignSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const campaign = await createCampaign(parsed.data, session.user.id);
    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === 'Template not found') {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    const { logger } = await import('@/lib/logger');
    logger.error('Create campaign error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
