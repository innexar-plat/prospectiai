import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runSearchWorker } from '@/modules/auto-prospeccao/application/search.worker';
import { logger } from '@/lib/logger';
import type { SearchProfile } from '@prisma/client';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/auto-prospeccao/search
 * Executa a busca de novos leads para todos os workspaces com auto-prospecção ativa.
 * Deve ser chamado diariamente (ex: 06:00 UTC).
 */
export async function POST(req: NextRequest) {
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const now = new Date();

    // Buscar workspaces com auto-prospecção ativa
    const activeConfigs = await prisma.autoProspeccaoConfig.findMany({
      where: { isActive: true },
      select: { workspaceId: true, maxLeadsPerRun: true, blockedCnpjs: true },
    });

    let totalLeads = 0;
    const results: Array<{ workspaceId: string; leadsFound: number; error?: string }> = [];

    for (const config of activeConfigs) {
      try {
        // Buscar perfis ativos com nextRunAt <= agora
        const profiles = await prisma.searchProfile.findMany({
          where: {
            AND: [
              { OR: [{ workspaceId: config.workspaceId }, { isSystem: true }] },
              { isActive: true },
              { OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] },
            ],
          },
          orderBy: { priority: 'asc' },
          take: 5,
        });

        if (profiles.length === 0) continue;

        // Criar registro de execução
        const run = await prisma.autoProspeccaoRun.create({
          data: { workspaceId: config.workspaceId, triggeredBy: 'cron', status: 'RUNNING' },
        });

        const blockedCnpjs = Array.isArray(config.blockedCnpjs)
          ? (config.blockedCnpjs as string[])
          : [];

        let workspaceLeads = 0;
        for (const profile of profiles) {
          const result = await runSearchWorker(
            config.workspaceId,
            profile as SearchProfile,
            run.id,
            config.maxLeadsPerRun,
            blockedCnpjs,
          );
          workspaceLeads += result.leadsFound;
        }

        await prisma.autoProspeccaoRun.update({
          where: { id: run.id },
          data: { status: 'COMPLETED', completedAt: new Date(), leadsFound: workspaceLeads },
        });

        totalLeads += workspaceLeads;
        results.push({ workspaceId: config.workspaceId, leadsFound: workspaceLeads });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown';
        logger.error('cron/search: workspace error', { workspaceId: config.workspaceId, error: message });
        results.push({ workspaceId: config.workspaceId, leadsFound: 0, error: message });
      }
    }

    logger.info('cron/auto-prospeccao/search completed', { totalLeads, workspaces: activeConfigs.length });
    return NextResponse.json({ totalLeads, workspaces: activeConfigs.length, results });
  } catch (e) {
    logger.error('cron/auto-prospeccao/search fatal error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
