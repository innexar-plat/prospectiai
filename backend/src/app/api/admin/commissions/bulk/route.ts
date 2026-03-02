import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { sendAffiliateCommissionPaidEmail } from '@/lib/email';
import { z } from 'zod';

const bodySchema = z.object({
  commissionIds: z.array(z.string().cuid()).min(1).max(100),
  status: z.literal('PAID'),
  paymentProofUrl: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }
  const { commissionIds, paymentProofUrl } = parsed.data;
  const commissions = await prisma.affiliateCommission.findMany({
    where: { id: { in: commissionIds }, status: 'APPROVED' },
    include: {
      affiliate: { select: { id: true, email: true, user: { select: { email: true } } } },
    },
  });
  if (commissions.length === 0) {
    return NextResponse.json({ error: 'No APPROVED commissions to update', updated: 0 }, { status: 400 });
  }
  const ids = commissions.map((c) => c.id);
  const updateData: { status: 'PAID'; paidAt: Date; paidByAdminId: string; paymentProofUrl?: string } = {
    status: 'PAID',
    paidAt: new Date(),
    paidByAdminId: session.user.id,
  };
  if (paymentProofUrl?.trim()) updateData.paymentProofUrl = paymentProofUrl.trim();
  await prisma.affiliateCommission.updateMany({
    where: { id: { in: ids } },
    data: updateData,
  });
  const { logger } = await import('@/lib/logger');
  for (const c of commissions) {
    const to = c.affiliate.email ?? c.affiliate.user?.email;
    if (to) {
      const amountFormatted = c.currency === 'BRL' ? `R$ ${(c.amountCents / 100).toFixed(2)}` : `$${(c.amountCents / 100).toFixed(2)}`;
      const payoutInfo = 'O valor foi enviado conforme os dados de pagamento cadastrados no painel do afiliado.';
      sendAffiliateCommissionPaidEmail(to, amountFormatted, payoutInfo).catch((e) => {
        logger.error('Affiliate commission paid email failed', { commissionId: c.id, error: e instanceof Error ? e.message : 'Unknown' });
      });
    }
  }
  return NextResponse.json({ ok: true, updated: ids.length });
}
