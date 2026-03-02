import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { sendAffiliateCommissionPaidEmail } from '@/lib/email';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; commissionId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id: affiliateId, commissionId } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status === 'PAID' ? 'PAID' : null;
  if (status !== 'PAID') return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const commission = await prisma.affiliateCommission.findFirst({
    where: { id: commissionId, affiliateId },
  });
  if (!commission) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.affiliateCommission.update({
    where: { id: commissionId },
    data: { status: 'PAID', paidAt: new Date(), paidByAdminId: session.user.id },
  });
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { email: true, user: { select: { email: true } } },
  });
  const to = affiliate?.email ?? affiliate?.user?.email;
  if (to) {
    const amountFormatted = commission.currency === 'BRL' ? `R$ ${(commission.amountCents / 100).toFixed(2)}` : `$${(commission.amountCents / 100).toFixed(2)}`;
    const payoutInfo = 'O valor foi enviado conforme os dados de pagamento cadastrados no painel do afiliado.';
    sendAffiliateCommissionPaidEmail(to, amountFormatted, payoutInfo).catch(async (e) => {
      const { logger } = await import('@/lib/logger');
      logger.error('Affiliate commission paid email failed', { commissionId, error: e instanceof Error ? e.message : 'Unknown' });
    });
  }
  return NextResponse.json({ ok: true });
}
