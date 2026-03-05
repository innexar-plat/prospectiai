import type { PrismaClient } from '@prisma/client';

export type MemberLimits = {
  dailyLeadsLimit: number | null;
  weeklyLeadsLimit: number | null;
  monthlyLeadsLimit: number | null;
};

export type MemberUsage = {
  today: number;
  week: number;
  month: number;
};

/**
 * Count consumptions (search + analysis) for a member in a workspace within a date range.
 * One search = 1 consumption, one analysis = 1 consumption.
 */
async function countConsumptions(
  prisma: PrismaClient,
  workspaceId: string,
  userId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const [searchCount, analysisCount] = await Promise.all([
    prisma.searchHistory.count({
      where: {
        workspaceId,
        userId,
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.leadAnalysis.count({
      where: {
        workspaceId,
        userId,
        createdAt: { gte: from, lte: to },
      },
    }),
  ]);
  return searchCount + analysisCount;
}

/**
 * Returns current usage (today, rolling 7 days, calendar month) for a member in a workspace.
 */
export async function getMemberUsage(
  prisma: PrismaClient,
  workspaceId: string,
  userId: string,
): Promise<MemberUsage> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [today, week, month] = await Promise.all([
    countConsumptions(prisma, workspaceId, userId, todayStart, now),
    countConsumptions(prisma, workspaceId, userId, weekStart, now),
    countConsumptions(prisma, workspaceId, userId, monthStart, now),
  ]);

  return { today, week, month };
}

export class MemberLimitExceededError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly period: 'daily' | 'weekly' | 'monthly',
    public readonly used: number,
    public readonly limit: number,
  ) {
    super(message);
    this.name = 'MemberLimitExceededError';
  }
}

/**
 * Checks if the member has any individual limits and whether current usage would exceed them.
 * If any limit is exceeded, throws MemberLimitExceededError (403).
 * Call this before allowing a new consumption (search or analyze).
 */
export async function checkMemberLimits(
  prisma: PrismaClient,
  membership: MemberLimits,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const hasAnyLimit =
    membership.dailyLeadsLimit != null ||
    membership.weeklyLeadsLimit != null ||
    membership.monthlyLeadsLimit != null;
  if (!hasAnyLimit) return;

  const usage = await getMemberUsage(prisma, workspaceId, userId);

  if (
    membership.dailyLeadsLimit != null &&
    usage.today >= membership.dailyLeadsLimit
  ) {
    throw new MemberLimitExceededError(
      `Limite diário de créditos atingido (${usage.today}/${membership.dailyLeadsLimit})`,
      'MEMBER_LIMIT_EXCEEDED',
      'daily',
      usage.today,
      membership.dailyLeadsLimit,
    );
  }
  if (
    membership.weeklyLeadsLimit != null &&
    usage.week >= membership.weeklyLeadsLimit
  ) {
    throw new MemberLimitExceededError(
      `Limite semanal de créditos atingido (${usage.week}/${membership.weeklyLeadsLimit})`,
      'MEMBER_LIMIT_EXCEEDED',
      'weekly',
      usage.week,
      membership.weeklyLeadsLimit,
    );
  }
  if (
    membership.monthlyLeadsLimit != null &&
    usage.month >= membership.monthlyLeadsLimit
  ) {
    throw new MemberLimitExceededError(
      `Limite mensal de créditos atingido (${usage.month}/${membership.monthlyLeadsLimit})`,
      'MEMBER_LIMIT_EXCEEDED',
      'monthly',
      usage.month,
      membership.monthlyLeadsLimit,
    );
  }
}
