import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
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
  signedAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
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

  const { limit, offset, status } = parsed.data;
  const where: { representativeId: string; status?: string } = { representativeId: id };
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
    plan: c.planId,
    status: c.status,
    valueCents: c.valueCents,
    currency,
    signedAt: c.signedAt?.toISOString() ?? null,
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

  const client = await prisma.repClient.create({
    data: {
      representativeId: id,
      name: parsed.data.name.trim(),
      email: parsed.data.email?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      company: parsed.data.company?.trim() || null,
      planId: parsed.data.planId || null,
      valueCents: parsed.data.valueCents ?? null,
      signedAt: parsed.data.signedAt ? new Date(parsed.data.signedAt) : null,
      notes: parsed.data.notes?.trim() || null,
    },
  });

  return NextResponse.json({ id: client.id, name: client.name }, { status: 201 });
}
