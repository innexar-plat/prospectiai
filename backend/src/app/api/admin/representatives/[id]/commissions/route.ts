import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { updateCommissionStatus } from '@/lib/representative';
import { z } from 'zod';
import { getMarketConfig, type Market } from '@/lib/market';

const getQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(['PENDING', 'APPROVED', 'PAID', 'CANCELLED']).optional(),
});

const postSchema = z.object({
  amountCents: z.number().int().positive(),
  source: z.enum(['DIRECT_CLIENT', 'AFFILIATE_OVERRIDE']).default('DIRECT_CLIENT'),
  repClientId: z.string().optional(),
  orderId: z.string().max(200).optional(),
  subscriptionId: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

const patchSchema = z.object({
  status: z.enum(['APPROVED', 'PAID', 'CANCELLED']),
  ids: z.array(z.string()).min(1),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const rep = await prisma.representative.findUnique({
    where: { id },
    select: { workspace: { select: { market: true } } },
  });
  const currency = getMarketConfig((rep?.workspace?.market as Market) ?? 'BR').currency;

  const parsed = getQuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get('limit') ?? 20,
    offset: req.nextUrl.searchParams.get('offset') ?? 0,
    status: req.nextUrl.searchParams.get('status') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
  }

  const { limit, offset, status: statusFilter } = parsed.data;
  const where: Record<string, unknown> = { representativeId: id };
  if (statusFilter) where.status = statusFilter;

  const [items, total] = await Promise.all([
    prisma.repCommission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        repClient: { select: { id: true, name: true, company: true } },
      },
    }),
    prisma.repCommission.count({ where }),
  ]);

  const list = items.map((c) => ({
    id: c.id,
    source: c.source,
    clientId: c.repClientId,
    clientName: c.repClient?.name ?? null,
    amountCents: c.amountCents,
    currency,
    percent: Number(c.commissionPercent),
    status: c.status,
    holdUntil: c.holdUntil?.toISOString() ?? null,
    paidAt: c.paidAt?.toISOString() ?? null,
    paymentProofUrl: c.paymentProofUrl,
    createdAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json({ items: list, total, limit, offset });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const rep = await prisma.representative.findUnique({ where: { id } });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const commission = await prisma.repCommission.create({
    data: {
      representativeId: id,
      source: parsed.data.source,
      repClientId: parsed.data.repClientId || null,
      orderId: parsed.data.orderId || null,
      subscriptionId: parsed.data.subscriptionId || null,
      amountCents: parsed.data.amountCents,
      commissionPercent: rep.directCommissionPct,
      status: 'PENDING',
      notes: parsed.data.notes || null,
    },
  });

  return NextResponse.json({ id: commission.id, status: commission.status });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: repId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const results: { id: string; status: string }[] = [];

  for (const commissionId of parsed.data.ids) {
    try {
      const updated = await updateCommissionStatus(commissionId, parsed.data.status, session.user.id);
      results.push({ id: updated.id, status: updated.status });
    } catch {
      results.push({ id: commissionId, status: 'error' });
    }
  }

  return NextResponse.json({ results });
}
