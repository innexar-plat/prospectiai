import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const affiliate = await prisma.affiliate.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!affiliate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [referralCount, convertedCount, pendingCents, paidCents] = await Promise.all([
    prisma.referral.count({ where: { affiliateId: affiliate.id } }),
    prisma.referral.count({ where: { affiliateId: affiliate.id, convertedAt: { not: null } } }),
    prisma.affiliateCommission.aggregate({
      where: { affiliateId: affiliate.id, status: { in: ['PENDING', 'APPROVED'] } },
      _sum: { amountCents: true },
    }),
    prisma.affiliateCommission.aggregate({
      where: { affiliateId: affiliate.id, status: 'PAID' },
      _sum: { amountCents: true },
    }),
  ]);
  return NextResponse.json({
    referralCount,
    convertedCount,
    commissionPendingCents: pendingCents._sum.amountCents ?? 0,
    commissionPaidCents: paidCents._sum.amountCents ?? 0,
  });
}
