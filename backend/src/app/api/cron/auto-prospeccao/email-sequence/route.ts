import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runEmailSequenceWorker } from '@/modules/auto-prospeccao/application/email-sequence.worker';
import { logger } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/auto-prospeccao/email-sequence
 * Processa sequências de email para todos os workspaces com emailAutoSend ativo.
 * Deve ser chamado a cada 30 minutos.
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
      where: { isActive: true, emailAutoSend: true },
      select: { workspaceId: true },
    });

    let totalEmails = 0;
    const results = [];

    for (const config of activeConfigs) {
      try {
        const run = await prisma.autoProspeccaoRun.create({
          data: { workspaceId: config.workspaceId, triggeredBy: 'cron', status: 'RUNNING' },
        });

        const result = await runEmailSequenceWorker(config.workspaceId, run.id);

        await prisma.autoProspeccaoRun.update({
          where: { id: run.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });

        totalEmails += result.emailsSent;
        results.push({ workspaceId: config.workspaceId, ...result });
      } catch (err) {
        logger.error('cron/email-sequence: workspace error', {
          workspaceId: config.workspaceId,
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }

    logger.info('cron/auto-prospeccao/email-sequence completed', { totalEmails });
    return NextResponse.json({ totalEmails, results });
  } catch (e) {
    logger.error('cron/auto-prospeccao/email-sequence fatal', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
