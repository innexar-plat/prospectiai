import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const patchSchema = z.object({
  directCommissionPercent: z.number().min(0).max(100).optional(),
  affiliateOverridePercent: z.number().min(0).max(100).optional(),
  creditsLimit: z.number().int().min(0).optional(),
  minPayoutCents: z.number().int().min(0).optional(),
  monthlyGoal: z.number().int().min(0).optional().nullable(),
});

const repLevelEnum = z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ level: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { level } = await params;
  const levelParsed = repLevelEnum.safeParse(level);
  if (!levelParsed.success) {
    return NextResponse.json({ error: `Invalid level: ${level}` }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.directCommissionPercent !== undefined) data.directCommissionPct = parsed.data.directCommissionPercent;
  if (parsed.data.affiliateOverridePercent !== undefined) data.affiliateOverridePct = parsed.data.affiliateOverridePercent;
  if (parsed.data.creditsLimit !== undefined) data.creditLimit = parsed.data.creditsLimit;
  if (parsed.data.minPayoutCents !== undefined) data.minPayoutCents = parsed.data.minPayoutCents;
  if (parsed.data.monthlyGoal !== undefined) data.monthlyGoalCents = parsed.data.monthlyGoal;

  const config = await prisma.repLevelConfig.upsert({
    where: { level: levelParsed.data },
    update: data,
    create: {
      level: levelParsed.data,
      directCommissionPct: parsed.data.directCommissionPercent ?? 20,
      affiliateOverridePct: parsed.data.affiliateOverridePercent ?? 5,
      creditLimit: parsed.data.creditsLimit ?? 500,
      minPayoutCents: parsed.data.minPayoutCents ?? 10000,
      monthlyGoalCents: parsed.data.monthlyGoal ?? null,
    },
  });

  return NextResponse.json({
    level: config.level,
    directCommissionPercent: Number(config.directCommissionPct),
    affiliateOverridePercent: Number(config.affiliateOverridePct),
    creditsLimit: config.creditLimit,
    minPayoutCents: config.minPayoutCents,
    monthlyGoal: config.monthlyGoalCents ?? 0,
  });
}
