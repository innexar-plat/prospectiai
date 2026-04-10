import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCampaign } from '@/modules/email-marketing';
import { logger } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/campaign-processor
 * Processes scheduled campaigns that are due. Call every 5 minutes.
 */
export async function POST(req: NextRequest) {
  // Validate cron secret
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const dueCampaigns = await prisma.emailCampaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
      },
      select: { id: true, name: true },
    });

    if (dueCampaigns.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    logger.info('Processing scheduled campaigns', { count: dueCampaigns.length });

    const results = [];
    for (const campaign of dueCampaigns) {
      try {
        const result = await sendCampaign(campaign.id);
        results.push({ id: campaign.id, name: campaign.name, ...result });
        logger.info('Scheduled campaign sent', { campaignId: campaign.id, ...result });
      } catch (err) {
        logger.error('Scheduled campaign failed', {
          campaignId: campaign.id,
          error: err instanceof Error ? err.message : 'Unknown',
        });
        results.push({ id: campaign.id, name: campaign.name, error: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    return NextResponse.json({ processed: dueCampaigns.length, results });
  } catch (e) {
    logger.error('Campaign processor error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
