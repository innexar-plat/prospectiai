/**
 * Usage event recording for admin dashboard metrics.
 * Fire-and-forget: does not block the request; errors are logged only.
 */

import { prisma } from '@/lib/prisma';
import type { UsageEventType } from '@prisma/client';

export interface RecordUsageOptions {
  workspaceId: string;
  userId?: string | null;
  type: UsageEventType;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

export interface WorkspaceUsage {
  googlePlacesSearch: number;
  googlePlacesDetails: number;
  serperRequests: number;
  aiInputTokens: number;
  aiOutputTokens: number;
}

/**
 * Record a usage event (Google Places, Serper, AI tokens).
 * Runs in background; does not throw.
 */
export function recordUsageEvent(options: RecordUsageOptions): void {
  const { workspaceId, userId, type, quantity = 1, metadata } = options;
  void prisma.usageEvent
    .create({
      data: {
        workspaceId,
        userId: userId ?? undefined,
        type,
        quantity,
        metadata: metadata ? (metadata as object) : undefined,
      },
    })
    .catch((err) => {
      import('@/lib/logger').then(({ logger }) =>
        logger.warn('Usage event record failed', { workspaceId, type, error: err instanceof Error ? err.message : 'Unknown' })
      );
    });
}

/**
 * Get aggregated usage for one or more workspaces.
 */
export async function getWorkspaceUsage(workspaceIds: string[]): Promise<Map<string, WorkspaceUsage>> {
  if (workspaceIds.length === 0) return new Map();
  const defaultUsage: WorkspaceUsage = {
    googlePlacesSearch: 0,
    googlePlacesDetails: 0,
    serperRequests: 0,
    aiInputTokens: 0,
    aiOutputTokens: 0,
  };
  const map = new Map<string, WorkspaceUsage>(workspaceIds.map((id) => [id, { ...defaultUsage }]));

  const nonAi = await prisma.usageEvent.groupBy({
    by: ['workspaceId', 'type'],
    where: { workspaceId: { in: workspaceIds }, type: { not: 'AI_TOKENS' } },
    _sum: { quantity: true },
  });
  for (const row of nonAi) {
    const u = map.get(row.workspaceId)!;
    const sum = row._sum.quantity ?? 0;
    if (row.type === 'GOOGLE_PLACES_SEARCH') u.googlePlacesSearch = sum;
    else if (row.type === 'GOOGLE_PLACES_DETAILS') u.googlePlacesDetails = sum;
    else if (row.type === 'SERPER_REQUEST') u.serperRequests = sum;
  }

  const aiEvents = await prisma.usageEvent.findMany({
    where: { workspaceId: { in: workspaceIds }, type: 'AI_TOKENS' },
    select: { workspaceId: true, metadata: true },
  });
  for (const e of aiEvents) {
    const u = map.get(e.workspaceId)!;
    const m = e.metadata as { inputTokens?: number; outputTokens?: number } | null;
    if (m) {
      u.aiInputTokens += Number(m.inputTokens) || 0;
      u.aiOutputTokens += Number(m.outputTokens) || 0;
    }
  }
  return map;
}
