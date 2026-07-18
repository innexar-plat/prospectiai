import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const getQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

  const parsed = getQuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get('limit') ?? 20,
    offset: req.nextUrl.searchParams.get('offset') ?? 0,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
  }

  const { limit, offset } = parsed.data;

  const [items, total] = await Promise.all([
    prisma.affiliate.findMany({
      where: { representativeId: rep.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        code: true,
        status: true,
        name: true,
        email: true,
        commissionRatePercent: true,
        createdAt: true,
        _count: { select: { referrals: true, commissions: true } },
      },
    }),
    prisma.affiliate.count({ where: { representativeId: rep.id } }),
  ]);

  const list = items.map((a) => ({
    id: a.id,
    code: a.code,
    status: a.status,
    name: a.name,
    email: a.email,
    commissionRatePercent: a.commissionRatePercent,
    createdAt: a.createdAt.toISOString(),
    referralCount: a._count.referrals,
    commissionCount: a._count.commissions,
  }));

  return NextResponse.json({ items: list, total, limit, offset });
}
