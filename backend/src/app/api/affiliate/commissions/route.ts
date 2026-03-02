import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/** GET /api/affiliate/commissions — lista de comissões do afiliado (paginação). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const affiliate = await prisma.affiliate.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!affiliate) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const skip = (page - 1) * limit;
  const status = searchParams.get('status'); // PENDING | APPROVED | PAID | CANCELLED

  const where = { affiliateId: affiliate.id };
  if (status && ['PENDING', 'APPROVED', 'PAID', 'CANCELLED'].includes(status)) {
    Object.assign(where, { status });
  }

  const [items, total] = await Promise.all([
    prisma.affiliateCommission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        amountCents: true,
        currency: true,
        status: true,
        availableAt: true,
        paidAt: true,
        commissionType: true,
        createdAt: true,
      },
    }),
    prisma.affiliateCommission.count({ where }),
  ]);

  const list = items.map((c) => ({
    id: c.id,
    amountCents: c.amountCents,
    currency: c.currency,
    status: c.status,
    availableAt: c.availableAt.toISOString(),
    paidAt: c.paidAt?.toISOString() ?? null,
    commissionType: c.commissionType,
    createdAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json({
    items: list,
    total,
    page,
    limit,
  });
}
