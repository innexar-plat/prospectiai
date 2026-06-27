import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runCrmPushWorker } from '@/modules/auto-prospeccao/application/crm-push.worker';
import { logger } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/auto-prospeccao/crm-push
 * Envia leads HOT ao CRM configurado para workspaces com crmAutoSend ativo.
 * Deve ser chamado a cada 15 minutos.
 */
export async function POST(req: NextRequest) {
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const activeConfigs = await prisma.autoProspeccaoConfig.findMany({
      where: { isActive: true, crmAutoSend: true },
      select: { workspaceId: true, maxCrmPushPerDay: true },
    });

    let totalPushed = 0;
    const results = [];

    for (const config of activeConfigs) {
      try {
        const run = await prisma.autoProspeccaoRun.create({
          data: { workspaceId: config.workspaceId, triggeredBy: 'cron', status: 'RUNNING' },
        });

        const result = await runCrmPushWorker(
          config.workspaceId,
          run.id,
          Math.min(config.maxCrmPushPerDay, 20), // max 20 per cron run to spread throughout the day
        );

        await prisma.autoProspeccaoRun.update({
          where: { id: run.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });

        totalPushed += result.pushed;
        results.push({ workspaceId: config.workspaceId, ...result });
      } catch (err) {
        logger.error('cron/crm-push: workspace error', {
          workspaceId: config.workspaceId,
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }

    logger.info('cron/auto-prospeccao/crm-push completed', { totalPushed });
    return NextResponse.json({ totalPushed, results });
  } catch (e) {
    logger.error('cron/auto-prospeccao/crm-push fatal', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
