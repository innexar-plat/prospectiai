import { prisma } from '@/lib/prisma';
import type { Prisma, SearchProfile } from '@prisma/client';
import type { RfCompanyData } from '../domain/types';

interface SearchResult {
  leadsFound: number;
  leadsDedupSkip: number;
}

/**
 * Busca empresas na base RF conforme os filtros do SearchProfile,
 * cria ProspectedLead[] (skipDuplicates) e atualiza o perfil.
 *
 * Quando `dryRun = true`, nenhuma escrita é feita no banco.
 */
export async function runSearchWorker(
  workspaceId: string,
  profile: SearchProfile,
  runId: string,
  maxLeads: number,
  blockedCnpjs: string[] = [],
  dryRun = false,
): Promise<SearchResult> {
  const cnaeList = buildCnaeList(profile);
  const ufList = Array.isArray(profile.uf) ? (profile.uf as string[]) : [];
  const porteList = Array.isArray(profile.porte) ? (profile.porte as string[]) : [];

  // Construir where clause dinamicamente
  const where: Prisma.RfCompanyWhereInput = {};

  if (cnaeList.length === 1) {
    where.cnaePrincipal = { startsWith: cnaeList[0]!.substring(0, 4) };
  } else if (cnaeList.length > 1) {
    where.OR = cnaeList.map((cnae) => ({
      cnaePrincipal: { startsWith: cnae.substring(0, 4) },
    }));
  }

  if (ufList.length > 0) where.uf = { in: ufList };
  if (porteList.length > 0) where.porte = { in: porteList };
  if (profile.hasEmail === true) where.email = { not: null };
  if (profile.hasPhone === true) where.telefone = { not: null };
  if (profile.minCapital != null) where.capitalSocial = { gte: profile.minCapital };
  if (profile.openedAfter) where.dataAbertura = { gte: profile.openedAfter };
  if (profile.municipio) where.municipio = { contains: profile.municipio, mode: 'insensitive' };
  if (blockedCnpjs.length > 0) where.cnpj = { notIn: blockedCnpjs };

  // Buscar CNPJs já prospectados neste workspace para dedup
  const existingCnpjs = await prisma.prospectedLead
    .findMany({ where: { workspaceId }, select: { cnpj: true } })
    .then((rows) => new Set(rows.map((r) => r.cnpj)));

  const companies = await prisma.rfCompany.findMany({
    where,
    take: maxLeads * 3, // pega mais para absorver deduplicações
    orderBy: [{ capitalSocial: 'desc' }, { email: 'asc' }],
  });

  const toInsert: RfCompanyData[] = [];
  let dedupSkip = 0;

  for (const company of companies) {
    if (toInsert.length >= maxLeads) break;
    if (existingCnpjs.has(company.cnpj)) {
      dedupSkip++;
      continue;
    }
    toInsert.push(company as RfCompanyData);
  }

  // Em dry-run, apenas retorna os contadores sem escrever no banco
  if (dryRun) {
    return { leadsFound: toInsert.length, leadsDedupSkip: dedupSkip };
  }

  if (toInsert.length > 0) {
    await prisma.prospectedLead.createMany({
      data: toInsert.map((c) => ({
        workspaceId,
        searchProfileId: profile.id,
        cnpj: c.cnpj,
        razaoSocial: c.razaoSocial,
        nomeFantasia: c.nomeFantasia ?? null,
        email: c.email ?? null,
        ddd: c.ddd ?? null,
        telefone: c.telefone ?? null,
        cnaePrincipal: c.cnaePrincipal ?? null,
        uf: c.uf ?? null,
        municipio: c.municipio ?? null,
        porte: c.porte ?? null,
        status: 'NEW',
      })),
      skipDuplicates: true,
    });
  }

  // Atualizar perfil com data da última execução e próxima
  const searchIntervalHours = 24; // default; pode vir de config futuramente
  await prisma.searchProfile.update({
    where: { id: profile.id },
    data: {
      lastRunAt: new Date(),
      nextRunAt: new Date(Date.now() + searchIntervalHours * 60 * 60 * 1000),
      totalFound: { increment: toInsert.length },
    },
  });

  // Atualizar métricas do run
  await prisma.autoProspeccaoRun.update({
    where: { id: runId },
    data: {
      leadsFound: toInsert.length,
      leadsDedupSkip: dedupSkip,
    },
  });

  return { leadsFound: toInsert.length, leadsDedupSkip: dedupSkip };
}

function buildCnaeList(profile: SearchProfile): string[] {
  if (profile.cnae) return [profile.cnae];
  if (Array.isArray(profile.cnaeList)) return profile.cnaeList as string[];
  return [];
}
