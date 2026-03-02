import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { generateAffiliateCode } from '@/lib/affiliate';
import { z } from 'zod';

const postSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  document: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});

const affiliateStatusEnum = z.enum(['PENDING', 'APPROVED', 'SUSPENDED']);
const getQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: affiliateStatusEnum.optional(),
  hasPendingCommissions: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = getQuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get('limit') ?? 20,
    offset: req.nextUrl.searchParams.get('offset') ?? 0,
    status: req.nextUrl.searchParams.get('status') ?? undefined,
    hasPendingCommissions: req.nextUrl.searchParams.get('hasPendingCommissions') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
  }
  const { limit, offset, status, hasPendingCommissions } = parsed.data;
  const where: { status?: 'PENDING' | 'APPROVED' | 'SUSPENDED'; commissions?: { some: { status: { in: ('PENDING' | 'APPROVED')[] } } } } = {};
  if (status) where.status = status;
  if (hasPendingCommissions) where.commissions = { some: { status: { in: ['PENDING', 'APPROVED'] } } };
  const items = await prisma.affiliate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true, code: true, status: true, commissionRatePercent: true,
      email: true, name: true, approvedAt: true, createdAt: true,
      user: { select: { id: true, email: true, name: true } },
      _count: { select: { referrals: true, clicks: true } },
    },
  });
  const total = await prisma.affiliate.count({ where });
  const list = items.map((a) => ({
    id: a.id, code: a.code, status: a.status, commissionRatePercent: a.commissionRatePercent,
    email: a.email ?? a.user?.email, name: a.name ?? a.user?.name,
    approvedAt: a.approvedAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString(),
    referralCount: a._count.referrals, clickCount: a._count.clicks, userId: a.user?.id ?? null,
  }));
  return NextResponse.json({ items: list, total, limit, offset });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.affiliate.findFirst({
    where: { OR: [{ email }, { user: { email } }] },
  });
  if (existing) return NextResponse.json({ error: 'Email already used by another affiliate' }, { status: 400 });
  const code = await generateAffiliateCode();
  const affiliate = await prisma.affiliate.create({
    data: {
      code,
      status: 'PENDING',
      userId: null,
      name: parsed.data.name.trim(),
      email,
      document: parsed.data.document?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
      createdByAdminId: session.user.id,
    },
  });
  return NextResponse.json({
    id: affiliate.id,
    code: affiliate.code,
    status: affiliate.status,
    message: 'Afiliado externo criado. Aprove no detalhe para ativar.',
  });
}
