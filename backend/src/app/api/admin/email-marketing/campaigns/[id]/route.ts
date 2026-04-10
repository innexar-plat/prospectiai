import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { getCampaign, updateCampaign, deleteCampaign } from '@/modules/email-marketing';
import { updateCampaignSchema } from '@/modules/email-marketing/domain/types';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/email-marketing/campaigns/:id
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    const campaign = await getCampaign(id);
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: campaign });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Get campaign error', { id, error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/email-marketing/campaigns/:id
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateCampaignSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const campaign = await updateCampaign(id, parsed.data);
    return NextResponse.json({ data: campaign });
  } catch (e) {
    if (e instanceof Error && (e.message.includes('not found') || e.message.includes('Can only edit'))) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const { logger } = await import('@/lib/logger');
    logger.error('Update campaign error', { id, error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/email-marketing/campaigns/:id
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    await deleteCampaign(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message.includes('Cannot delete')) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    const { logger } = await import('@/lib/logger');
    logger.error('Delete campaign error', { id, error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
