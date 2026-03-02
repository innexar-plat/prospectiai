import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const AFFILIATE_SETTINGS_ID = 'affiliate-settings-default';

const patchSchema = z.object({
  defaultCommissionRatePercent: z.number().int().min(0).max(100).optional(),
  cookieDurationDays: z.number().int().min(1).max(365).optional(),
  commissionRule: z.enum(['FIRST_PAYMENT_ONLY', 'RECURRING']).optional(),
  approvalHoldDays: z.number().int().min(0).max(365).optional(),
  minPayoutCents: z.number().int().min(0).optional(),
  allowSelfSignup: z.boolean().optional(),
});

export type AffiliateSettingsPublic = {
  id: string;
  defaultCommissionRatePercent: number;
  cookieDurationDays: number;
  commissionRule: string;
  approvalHoldDays: number;
  minPayoutCents: number;
  allowSelfSignup: boolean;
  updatedAt: string;
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const row = await prisma.affiliateSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!row) {
    const created = await prisma.affiliateSettings.create({
      data: {
        id: AFFILIATE_SETTINGS_ID,
        defaultCommissionRatePercent: 20,
        cookieDurationDays: 30,
        commissionRule: 'FIRST_PAYMENT_ONLY',
        approvalHoldDays: 15,
        minPayoutCents: 10000,
        allowSelfSignup: true,
      },
    });
    return NextResponse.json(serialize(created));
  }
  return NextResponse.json(serialize(row));
}

function serialize(row: { id: string; defaultCommissionRatePercent: number; cookieDurationDays: number; commissionRule: string; approvalHoldDays: number; minPayoutCents: number; allowSelfSignup: boolean; updatedAt: Date }): AffiliateSettingsPublic {
  return {
    id: row.id,
    defaultCommissionRatePercent: row.defaultCommissionRatePercent,
    cookieDurationDays: row.cookieDurationDays,
    commissionRule: row.commissionRule,
    approvalHoldDays: row.approvalHoldDays,
    minPayoutCents: row.minPayoutCents,
    allowSelfSignup: row.allowSelfSignup,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }
  let row = await prisma.affiliateSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!row) {
    row = await prisma.affiliateSettings.create({
      data: {
        id: AFFILIATE_SETTINGS_ID,
        defaultCommissionRatePercent: parsed.data.defaultCommissionRatePercent ?? 20,
        cookieDurationDays: parsed.data.cookieDurationDays ?? 30,
        commissionRule: parsed.data.commissionRule ?? 'FIRST_PAYMENT_ONLY',
        approvalHoldDays: parsed.data.approvalHoldDays ?? 15,
        minPayoutCents: parsed.data.minPayoutCents ?? 10000,
        allowSelfSignup: parsed.data.allowSelfSignup ?? true,
      },
    });
  } else {
    row = await prisma.affiliateSettings.update({
      where: { id: row.id },
      data: {
        ...(parsed.data.defaultCommissionRatePercent != null && { defaultCommissionRatePercent: parsed.data.defaultCommissionRatePercent }),
        ...(parsed.data.cookieDurationDays != null && { cookieDurationDays: parsed.data.cookieDurationDays }),
        ...(parsed.data.commissionRule != null && { commissionRule: parsed.data.commissionRule }),
        ...(parsed.data.approvalHoldDays != null && { approvalHoldDays: parsed.data.approvalHoldDays }),
        ...(parsed.data.minPayoutCents != null && { minPayoutCents: parsed.data.minPayoutCents }),
        ...(parsed.data.allowSelfSignup != null && { allowSelfSignup: parsed.data.allowSelfSignup }),
      },
    });
  }
  return NextResponse.json(serialize(row));
}
