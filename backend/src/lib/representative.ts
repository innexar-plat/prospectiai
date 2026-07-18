import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { Session } from 'next-auth';
import type { Market } from '@/lib/market';
import type { RepLevel, RepCommissionStatus, Representative, Prisma } from '@prisma/client';
import { hashToken } from '@/lib/auth-utils';

export type RepDashboard = {
  id: string;
  name: string;
  email: string;
  level: RepLevel;
  status: string;
  directCommissionPct: number;
  affiliateOverridePct: number;
  commissionHoldDays: number;
  creditLimit: number;
  minPayoutCents: number;
  monthlyGoalCents: number | null;
  region: string | null;
  payoutType: string | null;
  payoutPayload: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  balanceCents: number;
  pendingCents: number;
  totalClients: number;
  monthClientCount: number;
  monthCommissionCents: number;
  goalProgress: { targetCents: number; achievedCents: number; percent: number } | null;
  linkClicks: number;
  leadsCount: number;
  activeClientsCount: number;
};

export async function getRepresentative(session: Session | null) {
  if (!session?.user?.id) return null;
  return prisma.representative.findUnique({
    where: { userId: session.user.id },
  });
}

export function buildRepLink(code: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '');
  return `${base}/?rep=${code}`;
}

export async function getRepByCode(code: string) {
  if (!code || typeof code !== 'string') return null;
  // The rep "code" is the rep's lowercase cuid id — do NOT uppercase it.
  const trimmed = code.trim();
  if (!trimmed) return null;
  return prisma.representative.findFirst({
    where: { id: trimmed },
  });
}

/** Reads the rep_code cookie set by the frontend (?rep= attribution) — used for OAuth signup, which has no JS step before redirect. */
export function parseRepCodeFromCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)rep_code=([^;]*)/i);
  if (!match?.[1]) return null;
  try {
    const raw = decodeURIComponent(match[1]).trim().slice(0, 50);
    return raw || null;
  } catch {
    return null;
  }
}

export async function getRepByWorkspaceId(workspaceId: string) {
  return prisma.representative.findUnique({
    where: { workspaceId },
  });
}

/**
 * Creates a LEAD-status RepClient on signup when a valid `?rep=` referral is present
 * (credentials register or OAuth), so the representative sees the signup before it ever
 * converts to a paying client. The webhook-driven commission flow (`handleRepCommission`)
 * finds this same row by `workspaceId` and flips it to ACTIVE on payment.
 */
export async function attachRepLeadOnSignup(params: {
  repCode: string;
  userId: string;
  workspaceId: string;
  email: string;
  name?: string | null;
}): Promise<void> {
  try {
    const rep = await getRepByCode(params.repCode);
    if (!rep || rep.status !== 'ACTIVE') return;
    if (rep.email.toLowerCase() === params.email.toLowerCase() || rep.userId === params.userId) return;

    const existing = await prisma.repClient.findFirst({ where: { representativeId: rep.id, workspaceId: params.workspaceId } });
    if (existing) return;

    await prisma.repClient.create({
      data: {
        representativeId: rep.id,
        workspaceId: params.workspaceId,
        name: params.name?.trim() || params.email,
        email: params.email,
        status: 'LEAD',
      },
    });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Rep lead create failed on signup', {
      error: e instanceof Error ? e.message : 'Unknown',
      userId: params.userId,
      workspaceId: params.workspaceId,
    });
  }
}

/**
 * Creates a Representative and grants it platform access:
 * - if `email` already belongs to a Precision `User`, that account is promoted (linked as-is, no new password).
 * - otherwise a new `User` is created with a random password + reset token, so an invite email can let
 *   them set their own password (same pattern as the team "Opção 2" invite in api/team/route.ts).
 */
