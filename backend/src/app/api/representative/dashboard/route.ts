import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getRepDashboard, getRepBalance, buildRepLink } from '@/lib/representative';
import { getSiteUrlFromRequest } from '@/lib/site-url';
import { getMarketConfig, type Market } from '@/lib/market';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({
    where: { userId: session.user.id },
    include: { workspace: { select: { market: true } } },
  });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });
  const currency = getMarketConfig((rep.workspace?.market as Market) ?? 'BR').currency;

  const [dashboard, balance, recentCommissions, recentClients] = await Promise.all([
    getRepDashboard(rep.id),
    getRepBalance(rep.id),
    prisma.repCommission.findMany({
      where: { representativeId: rep.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { repClient: { select: { id: true, name: true, company: true } } },
    }),
    prisma.repClient.findMany({
      where: { representativeId: rep.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const siteUrl = getSiteUrlFromRequest(req);
  const repCode = rep.id;
  const disclosureLink = buildRepLink(repCode, siteUrl);

  return NextResponse.json({
    dashboard,
    balance,
    currency,
    recentCommissions: recentCommissions.map((c) => ({
      id: c.id,
      source: c.source,
      amountCents: c.amountCents,
      commissionPercent: Number(c.commissionPercent),
      status: c.status,
      clientName: c.repClient?.name ?? null,
      clientCompany: c.repClient?.company ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
    recentClients: recentClients.map((c) => ({
      id: c.id,
      name: c.name,
      company: c.company,
      planId: c.planId,
      status: c.status,
      valueCents: c.valueCents,
      signedAt: c.signedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
    disclosureLink,
    repCode,
  });
}
