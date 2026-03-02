import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const affiliate = await prisma.affiliate.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!affiliate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.referral.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: 'desc' },
      skip, take: limit,
      select: {
        id: true, landedAt: true, signupAt: true, convertedAt: true,
        refSource: true, planId: true, valueCents: true,
        user: { select: { email: true } },
      },
    }),
    prisma.referral.count({ where: { affiliateId: affiliate.id } }),
  ]);
  const list = items.map((r) => ({
    id: r.id, landedAt: r.landedAt.toISOString(), signupAt: r.signupAt.toISOString(),
    convertedAt: r.convertedAt?.toISOString() ?? null, refSource: r.refSource,
    planId: r.planId, valueCents: r.valueCents,
    emailMasked: r.user?.email ? maskEmail(r.user.email) : null,
  }));
  return NextResponse.json({ items: list, total, page, limit });
}
