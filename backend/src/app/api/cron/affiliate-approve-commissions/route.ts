import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { approveCommissionsByAvailableAt } from '@/lib/affiliate';
import { sendAffiliateCommissionAvailableEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

const AFFILIATE_DASHBOARD_PATH = '/dashboard/afiliado';
const APP_BASE = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Cron: aprova comissões cujo availableAt já passou (PENDING -> APPROVED).
 * Envia e-mail "comissão disponível" para cada afiliado que teve comissões aprovadas.
 * Chamar com Authorization: Bearer <CRON_SECRET> ou header x-cron-secret.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const secretHeader = req.headers.get('x-cron-secret');
  const secret = process.env.CRON_SECRET;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : secretHeader;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const toApprove = await prisma.affiliateCommission.findMany({
      where: { status: 'PENDING', availableAt: { lte: now } },
      select: {
        affiliateId: true,
        affiliate: {
          select: { email: true, user: { select: { email: true } } },
        },
      },
    });
    const affiliateEmails = new Map<string, string>();
    for (const row of toApprove) {
      const email = row.affiliate.email ?? row.affiliate.user?.email ?? null;
      if (email && !affiliateEmails.has(row.affiliateId)) {
        affiliateEmails.set(row.affiliateId, email);
      }
    }

    const count = await approveCommissionsByAvailableAt();
    logger.info('Affiliate approve commissions cron completed', { count });

    const dashboardUrl = `${APP_BASE.replace(/\/$/, '')}${AFFILIATE_DASHBOARD_PATH}`;
    for (const email of affiliateEmails.values()) {
      sendAffiliateCommissionAvailableEmail(email, dashboardUrl).catch((e) => {
        logger.error('Affiliate commission available email failed', { email, error: e instanceof Error ? e.message : 'Unknown' });
      });
    }

    return NextResponse.json({ ok: true, approved: count, notified: affiliateEmails.size });
  } catch (err) {
    logger.error('Affiliate approve commissions cron failed', { error: err instanceof Error ? err.message : 'Unknown' });
    return NextResponse.json({ error: 'Job failed' }, { status: 500 });
  }
}
