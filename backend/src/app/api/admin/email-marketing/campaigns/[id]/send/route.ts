import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { sendCampaign, getCampaign } from '@/modules/email-marketing';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/email-marketing/campaigns/:id/send
 * Trigger campaign send (immediate) or schedule it.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    const campaign = await getCampaign(id);
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // If campaign has scheduledAt in the future, just mark as SCHEDULED
    if (campaign.scheduledAt && campaign.scheduledAt > new Date()) {
      const { prisma } = await import('@/lib/prisma');
      await prisma.emailCampaign.update({
        where: { id },
        data: { status: 'SCHEDULED' },
      });
      return NextResponse.json({ message: 'Campaign scheduled', scheduledAt: campaign.scheduledAt });
    }

    // Send immediately (fire and forget for large campaigns)
    const result = await sendCampaign(id);
    return NextResponse.json({
      message: 'Campaign sent',
      totalRecipients: result.totalRecipients,
      totalSent: result.totalSent,
      totalFailed: result.totalFailed,
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes('not in a sendable state')) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const { logger } = await import('@/lib/logger');
    logger.error('Send campaign error', { id, error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
