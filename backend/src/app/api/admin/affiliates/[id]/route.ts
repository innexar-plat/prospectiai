import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { sendAffiliateApprovedEmail } from '@/lib/email';
import { z } from 'zod';

const APP_BASE = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const AFFILIATE_DASHBOARD_PATH = '/dashboard/afiliado';

const patchSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'SUSPENDED']).optional(),
  commissionRatePercent: z.number().int().min(0).max(100).optional(),
  name: z.string().min(0).max(200).optional(),
  email: z.string().email().optional(),
  document: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const affiliate = await prisma.affiliate.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      referrals: { orderBy: { createdAt: 'desc' }, take: 50 },
      commissions: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if (!affiliate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [pendingCents, paidCents] = await Promise.all([
    prisma.affiliateCommission.aggregate({ where: { affiliateId: id, status: { in: ['PENDING', 'APPROVED'] } }, _sum: { amountCents: true } }),
    prisma.affiliateCommission.aggregate({ where: { affiliateId: id, status: 'PAID' }, _sum: { amountCents: true } }),
  ]);
  return NextResponse.json({
    ...affiliate,
    approvedAt: affiliate.approvedAt?.toISOString() ?? null,
    createdAt: affiliate.createdAt.toISOString(),
    updatedAt: affiliate.updatedAt.toISOString(),
    referrals: affiliate.referrals.map((r) => ({ ...r, landedAt: r.landedAt.toISOString(), signupAt: r.signupAt.toISOString(), convertedAt: r.convertedAt?.toISOString() ?? null })),
    commissions: affiliate.commissions.map((c) => ({ ...c, availableAt: c.availableAt.toISOString(), paidAt: c.paidAt?.toISOString() ?? null, createdAt: c.createdAt.toISOString() })),
    commissionPendingCents: pendingCents._sum.amountCents ?? 0,
    commissionPaidCents: paidCents._sum.amountCents ?? 0,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const existing = await prisma.affiliate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const data: { status?: string; commissionRatePercent?: number; approvedAt?: Date | null; name?: string; email?: string; document?: string | null; notes?: string | null } = {};
  if (parsed.data.status != null) {
    data.status = parsed.data.status;
    if (parsed.data.status === 'APPROVED') data.approvedAt = new Date();
  }
  if (parsed.data.commissionRatePercent != null) data.commissionRatePercent = parsed.data.commissionRatePercent;
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.email !== undefined) data.email = parsed.data.email;
  if (parsed.data.document !== undefined) data.document = parsed.data.document;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  const previous = await prisma.affiliate.findUnique({ where: { id }, select: { status: true } });
  await prisma.affiliate.update({ where: { id }, data });
  if (parsed.data.status === 'APPROVED' && previous?.status !== 'APPROVED') {
    const updated = await prisma.affiliate.findUnique({
      where: { id },
      select: { code: true, email: true, user: { select: { email: true } } },
    });
    const to = updated?.email ?? updated?.user?.email;
    if (to) {
      const loginUrl = `${APP_BASE.replace(/\/$/, '')}${AFFILIATE_DASHBOARD_PATH}`;
      sendAffiliateApprovedEmail(to, updated!.code, loginUrl).catch(async (e) => {
        const { logger } = await import('@/lib/logger');
        logger.error('Affiliate approved email failed', { affiliateId: id, error: e instanceof Error ? e.message : 'Unknown' });
      });
    }
  }
  return NextResponse.json({ ok: true });
}
