import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const getQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

const postSchema = z.object({
  affiliateId: z.string().min(1),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
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
      where: { representativeId: id },
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
    prisma.affiliate.count({ where: { representativeId: id } }),
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

  const affiliate = await prisma.affiliate.findUnique({ where: { id: parsed.data.affiliateId } });
  if (!affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

  const updated = await prisma.affiliate.update({
    where: { id: parsed.data.affiliateId },
    data: { representativeId: id },
  });

  return NextResponse.json({ id: updated.id, code: updated.code, message: 'Afiliado vinculado ao representante.' });
}
