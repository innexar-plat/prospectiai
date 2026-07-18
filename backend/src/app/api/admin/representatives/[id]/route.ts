import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getRepDashboard, getRepBalance, applyLevelDefaults, buildRepLink } from '@/lib/representative';
import { getMarketConfig, type Market } from '@/lib/market';
import { getSiteUrlForMarket } from '@/lib/site-url';
import { z } from 'zod';

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional().nullable(),
  document: z.string().max(50).optional().nullable(),
  level: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  directCommissionPercent: z.number().min(0).max(100).optional(),
  affiliateOverridePercent: z.number().min(0).max(100).optional(),
  holdDays: z.number().int().min(0).max(365).optional(),
  creditsLimit: z.number().int().min(0).optional(),
  monthlyGoal: z.number().int().min(0).optional().nullable(),
  region: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  payoutType: z.enum(['PIX', 'BANK_TRANSFER']).optional().nullable(),
  payoutPayload: z.string().max(2000).optional().nullable(),
  minPayoutCents: z.number().int().min(0).optional(),
  contractUrl: z.string().max(2000).optional().nullable(),
  applyLevelDefaults: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const rep = await prisma.representative.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      workspace: { select: { id: true, plan: true, subscriptionStatus: true, leadsLimit: true, market: true } },
      _count: { select: { clients: true, commissions: true, affiliates: true } },
    },
  });
  if (!rep) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const repMarket = (rep.workspace?.market as Market) ?? 'BR';
  const [dashboard, balance] = await Promise.all([
    getRepDashboard(id),
    getRepBalance(id),
  ]);

  return NextResponse.json({
    id: rep.id,
    name: rep.name,
    email: rep.email,
    document: rep.document,
    phone: rep.phone,
    region: rep.region,
    level: rep.level,
    status: rep.status,
    creditsUsed: 0,
    creditsLimit: rep.creditLimit,
    directCommissionPercent: Number(rep.directCommissionPct),
    affiliateOverridePercent: Number(rep.affiliateOverridePct),
    holdDays: rep.commissionHoldDays,
    payoutType: rep.payoutType,
    payoutPayload: rep.payoutPayload,
    minPayoutCents: rep.minPayoutCents,
    monthlyGoal: rep.monthlyGoalCents ?? null,
    notes: rep.notes,
    createdAt: rep.createdAt.toISOString(),
    updatedAt: rep.updatedAt.toISOString(),
    lastActivityAt: rep.lastActivityAt?.toISOString() ?? null,
    userId: rep.user?.id ?? null,
    workspaceId: rep.workspaceId,
    _count: {
      clients: rep._count.clients,
      commissions: rep._count.commissions,
      affiliates: rep._count.affiliates,
    },
    balanceCents: balance.availableCents,
    currentMonthCommissionsCents: dashboard?.monthCommissionCents ?? 0,
    monthlyGoalProgress: dashboard?.goalProgress?.achievedCents ?? 0,
    linkClicks: dashboard?.linkClicks ?? rep.linkClicks,
    leadsCount: dashboard?.leadsCount ?? 0,
    activeClientsCount: dashboard?.activeClientsCount ?? 0,
    currency: getMarketConfig(repMarket).currency,
    disclosureLink: buildRepLink(rep.id, getSiteUrlForMarket(repMarket)),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const existing = await prisma.representative.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (parsed.data.applyLevelDefaults) {
    await applyLevelDefaults(id);
  }

  const data: Record<string, unknown> = {};
  const fields = [
    'name', 'email', 'phone', 'document', 'level', 'status',
    'region', 'notes', 'payoutType', 'payoutPayload', 'minPayoutCents', 'contractUrl',
  ] as const;

  for (const field of fields) {
    if (parsed.data[field] !== undefined) {
      data[field] = parsed.data[field];
    }
  }

  if (parsed.data.directCommissionPercent !== undefined) data.directCommissionPct = parsed.data.directCommissionPercent;
  if (parsed.data.affiliateOverridePercent !== undefined) data.affiliateOverridePct = parsed.data.affiliateOverridePercent;
  if (parsed.data.holdDays !== undefined) data.commissionHoldDays = parsed.data.holdDays;
  if (parsed.data.creditsLimit !== undefined) data.creditLimit = parsed.data.creditsLimit;
  if (parsed.data.monthlyGoal !== undefined) data.monthlyGoalCents = parsed.data.monthlyGoal;

  if (data.status === 'INACTIVE' || data.status === 'SUSPENDED') {
    data.lastActivityAt = new Date();
  }

  await prisma.representative.update({ where: { id }, data });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.representative.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.representative.update({
    where: { id },
    data: { status: 'INACTIVE' },
  });

  return NextResponse.json({ ok: true });
}