export async function createRepresentative(data: {
  name: string;
  email: string;
  phone?: string;
  document?: string;
  directCommissionPct?: number;
  affiliateOverridePct?: number;
  commissionHoldDays?: number;
  creditLimit?: number;
  level?: RepLevel;
  region?: string;
  notes?: string;
  payoutType?: 'PIX' | 'BANK_TRANSFER';
  payoutPayload?: string;
  minPayoutCents?: number;
  monthlyGoalCents?: number;
  /** Market for a brand-new account (ignored when promoting an existing user, who keeps their own). */
  market?: Market;
}, adminId: string): Promise<{ rep: Representative; accountCreated: boolean; resetToken?: string }> {
  const email = data.email.trim().toLowerCase();
  const existingRep = await prisma.representative.findUnique({ where: { email } });
  if (existingRep) throw new Error('Email already used by another representative');

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyRep = await prisma.representative.findUnique({ where: { userId: existingUser.id } });
    if (alreadyRep) throw new Error('Este usuário já é um representante.');
  }

  let resetToken: string | undefined;

  try {
    const { rep, accountCreated, token } = await prisma.$transaction(async (tx) => {
      let userId: string;
      let created = false;
      let newResetToken: string | undefined;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        newResetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        const user = await tx.user.create({
          data: {
            email,
            name: data.name.trim(),
            password: hashedPassword,
            resetTokenHash: hashToken(newResetToken),
            resetTokenExpires,
            market: data.market ?? 'BR',
            plan: 'FREE',
            leadsLimit: 10,
            leadsUsed: 0,
            onboardingCompletedAt: new Date(),
          },
        });
        userId = user.id;
        created = true;
      }

      const workspace = await tx.workspace.create({
        data: {
          name: `Rep - ${data.name}`,
          leadsLimit: data.creditLimit ?? 500,
          market: existingUser?.market ?? data.market ?? 'BR',
          members: { create: { userId, role: 'OWNER' } },
        },
      });

      const createdRep = await tx.representative.create({
        data: {
          name: data.name.trim(),
          email,
          phone: data.phone?.trim() || null,
          document: data.document?.trim() || null,
          directCommissionPct: data.directCommissionPct ?? 20,
          affiliateOverridePct: data.affiliateOverridePct ?? 5,
          commissionHoldDays: data.commissionHoldDays ?? 30,
          creditLimit: data.creditLimit ?? 500,
          level: data.level ?? 'BRONZE',
          region: data.region?.trim() || null,
          notes: data.notes?.trim() || null,
          userId,
          payoutType: data.payoutType ?? null,
          payoutPayload: data.payoutPayload?.trim() || null,
          minPayoutCents: data.minPayoutCents ?? 10000,
          monthlyGoalCents: data.monthlyGoalCents ?? null,
          workspaceId: workspace.id,
          createdByAdminId: adminId,
        },
      });

      return { rep: createdRep, accountCreated: created, token: newResetToken };
    });

    resetToken = token;
    return { rep, accountCreated, resetToken };
  } catch (err: unknown) {
    const isDuplicate = typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2002';
    if (isDuplicate) throw new Error('Este usuário já é um representante.');
    throw err;
  }
}

export async function updateCommissionStatus(id: string, status: RepCommissionStatus, adminId: string) {
  const commission = await prisma.repCommission.findUnique({ where: { id } });
  if (!commission) throw new Error('Commission not found');

  const data: Prisma.RepCommissionUpdateInput = { status };
  if (status === 'APPROVED') {
    data.holdUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  if (status === 'PAID') {
    data.paidAt = new Date();
    data.paidByAdminId = adminId;
  }

  return prisma.repCommission.update({
    where: { id },
    data,
  });
}

export async function calculateOverride(affiliateId: string, commissionAmountCents: number) {
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { representativeId: true, representative: { select: { affiliateOverridePct: true, id: true } } },
  });
  if (!affiliate?.representativeId || !affiliate.representative) return null;

  const overridePct = Number(affiliate.representative.affiliateOverridePct);
  const overrideCents = Math.floor((commissionAmountCents * overridePct) / 100);
  if (overrideCents <= 0) return null;

  return {
    representativeId: affiliate.representative.id,
    amountCents: overrideCents,
    percent: overridePct,
  };
}

