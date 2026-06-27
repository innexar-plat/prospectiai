import { prisma } from '@/lib/prisma';
import type { AutoProspStats } from '../domain/types';

/** Stats gerais do módulo para o dashboard */
export async function getStats(workspaceId: string): Promise<AutoProspStats> {
  const config = await prisma.autoProspeccaoConfig.findUnique({ where: { workspaceId } });

  const [
    totalLeads,
    leadsHot,
    leadsWarm,
    leadsCold,
    leadsConverted,
    emailsSent,
    crmPushed,
    lastRun,
    runsLast7d,
  ] = await Promise.all([
    prisma.prospectedLead.count({ where: { workspaceId } }),
    prisma.prospectedLead.count({ where: { workspaceId, status: 'HOT' } }),
    prisma.prospectedLead.count({ where: { workspaceId, status: 'WARM' } }),
    prisma.prospectedLead.count({ where: { workspaceId, status: 'COLD' } }),
    prisma.prospectedLead.count({ where: { workspaceId, status: 'CONVERTED' } }),
    prisma.prospectedLeadEmailEvent.count({
      where: {
        lead: { workspaceId },
        sentAt: { not: null },
      },
    }),
    prisma.prospectedLead.count({ where: { workspaceId, crmPushedAt: { not: null } } }),
    prisma.autoProspeccaoRun.findFirst({
      where: { workspaceId, status: 'COMPLETED' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    }),
    prisma.autoProspeccaoRun.count({
      where: {
        workspaceId,
        startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    totalLeads,
    leadsHot,
    leadsWarm,
    leadsCold,
    leadsConverted,
    emailsSent,
    crmPushed,
    lastRunAt: lastRun?.startedAt?.toISOString() ?? null,
    nextRunAt: null, // Calculado via SearchProfile.nextRunAt futuramente
    isActive: config?.isActive ?? false,
    runsLast7d,
  };
}

/** Lista leads prospectados com filtros e paginação */
export async function listLeads(workspaceId: string, params: {
  status?: string;
  minScore?: number;
  maxScore?: number;
  uf?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  const { status, minScore, maxScore, uf, dateFrom, dateTo, page = 1, limit = 20 } = params;

  const where: Record<string, unknown> = { workspaceId };
  if (status) where.status = status;
  if (uf) where.uf = uf;
  if (minScore !== undefined || maxScore !== undefined) {
    where.score = {};
    if (minScore !== undefined) (where.score as Record<string, number>).gte = minScore;
    if (maxScore !== undefined) (where.score as Record<string, number>).lte = maxScore;
  }
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(dateFrom);
    if (dateTo) (where.createdAt as Record<string, Date>).lte = new Date(dateTo);
  }

  const [items, total] = await Promise.all([
    prisma.prospectedLead.findMany({
      where,
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        emailEvents: {
          orderBy: { step: 'asc' },
          take: 5,
        },
      },
    }),
    prisma.prospectedLead.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/** Detalhe de um lead */
export async function getLead(id: string, workspaceId: string) {
  const lead = await prisma.prospectedLead.findUnique({
    where: { id },
    include: {
      searchProfile: { select: { id: true, name: true } },
      emailEvents: { orderBy: { step: 'asc' } },
    },
  });
  if (!lead || lead.workspaceId !== workspaceId) return null;
  return lead;
}

/** Lista execuções com paginação */
export async function listRuns(workspaceId: string, page = 1, limit = 20) {
  const [items, total] = await Promise.all([
    prisma.autoProspeccaoRun.findMany({
      where: { workspaceId },
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        searchProfile: { select: { id: true, name: true } },
      },
    }),
    prisma.autoProspeccaoRun.count({ where: { workspaceId } }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/** Detalhe de uma execução */
export async function getRun(id: string, workspaceId: string) {
  const run = await prisma.autoProspeccaoRun.findUnique({
    where: { id },
    include: {
      searchProfile: { select: { id: true, name: true } },
    },
  });
  if (!run || run.workspaceId !== workspaceId) return null;
  return run;
}

/** Descarta um lead prospectado */
export async function discardLead(id: string, workspaceId: string) {
  const lead = await prisma.prospectedLead.findUnique({ where: { id } });
  if (!lead || lead.workspaceId !== workspaceId) throw new Error('Not found');
  return prisma.prospectedLead.update({ where: { id }, data: { status: 'COLD', updatedAt: new Date() } });
}
