import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(['PENDING', 'APPROVED', 'PAID', 'CANCELLED']).optional(),
  affiliateId: z.string().cuid().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = querySchema.safeParse({
    limit: req.nextUrl.searchParams.get('limit') ?? 20,
    offset: req.nextUrl.searchParams.get('offset') ?? 0,
    status: req.nextUrl.searchParams.get('status') ?? undefined,
    affiliateId: req.nextUrl.searchParams.get('affiliateId') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
  }
  const { limit, offset, status, affiliateId } = parsed.data;

  const where: { status?: (typeof parsed.data)['status']; affiliateId?: string } = {};
  if (status) where.status = status;
  if (affiliateId) where.affiliateId = affiliateId;

  const [items, total] = await Promise.all([
    prisma.affiliateCommission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        affiliate: {
          select: {
            id: true,
            code: true,
            name: true,
            email: true,
            user: { select: { email: true } },
          },
        },
      },
    }),
    prisma.affiliateCommission.count({ where }),
  ]);

  const list = items.map((c) => ({
    id: c.id,
    affiliateId: c.affiliateId,
    affiliateCode: c.affiliate.code,
    affiliateName: c.affiliate.name ?? null,
    affiliateEmail: c.affiliate.email ?? c.affiliate.user?.email ?? null,
    amountCents: c.amountCents,
    currency: c.currency,
    status: c.status,
    availableAt: c.availableAt.toISOString(),
    paidAt: c.paidAt?.toISOString() ?? null,
    commissionType: c.commissionType,
    createdAt: c.createdAt.toISOString(),
    paymentProofUrl: c.paymentProofUrl ?? null,
  }));

  return NextResponse.json({ items: list, total, limit, offset });
}
