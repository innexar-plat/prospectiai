import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const patchSchema = z.object({
  payoutType: z.enum(['PIX', 'BANK_TRANSFER']).optional(),
  payoutPayload: z.string().max(500).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const affiliate = await prisma.affiliate.findFirst({
    where: { userId: session.user.id },
    select: {
      id: true, code: true, status: true, commissionRatePercent: true,
      payoutType: true, approvedAt: true, createdAt: true,
      _count: { select: { referrals: true, commissions: true } },
    },
  });
  if (!affiliate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    id: affiliate.id, code: affiliate.code, status: affiliate.status,
    commissionRatePercent: affiliate.commissionRatePercent,
    payoutType: affiliate.payoutType, approvedAt: affiliate.approvedAt?.toISOString() ?? null,
    createdAt: affiliate.createdAt.toISOString(),
    referralCount: affiliate._count.referrals, commissionCount: affiliate._count.commissions,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const affiliate = await prisma.affiliate.findFirst({
    where: { userId: session.user.id },
    select: { id: true, status: true },
  });
  if (!affiliate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (affiliate.status !== 'APPROVED') return NextResponse.json({ error: 'Affiliate not approved' }, { status: 403 });
  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: {
      ...(parsed.data.payoutType != null && { payoutType: parsed.data.payoutType }),
      ...(parsed.data.payoutPayload !== undefined && { payoutPayload: parsed.data.payoutPayload || null }),
    },
  });
  return NextResponse.json({ ok: true });
}
