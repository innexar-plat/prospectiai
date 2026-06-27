import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runAnalyzeWorker } from '@/modules/auto-prospeccao/application/analyze.worker';
import { logger } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/auto-prospeccao/analyze
 * Analisa leads NEW de todos os workspaces ativos, calcula score, classifica HOT/WARM/COLD.
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
      where: { isActive: true },
      select: { workspaceId: true, hotScoreMin: true, warmScoreMin: true },
    });

    let totalAnalyzed = 0;
    let totalHot = 0;
    const results = [];

    for (const config of activeConfigs) {
      try {
        const run = await prisma.autoProspeccaoRun.create({
          data: { workspaceId: config.workspaceId, triggeredBy: 'cron', status: 'RUNNING' },
        });

        const result = await runAnalyzeWorker(
          config.workspaceId,
          run.id,
          config.hotScoreMin,
          config.warmScoreMin,
          50,
        );

        await prisma.autoProspeccaoRun.update({
          where: { id: run.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });

        totalAnalyzed += result.analyzed;
        totalHot += result.hot;
        results.push({ workspaceId: config.workspaceId, ...result });
      } catch (err) {
        logger.error('cron/analyze: workspace error', {
          workspaceId: config.workspaceId,
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }

    logger.info('cron/auto-prospeccao/analyze completed', { totalAnalyzed, totalHot });
    return NextResponse.json({ totalAnalyzed, totalHot, results });
  } catch (e) {
    logger.error('cron/auto-prospeccao/analyze fatal', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
