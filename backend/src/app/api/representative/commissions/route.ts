import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getMarketConfig, type Market } from '@/lib/market';

const getQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(['PENDING', 'APPROVED', 'PAID', 'CANCELLED']).optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({
    where: { userId: session.user.id },
    select: { id: true, workspace: { select: { market: true } } },
  });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });
  const currency = getMarketConfig((rep.workspace?.market as Market) ?? 'BR').currency;

  const parsed = getQuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get('limit') ?? 20,
    offset: req.nextUrl.searchParams.get('offset') ?? 0,
    status: req.nextUrl.searchParams.get('status') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
  }

  const { limit, offset, status: statusFilter } = parsed.data;
  const where: Record<string, unknown> = { representativeId: rep.id };
  if (statusFilter) where.status = statusFilter;

  const [items, total] = await Promise.all([
    prisma.repCommission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        repClient: { select: { id: true, name: true, company: true } },
      } as const,
    }),
    prisma.repCommission.count({ where }),
  ]);

  const list = items.map((c: Record<string, unknown>) => ({
    id: c.id as string,
    source: c.source as string,
    amountCents: c.amountCents as number,
    currency,
    commissionPercent: Number(c.commissionPercent),
    status: c.status as string,
    holdUntil: (c.holdUntil as Date)?.toISOString() ?? null,
    paidAt: (c.paidAt as Date)?.toISOString() ?? null,
    orderId: c.orderId as string | null,
    subscriptionId: c.subscriptionId as string | null,
    notes: c.notes as string | null,
    clientName: ((c as { repClient?: { name?: string | null } }).repClient?.name) ?? null,
    clientCompany: ((c as { repClient?: { company?: string | null } }).repClient?.company) ?? null,
    createdAt: (c.createdAt as Date).toISOString(),
  }));

  return NextResponse.json({ items: list, total, limit, offset, currency });
}
