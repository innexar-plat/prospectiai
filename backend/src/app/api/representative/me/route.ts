import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({
    where: { userId: session.user.id },
  });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

  return NextResponse.json({
    id: rep.id,
    userId: rep.userId,
    code: rep.id,
    level: rep.level,
    status: rep.status,
    commissionRatePercent: Number(rep.directCommissionPct),
    overrideRatePercent: Number(rep.affiliateOverridePct),
    payoutType: rep.payoutType,
    payoutPayload: rep.payoutPayload,
    approvedAt: rep.status === 'ACTIVE' ? rep.createdAt.toISOString() : null,
    createdAt: rep.createdAt.toISOString(),
  });
}
