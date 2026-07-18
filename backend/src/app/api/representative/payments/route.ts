import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getMarketConfig, type Market } from '@/lib/market';

const getQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  year: z.coerce.number().int().min(2000).max(3000).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({
    where: { userId: session.user.id },
    select: { id: true, payoutType: true, workspace: { select: { market: true } } },
  });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });
  const currency = getMarketConfig((rep.workspace?.market as Market) ?? 'BR').currency;

  const parsed = getQuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get('limit') ?? 20,
    offset: req.nextUrl.searchParams.get('offset') ?? 0,
    year: req.nextUrl.searchParams.get('year') ?? undefined,
    month: req.nextUrl.searchParams.get('month') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
  }

  const { limit, offset, year, month } = parsed.data;
  const where: { representativeId: string; status: 'PAID'; paidAt?: { gte: Date; lt: Date } } = {
    representativeId: rep.id,
    status: 'PAID',
  };
  if (year && month) {
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 1));
    where.paidAt = { gte: periodStart, lt: periodEnd };
  }

  const [items, total] = await Promise.all([
    prisma.repCommission.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.repCommission.count({ where }),
  ]);

  const list = items.map((c) => {
    const paidAt = c.paidAt ?? c.updatedAt;
    const periodStart = new Date(Date.UTC(paidAt.getUTCFullYear(), paidAt.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(paidAt.getUTCFullYear(), paidAt.getUTCMonth() + 1, 0));
    return {
      id: c.id,
      amountCents: c.amountCents,
      currency,
      method: rep.payoutType,
      status: c.status,
      paidAt: paidAt.toISOString(),
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      createdAt: c.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ items: list, total, limit, offset });
}
