import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspace, requireModuleEnabled } from '../_helpers';
import { runSearchWorker } from '@/modules/auto-prospeccao/application/search.worker';
import { runAnalyzeWorker } from '@/modules/auto-prospeccao/application/analyze.worker';
import type { SearchProfile } from '@prisma/client';

/** POST /api/auto-prospeccao/trigger — dispara uma rodada manual.
 *
 * Body opcional: `{ dryRun: true }` — simula sem escrever no banco.
 * Quando dryRun, a resposta é síncrona e retorna o preview dos resultados.
 */
export async function POST(req: NextRequest) {
  const authResult = await requireWorkspace(true);
  if (!authResult.ok) return authResult.error;

  const { workspaceId, userId } = authResult.ctx;

  const err = await requireModuleEnabled(workspaceId);
  if (err) return err;

  const config = await prisma.autoProspeccaoConfig.findUnique({ where: { workspaceId } });
  if (!config?.isActive) {
    return NextResponse.json({ error: 'Auto-Prospecção não está ativa para este workspace' }, { status: 400 });
  }

  // Parse body (dryRun é opcional)
  let dryRun = false;
  try {
    const body = await req.json().catch(() => ({}));
    dryRun = body?.dryRun === true;
  } catch {
    // body vazio é válido
  }

  if (dryRun) {
    return executeDryRun(workspaceId, config);
  }

  // Criar registro de execução
  const run = await prisma.autoProspeccaoRun.create({
    data: { workspaceId, triggeredBy: userId, status: 'RUNNING' },
  });

  // Disparar execução assíncrona (fire-and-forget)
  void executeRun(workspaceId, run.id, config).catch((err) => {
    console.error('trigger: run failed', err);
  });

  return NextResponse.json({ data: { runId: run.id, status: 'RUNNING' } }, { status: 202 });
}

/** Executa simulação síncrona sem criar leads nem persistir nada */
async function executeDryRun(
  workspaceId: string,
  config: NonNullable<Awaited<ReturnType<typeof prisma.autoProspeccaoConfig.findUnique>>>,
) {
  const profiles = await prisma.searchProfile.findMany({
    where: { OR: [{ workspaceId }, { isSystem: true }], isActive: true },
    orderBy: { priority: 'asc' },
    take: 3,
  });

  const blockedCnpjs = Array.isArray(config.blockedCnpjs)
    ? (config.blockedCnpjs as string[])
    : [];

  const profileResults: Array<{ profileId: string; profileName: string; wouldFind: number; dedupSkip: number }> = [];
  let totalWouldFind = 0;

  for (const profile of profiles) {
    const result = await runSearchWorker(
      workspaceId,
      profile as SearchProfile,
      'dry-run',
      config.maxLeadsPerRun,
      blockedCnpjs,
      true, // dryRun = true
    );
    profileResults.push({
      profileId: profile.id,
      profileName: profile.name,
      wouldFind: result.leadsFound,
      dedupSkip: result.leadsDedupSkip,
    });
    totalWouldFind += result.leadsFound;
  }

  return NextResponse.json({
    data: {
      dryRun: true,
      totalWouldFind,
      profiles: profileResults,
    },
  });
}

async function executeRun(
  workspaceId: string,
  runId: string,
  config: Awaited<ReturnType<typeof prisma.autoProspeccaoConfig.findUnique>>,
) {
  if (!config) return;

  try {
    const profiles = await prisma.searchProfile.findMany({
      where: { OR: [{ workspaceId }, { isSystem: true }], isActive: true },
      orderBy: { priority: 'asc' },
      take: 3, // máximo de perfis por execução manual
    });

    const blockedCnpjs = Array.isArray(config.blockedCnpjs)
      ? (config.blockedCnpjs as string[])
      : [];

    for (const profile of profiles) {
      await runSearchWorker(
        workspaceId,
        profile as SearchProfile,
        runId,
        config.maxLeadsPerRun,
        blockedCnpjs,
      );
    }

    await runAnalyzeWorker(workspaceId, runId, config.hotScoreMin, config.warmScoreMin, 50);

    await prisma.autoProspeccaoRun.update({
      where: { id: runId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  } catch (err) {
    await prisma.autoProspeccaoRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorLog: err instanceof Error ? err.message : 'Unknown error',
      },
    });
  }
}