export async function getRepDashboard(id: string): Promise<RepDashboard | null> {
  const rep = await prisma.representative.findUnique({ where: { id } });
  if (!rep) return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [balanceAgg, pendingAgg, totalClients, monthClients, monthCommissions, currentGoal, leadsCount, activeClientsCount] = await Promise.all([
    prisma.repCommission.aggregate({
      where: { representativeId: id, status: { in: ['APPROVED', 'PAID'] } },
      _sum: { amountCents: true },
    }),
    prisma.repCommission.aggregate({
      where: { representativeId: id, status: 'PENDING' },
      _sum: { amountCents: true },
    }),
    prisma.repClient.count({ where: { representativeId: id } }),
    prisma.repClient.count({
      where: { representativeId: id, createdAt: { gte: monthStart } },
    }),
    prisma.repCommission.aggregate({
      where: { representativeId: id, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
      _sum: { amountCents: true },
    }),
    prisma.repGoal.findUnique({
      where: { representativeId_month_year: { representativeId: id, month: now.getMonth() + 1, year: now.getFullYear() } },
    }),
    prisma.repClient.count({ where: { representativeId: id, status: 'LEAD' } }),
    prisma.repClient.count({ where: { representativeId: id, status: 'ACTIVE' } }),
  ]);

  const goalProgress = currentGoal
    ? {
        targetCents: currentGoal.targetCents,
        achievedCents: currentGoal.achievedCents,
        percent: currentGoal.targetCents > 0 ? Math.round((currentGoal.achievedCents / currentGoal.targetCents) * 100) : 0,
      }
    : null;

  return {
    id: rep.id,
    name: rep.name,
    email: rep.email,
    level: rep.level,
    status: rep.status,
    directCommissionPct: Number(rep.directCommissionPct),
    affiliateOverridePct: Number(rep.affiliateOverridePct),
    commissionHoldDays: rep.commissionHoldDays,
    creditLimit: rep.creditLimit,
    minPayoutCents: rep.minPayoutCents,
    monthlyGoalCents: rep.monthlyGoalCents,
    region: rep.region,
    payoutType: rep.payoutType,
    payoutPayload: rep.payoutPayload,
    lastActivityAt: rep.lastActivityAt?.toISOString() ?? null,
    createdAt: rep.createdAt.toISOString(),
    balanceCents: (balanceAgg._sum.amountCents ?? 0) - (pendingAgg._sum.amountCents ?? 0),
    pendingCents: pendingAgg._sum.amountCents ?? 0,
    totalClients,
    monthClientCount: monthClients,
    monthCommissionCents: monthCommissions._sum.amountCents ?? 0,
    goalProgress,
    linkClicks: rep.linkClicks,
    leadsCount,
    activeClientsCount,
  };
}

export async function getMonthlyGoalProgress(id: string, month: number, year: number) {
  return prisma.repGoal.findUnique({
    where: { representativeId_month_year: { representativeId: id, month, year } },
  });
}

export async function getRepBalance(id: string) {
  const [approved, paid] = await Promise.all([
    prisma.repCommission.aggregate({
      where: { representativeId: id, status: 'APPROVED' },
      _sum: { amountCents: true },
    }),
    prisma.repCommission.aggregate({
      where: { representativeId: id, status: 'PAID' },
      _sum: { amountCents: true },
    }),
  ]);
  return {
    availableCents: (approved._sum.amountCents ?? 0) - (paid._sum.amountCents ?? 0),
    approvedCents: approved._sum.amountCents ?? 0,
    paidCents: paid._sum.amountCents ?? 0,
  };
}

export async function applyLevelDefaults(repId: string) {
  const rep = await prisma.representative.findUnique({ where: { id: repId }, select: { level: true } });
  if (!rep) return null;
  const config = await prisma.repLevelConfig.findUnique({ where: { level: rep.level } });
  if (!config) return null;
  return prisma.representative.update({
    where: { id: repId },
    data: {
      directCommissionPct: config.directCommissionPct,
      affiliateOverridePct: config.affiliateOverridePct,
      creditLimit: config.creditLimit,
      minPayoutCents: config.minPayoutCents,
      monthlyGoalCents: config.monthlyGoalCents,
    },
  });
}
