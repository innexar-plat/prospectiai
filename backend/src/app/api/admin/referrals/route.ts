import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)));
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10));
  const affiliateId = req.nextUrl.searchParams.get('affiliateId');
  const converted = req.nextUrl.searchParams.get('converted');
  const where: { affiliateId?: string; convertedAt?: { not: null } | null } = {};
  if (affiliateId) where.affiliateId = affiliateId;
  if (converted === 'true') where.convertedAt = { not: null };
  if (converted === 'false') where.convertedAt = null;
  const [items, total] = await Promise.all([
    prisma.referral.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        affiliate: { select: { id: true, code: true, name: true } },
        user: { select: { email: true } },
      },
    }),
    prisma.referral.count({ where }),
  ]);
  const list = items.map((r) => {
    const email = r.user?.email ?? null;
    const at = email?.indexOf('@');
const masked = email && at !== undefined && at >= 0 ? `${email.slice(0, 3)}***@${email.slice(at + 1)}` : null;
    return {
      id: r.id,
      affiliateId: r.affiliateId,
      affiliateCode: r.affiliate.code,
      affiliateName: r.affiliate.name,
      landedAt: r.landedAt.toISOString(),
      signupAt: r.signupAt.toISOString(),
      convertedAt: r.convertedAt?.toISOString() ?? null,
      planId: r.planId,
      valueCents: r.valueCents,
      emailMasked: masked,
    };
  });
  return NextResponse.json({ items: list, total, limit, offset });
}
