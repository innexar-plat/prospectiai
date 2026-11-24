import { findUsCompanies } from '@/lib/us-query';
import { findRfCompanies } from '@/lib/rf-query';
import { prisma } from '@/lib/prisma';
import type { SearchProfile } from '@prisma/client';
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

  // Bounded RF query (statement timeout, no parallel workers) — the old Prisma query had neither
  // and a broad profile scanned the 27M-row table.
  const existingCnpjs = await prisma.prospectedLead
    .findMany({ where: { workspaceId }, select: { cnpj: true } })
    .then((rows) => new Set(rows.map((r) => r.cnpj)));
  const blocked = new Set(blockedCnpjs);

  const companies = (isUsProfile(profile) ? await findUsLeads(profile, maxLeads * 3) : await findRfCompanies({
    cnaes: cnaeList.map((c) => c.replace(/\D/g, '').substring(0, 4)),
    ufs: ufList,
    portes: porteList,
    municipio: profile.municipio,
    hasEmail: profile.hasEmail === true,
    hasPhone: profile.hasPhone === true,
    minCapital: profile.minCapital,
    openedSince: profile.openedAfter,
  }, maxLeads * 3)).filter((c) => !blocked.has(c.cnpj));
  // Bigger companies first — sorted over the fetched candidates, not the whole sector/state.
  companies.sort((a, b) => (b.capitalSocial ?? 0) - (a.capitalSocial ?? 0));

  const toInsert: RfCompanyData[] = [];
  let dedupSkip = 0;

  for (const company of companies) {
    if (toInsert.length >= maxLeads) break;
    if (existingCnpjs.has(company.cnpj)) {
      dedupSkip++;
      continue;
    }
    toInsert.push(company as unknown as RfCompanyData);
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

/** US profiles list Overture categories ("marketing_agency") where BR ones list CNAE codes. */
export function isUsProfile(profile: SearchProfile): boolean {
  const list = Array.isArray(profile.cnaeList) ? (profile.cnaeList as string[]) : [];
  return list.length > 0 && list.every((c) => /^[a-z][a-z0-9_]+$/.test(c));
}

async function findUsLeads(profile: SearchProfile, limit: number) {
  const rows = await findUsCompanies({
    categories: profile.cnaeList as string[],
    states: Array.isArray(profile.uf) ? (profile.uf as string[]) : [],
    city: profile.municipio,
    hasEmail: profile.hasEmail === true,
    hasPhone: profile.hasPhone === true,
  }, limit);
  return rows.map((c) => ({
    cnpj: `us:${c.id}`,
    razaoSocial: c.name,
    nomeFantasia: null,
    cnaePrincipal: c.category ?? '',
    uf: c.state,
    municipio: c.city,
    ddd: null,
    telefone: c.phone,
    email: c.email,
    porte: null,
    capitalSocial: null,
    dataAbertura: null,
  }));
}

function buildCnaeList(profile: SearchProfile): string[] {
  if (profile.cnae) return [profile.cnae];
  if (Array.isArray(profile.cnaeList)) return profile.cnaeList as string[];
  return [];
}
