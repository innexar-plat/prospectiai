import { prisma } from '@/lib/prisma';
import type { LeadEventType } from '@prisma/client';

/**
 * Records a lead event for the intelligence timeline.
 * Fire-and-forget — errors are logged, never thrown.
 */
export async function recordLeadEvent(params: {
  leadId: string;
  userId: string;
  workspaceId?: string | null;
  type: LeadEventType;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.leadEvent.create({
      data: {
        leadId: params.leadId,
        userId: params.userId,
        workspaceId: params.workspaceId ?? undefined,
        type: params.type,
        oldValue: params.oldValue ?? undefined,
        newValue: params.newValue ?? undefined,
        metadata: (params.metadata ?? undefined) as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('recordLeadEvent failed', {
      error: error instanceof Error ? error.message : 'Unknown',
      leadId: params.leadId,
      type: params.type,
    });
  }
}

/**
 * Get conversion statistics for a user/workspace to feed into AI prompt.
 * Returns rates, top converting segments, avg deal cycle, etc.
 */
export async function getConversionStats(userId: string, workspaceId?: string): Promise<ConversionStats> {
  const where = workspaceId ? { workspaceId } : { userId };

  const [total, converted, lost, contacted] = await Promise.all([
    prisma.leadAnalysis.count({ where }),
    prisma.leadAnalysis.count({ where: { ...where, status: 'CONVERTED' } }),
    prisma.leadAnalysis.count({ where: { ...where, status: 'LOST' } }),
    prisma.leadAnalysis.count({ where: { ...where, status: 'CONTACTED' } }),
  ]);

  // Avg deal value from converted leads
  const dealAgg = await prisma.leadAnalysis.aggregate({
    where: { ...where, status: 'CONVERTED', dealValue: { not: null } },
    _avg: { dealValue: true },
    _sum: { dealValue: true },
    _count: true,
  });

  // Avg conversion cycle (contacted → converted)
  const convertedWithDates = await prisma.leadAnalysis.findMany({
    where: { ...where, status: 'CONVERTED', contactedAt: { not: null }, convertedAt: { not: null } },
    select: { contactedAt: true, convertedAt: true },
    take: 100,
    orderBy: { convertedAt: 'desc' },
  });

  let avgCycleDays: number | null = null;
  if (convertedWithDates.length > 0) {
    const totalDays = convertedWithDates.reduce((acc, d) => {
      const diff = (d.convertedAt!.getTime() - d.contactedAt!.getTime()) / (1000 * 60 * 60 * 24);
      return acc + Math.max(0, diff);
    }, 0);
    avgCycleDays = Math.round(totalDays / convertedWithDates.length);
  }

  // Top lost reasons
  const lostReasons = await prisma.leadAnalysis.groupBy({
    by: ['lostReason'],
    where: { ...where, status: 'LOST', lostReason: { not: null } },
    _count: true,
    orderBy: { _count: { lostReason: 'desc' } },
    take: 5,
  });

  // Top converting lead types (from lead.types JSON)
  const convertedLeads = await prisma.leadAnalysis.findMany({
    where: { ...where, status: 'CONVERTED' },
    select: { lead: { select: { types: true, rating: true, reviewCount: true, website: true, phone: true } } },
    take: 200,
    orderBy: { convertedAt: 'desc' },
  });

  const typeCounts: Record<string, number> = {};
  let convertedNoWebsite = 0;
  let convertedNoPhone = 0;
  for (const cl of convertedLeads) {
    const types = cl.lead.types as string[] | null;
    if (types) {
      for (const t of types.slice(0, 3)) {
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      }
    }
    if (!cl.lead.website) convertedNoWebsite++;
    if (!cl.lead.phone) convertedNoPhone++;
  }
  const topConvertingTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  const conversionRate = contacted + converted + lost > 0
    ? Math.round((converted / (contacted + converted + lost)) * 100)
    : null;

  return {
    totalAnalyzed: total,
    contacted,
    converted,
    lost,
    conversionRate,
    avgDealValue: dealAgg._avg.dealValue ?? null,
    totalRevenue: dealAgg._sum.dealValue ?? null,
    avgCycleDays,
    topLostReasons: lostReasons.map((r) => ({
      reason: r.lostReason!,
      count: r._count,
    })),
    topConvertingTypes,
    convertedWithoutWebsite: convertedLeads.length > 0
      ? Math.round((convertedNoWebsite / convertedLeads.length) * 100)
      : null,
    convertedWithoutPhone: convertedLeads.length > 0
      ? Math.round((convertedNoPhone / convertedLeads.length) * 100)
      : null,
  };
}

/**
 * Build a text block with conversion context for the AI prompt.
 */
export function buildConversionContext(stats: ConversionStats, isEn: boolean): string {
  if (stats.totalAnalyzed < 5) {
    return isEn
      ? 'Conversion data: Insufficient data (less than 5 leads analyzed).'
      : 'Dados de conversão: Insuficientes (menos de 5 leads analisados).';
  }

  const lines: string[] = [];
  const header = isEn ? '--- YOUR HISTORICAL CONVERSION DATA ---' : '--- DADOS HISTÓRICOS DE CONVERSÃO DO USUÁRIO ---';
  lines.push(header);

  if (stats.conversionRate != null) {
    lines.push(isEn
      ? `- Conversion rate: ${stats.conversionRate}% (${stats.converted} converted out of ${stats.contacted + stats.converted + stats.lost} worked)`
      : `- Taxa de conversão: ${stats.conversionRate}% (${stats.converted} convertidos de ${stats.contacted + stats.converted + stats.lost} trabalhados)`);
  }

  if (stats.avgDealValue != null) {
    lines.push(isEn
      ? `- Avg deal value: R$ ${stats.avgDealValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
      : `- Ticket médio: R$ ${stats.avgDealValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`);
  }

  if (stats.avgCycleDays != null) {
    lines.push(isEn
      ? `- Avg sales cycle: ${stats.avgCycleDays} days`
      : `- Ciclo médio de venda: ${stats.avgCycleDays} dias`);
  }

  if (stats.topConvertingTypes.length > 0) {
    const types = stats.topConvertingTypes.map((t) => `${t.type} (${t.count}x)`).join(', ');
    lines.push(isEn
      ? `- Top converting segments: ${types}`
      : `- Segmentos que mais convertem: ${types}`);
  }

  if (stats.convertedWithoutWebsite != null && stats.converted > 3) {
    lines.push(isEn
      ? `- ${stats.convertedWithoutWebsite}% of converted leads had NO website`
      : `- ${stats.convertedWithoutWebsite}% dos leads convertidos NÃO tinham website`);
  }

  if (stats.topLostReasons.length > 0) {
    const reasons = stats.topLostReasons.map((r) => `${r.reason} (${r.count}x)`).join(', ');
    lines.push(isEn
      ? `- Top reasons for losing: ${reasons}`
      : `- Principais motivos de perda: ${reasons}`);
  }

  lines.push(isEn
    ? 'USE THIS DATA to calibrate closeProbability. Higher probability for leads matching converting patterns.'
    : 'USE ESTES DADOS para calibrar closeProbability. Maior probabilidade para leads com perfil semelhante aos que convertem.');

  return lines.join('\n');
}

export interface ConversionStats {
  totalAnalyzed: number;
  contacted: number;
  converted: number;
  lost: number;
  conversionRate: number | null;
  avgDealValue: number | null;
  totalRevenue: number | null;
  avgCycleDays: number | null;
  topLostReasons: { reason: string; count: number }[];
  topConvertingTypes: { type: string; count: number }[];
  convertedWithoutWebsite: number | null;
  convertedWithoutPhone: number | null;
}
