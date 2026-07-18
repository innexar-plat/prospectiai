import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // Commissions are paid in whatever currency the representative's own market uses (BR -> BRL,
  // US -> USD) — sum each market separately instead of mixing BRL and USD cents into one total.
  const marketCommissionWhere = (market: 'BR' | 'US', extra: Record<string, unknown>) => ({
    ...extra,
    representative: { workspace: { market } },
  });

  const [
    totalRepresentatives,
    activeRepresentatives,
    inactiveRepresentatives,
    suspendedRepresentatives,
    monthCommissionPaid,
    yearCommissionPaid,
    totalClients,
    totalLeads,
    totalActiveClients,
    linkClicksAgg,
    totalCommissionCentsBrl,
    monthCommissionPaidCentsBrl,
    yearCommissionPaidCentsBrl,
    totalCommissionCentsUsd,
    monthCommissionPaidCentsUsd,
    yearCommissionPaidCentsUsd,
  ] = await Promise.all([
    prisma.representative.count(),
    prisma.representative.count({ where: { status: 'ACTIVE' } }),
    prisma.representative.count({ where: { status: 'INACTIVE' } }),
    prisma.representative.count({ where: { status: 'SUSPENDED' } }),
    prisma.repCommission.count({ where: { status: 'PAID', paidAt: { gte: monthStart } } }),
    prisma.repCommission.count({ where: { status: 'PAID', paidAt: { gte: yearStart } } }),
    prisma.repClient.count(),
    prisma.repClient.count({ where: { status: 'LEAD' } }),
    prisma.repClient.count({ where: { status: 'ACTIVE' } }),
    prisma.representative.aggregate({ _sum: { linkClicks: true } }),
    prisma.repCommission.aggregate({
      where: marketCommissionWhere('BR', { status: { not: 'CANCELLED' } }),
      _sum: { amountCents: true },
    }),
    prisma.repCommission.aggregate({
      where: marketCommissionWhere('BR', { status: 'PAID', paidAt: { gte: monthStart } }),
      _sum: { amountCents: true },
    }),
    prisma.repCommission.aggregate({
      where: marketCommissionWhere('BR', { status: 'PAID', paidAt: { gte: yearStart } }),
      _sum: { amountCents: true },
    }),
    prisma.repCommission.aggregate({
      where: marketCommissionWhere('US', { status: { not: 'CANCELLED' } }),
      _sum: { amountCents: true },
    }),
    prisma.repCommission.aggregate({
      where: marketCommissionWhere('US', { status: 'PAID', paidAt: { gte: monthStart } }),
      _sum: { amountCents: true },
    }),
    prisma.repCommission.aggregate({
      where: marketCommissionWhere('US', { status: 'PAID', paidAt: { gte: yearStart } }),
      _sum: { amountCents: true },
    }),
  ]);

  const totalRevenueGeneratedCentsBrl = totalCommissionCentsBrl._sum.amountCents ?? 0;
  const totalRevenueGeneratedCentsUsd = totalCommissionCentsUsd._sum.amountCents ?? 0;

  return NextResponse.json({
    totalRepresentatives,
    activeRepresentatives,
    inactiveRepresentatives,
    suspendedRepresentatives,
    totalCommissionsPaidMonth: monthCommissionPaid,
    totalCommissionsPaidYear: yearCommissionPaid,
    // Legacy BRL-only fields, kept for backward compatibility with existing BR-only deployments.
    totalCommissionsPaidMonthCents: monthCommissionPaidCentsBrl._sum.amountCents ?? 0,
    totalCommissionsPaidYearCents: yearCommissionPaidCentsBrl._sum.amountCents ?? 0,
    totalClientsGenerated: totalClients,
    totalLeads,
    totalActiveClients,
    totalLinkClicks: linkClicksAgg._sum.linkClicks ?? 0,
    totalRevenueGenerated: Math.floor(totalRevenueGeneratedCentsBrl / 100),
    totalRevenueGeneratedCents: totalRevenueGeneratedCentsBrl,
    byCurrency: {
      BRL: {
        totalCommissionsPaidMonthCents: monthCommissionPaidCentsBrl._sum.amountCents ?? 0,
        totalCommissionsPaidYearCents: yearCommissionPaidCentsBrl._sum.amountCents ?? 0,
        totalRevenueGeneratedCents: totalRevenueGeneratedCentsBrl,
      },
      USD: {
        totalCommissionsPaidMonthCents: monthCommissionPaidCentsUsd._sum.amountCents ?? 0,
        totalCommissionsPaidYearCents: yearCommissionPaidCentsUsd._sum.amountCents ?? 0,
        totalRevenueGeneratedCents: totalRevenueGeneratedCentsUsd,
      },
    },
  });
}
