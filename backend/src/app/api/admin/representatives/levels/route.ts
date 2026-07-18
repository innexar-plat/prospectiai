import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const configs = await prisma.repLevelConfig.findMany({
    orderBy: { level: 'asc' },
  });

  const items = configs.map((c) => ({
    level: c.level,
    directCommissionPercent: Number(c.directCommissionPct),
    affiliateOverridePercent: Number(c.affiliateOverridePct),
    creditsLimit: c.creditLimit,
    minPayoutCents: c.minPayoutCents,
    monthlyGoal: c.monthlyGoalCents ?? 0,
  }));

  return NextResponse.json({ items });
}
