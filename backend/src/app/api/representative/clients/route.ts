import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { REP_CLIENT_STATUSES } from '@/lib/rep-client-status';
import { z } from 'zod';
import { getMarketConfig, type Market } from '@/lib/market';

const getQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.string().optional(),
});

const postSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  planId: z.string().max(100).optional(),
  valueCents: z.number().int().min(0).optional(),
  status: z.enum(REP_CLIENT_STATUSES).optional(),
  notes: z.string().max(2000).optional(),
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

  const { limit, offset, status } = parsed.data;
  const where: { representativeId: string; status?: string } = { representativeId: rep.id };
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.repClient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.repClient.count({ where }),
  ]);

  const list = items.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    company: c.company,
    planId: c.planId,
    status: c.status,
    valueCents: c.valueCents,
    currency,
    signedAt: c.signedAt?.toISOString() ?? null,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json({ items: list, total, limit, offset });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({
    where: { userId: session.user.id },
    select: { id: true, workspace: { select: { market: true } } },
  });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });
  const currency = getMarketConfig((rep.workspace?.market as Market) ?? 'BR').currency;

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const client = await prisma.repClient.create({
    data: {
      representativeId: rep.id,
      name: parsed.data.name.trim(),
      email: parsed.data.email?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      company: parsed.data.company?.trim() || null,
      planId: parsed.data.planId || null,
      valueCents: parsed.data.valueCents ?? null,
      status: parsed.data.status ?? 'LEAD',
      notes: parsed.data.notes?.trim() || null,
    },
  });

  return NextResponse.json({
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    company: client.company,
    planId: client.planId,
    status: client.status,
    valueCents: client.valueCents,
    currency,
    signedAt: client.signedAt?.toISOString() ?? null,
    notes: client.notes,
    createdAt: client.createdAt.toISOString(),
  }, { status: 201 });
}
