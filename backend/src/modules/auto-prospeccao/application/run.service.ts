import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/** A failed run must not stay RUNNING forever in the admin panel. */
export async function failRun(runId: string | null, err: unknown): Promise<void> {
  if (!runId) return;
  try {
    await prisma.autoProspeccaoRun.update({
      where: { id: runId },
      data: { status: 'FAILED', completedAt: new Date(), errorLog: (err instanceof Error ? err.message : 'Unknown').slice(0, 2000) },
    });
  } catch (e) {
    logger.warn('auto-prospeccao: could not mark run as failed', { runId, error: e instanceof Error ? e.message : 'Unknown' });
  }
}

/** Runs interrupted by a restart (nothing left alive to finish them). */
export async function closeStaleRuns(now = new Date()): Promise<void> {
  await prisma.autoProspeccaoRun.updateMany({
    where: { status: 'RUNNING', startedAt: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) } },
    data: { status: 'FAILED', completedAt: now, errorLog: 'Interrupted (process restarted or timed out)' },
  });
}

/**
 * A workspace with its own active profiles prospects only its own audience; the system profiles
 * (Precision IA's audience, BR) are the default for BR workspaces that have none.
 */
export async function profileScope(workspaceId: string, market: string | null | undefined): Promise<Prisma.SearchProfileWhereInput> {
  const own = await prisma.searchProfile.count({ where: { workspaceId, isSystem: false, isActive: true } });
  return own > 0 || market === 'US' ? { workspaceId, isSystem: false } : { isSystem: true };
}
