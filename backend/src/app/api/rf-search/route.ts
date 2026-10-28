import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { estimateRfCompanyCount, searchRfCompanies } from '@/lib/rf-query';
import { assertWorkspaceCanUseProduct } from '@/lib/trial';
import { inferCnaesForSearch } from '@/modules/search/application/search-rf-integration';

const rfSearchSchema = z.object({
  cnae: z.string().max(7).optional(),
  cnaes: z.array(z.string().max(7)).max(10).optional(),
  uf: z.string().max(2).optional(),
  municipio: z.string().max(200).optional(),
  porte: z.string().max(20).optional(),
  razaoSocial: z.string().max(200).optional(),
  /** Free-text niche ("distribuidora de salgados"): CNAEs are inferred when none are given. */
  niche: z.string().max(120).optional(),
  /** Only companies opened in the last N days. */
  openedWithinDays: z.coerce.number().int().min(1).max(3650).optional(),
  hasPhone: z.boolean().optional(),
  hasEmail: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * POST /api/rf-search
 * Busca empresas da Receita Federal por CNAE(s), UF, município, porte, razão social.
 * Also persists results as Leads in the background for data enrichment.
 */
export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
    }

    const body = await req.json();
    const parsed = rfSearchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWithRequestId(
        { error: 'Parâmetros inválidos', details: parsed.error.flatten() },
        { status: 400, requestId }
      );
    }

    const { cnae, cnaes, uf, municipio, porte, razaoSocial, niche, openedWithinDays, hasPhone, hasEmail, page, pageSize } = parsed.data;

    // Plan gate + credits: one credit per NEW search (page 1); paging through it is free.
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
      select: { workspace: { select: { id: true, plan: true, leadsUsed: true, leadsLimit: true, subscriptionStatus: true, currentPeriodEnd: true } } },
    });
    const workspace = membership?.workspace;
    if (!workspace) return jsonWithRequestId({ error: 'Workspace not found' }, { status: 404, requestId });
    const gate = assertWorkspaceCanUseProduct(workspace);
    if (!gate.ok) return jsonWithRequestId({ error: gate.message, code: gate.code }, { status: 403, requestId });
    if (page === 1 && workspace.leadsUsed >= workspace.leadsLimit) {
      return jsonWithRequestId({ error: 'Limit reached', code: 'LIMIT_EXCEEDED' }, { status: 403, requestId });
    }

    let inferredCnaes: string[] = [];
    if (niche?.trim() && !(cnaes?.length) && !cnae) {
      inferredCnaes = await inferCnaesForSearch(niche, null, { city: municipio, state: uf }).catch(() => []);
      if (inferredCnaes.length === 0) {
        return jsonWithRequestId(
          { error: 'Não identificamos a atividade desse nicho. Tente outro termo ou escolha um CNAE.', code: 'NICHE_NOT_RECOGNIZED' },
          { status: 422, requestId },
        );
      }
    }
    const openedSince = openedWithinDays
      ? new Date(Date.now() - openedWithinDays * 86400000).toISOString().slice(0, 10).replace(/-/g, '')
      : null;

    const effectiveCnaes = cnaes?.length ? cnaes : cnae ? [cnae] : inferredCnaes;
    const filterCount = effectiveCnaes.length + (uf ? 1 : 0) + (municipio ? 1 : 0) + (porte ? 1 : 0) + (razaoSocial ? 1 : 0);
    if (filterCount === 0) {
      return jsonWithRequestId(
        { error: 'Informe pelo menos um filtro (CNAE, UF, município, porte ou razão social).' },
        { status: 400, requestId }
      );
    }
    // A bare porte filter would match millions of rows — require something selective.
    if (effectiveCnaes.length === 0 && !municipio && !(razaoSocial && razaoSocial.trim().length >= 3)) {
      return jsonWithRequestId(
        { error: 'Informe um CNAE, um município ou parte da razão social (mínimo 3 letras).' },
        { status: 400, requestId }
      );
    }

    logger.info('RF search request', {
      requestId,
      cnaes: effectiveCnaes,
      uf: uf ?? null,
      municipio: municipio ?? null,
      page,
      pageSize,
    });

    const { companies, total, capped } = await searchRfCompanies(
      { cnaes: effectiveCnaes, uf, municipio, porte, razaoSocial, openedSince, hasPhone, hasEmail },
      page,
      pageSize,
    );

    if (page === 1 && companies.length > 0) {
      await prisma.workspace.update({ where: { id: workspace.id }, data: { leadsUsed: { increment: 1 } } });
      import('@/lib/credit-alerts').then(({ maybeSendLowCreditsAlert }) => maybeSendLowCreditsAlert(workspace.id)).catch(() => {});
    }

    // Enrich with CNAE description
    const cnaeCodes = [...new Set(companies.map((c) => c.cnaePrincipal))];
    const cnaeMap = new Map<string, string>();
    if (cnaeCodes.length > 0) {
      const cnaeRecords = await prisma.cnaeCode.findMany({
        where: { code: { in: cnaeCodes } },
      });
      cnaeRecords.forEach((r) => cnaeMap.set(r.code, r.description));
    }

    const results = companies.map((c) => ({
      cnpj: c.cnpj,
      razaoSocial: c.razaoSocial,
      nomeFantasia: c.nomeFantasia,
      cnaePrincipal: c.cnaePrincipal,
      cnaeDescricao: cnaeMap.get(c.cnaePrincipal) || null,
      uf: c.uf,
      municipio: c.municipio,
      cep: c.cep,
      bairro: c.bairro,
      logradouro: c.logradouro,
      numero: c.numero,
      telefone: c.ddd && c.telefone ? `(${c.ddd}) ${c.telefone}` : c.telefone || null,
      email: c.email,
      porte: c.porte,
      capitalSocial: c.capitalSocial,
      dataAbertura: c.dataAbertura,
      placeId: `rf_${c.cnpj}`,
    }));

    // Background: persist RF results as Leads for future enrichment
    syncRfLeads(companies, cnaeMap).catch((err) =>
      logger.error('RF lead sync error', { error: err instanceof Error ? err.message : 'Unknown' })
    );

    logger.info('RF search result', {
      requestId,
      total,
      returned: results.length,
      uf: uf ?? null,
      municipio: municipio ?? null,
    });

    return jsonWithRequestId({
      companies: results,
      total,
      totalCapped: capped,
      cnaesUsed: effectiveCnaes,
      cnaeDescriptions: Object.fromEntries(cnaeMap),
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }, { requestId });
  } catch (err) {
    return jsonWithRequestId(
      { error: 'Internal server error' },
      { status: 500, requestId }
    );
  }
}

/** Persist RF search results as Leads in the background */
async function syncRfLeads(
  companies: Array<{ cnpj: string; razaoSocial: string; nomeFantasia: string | null; cnaePrincipal: string;
    uf: string; municipio: string | null; cep: string | null; bairro: string | null;
    logradouro: string | null; numero: string | null; ddd: string | null; telefone: string | null;
    email: string | null; porte: string | null; capitalSocial: number | null; dataAbertura: string | null }>,
  cnaeMap: Map<string, string>,
) {
  for (const c of companies) {
    const placeId = `rf_${c.cnpj}`;
    const phone = c.ddd && c.telefone ? `(${c.ddd}) ${c.telefone}` : c.telefone || null;
    const address = [c.logradouro, c.numero, c.bairro, c.municipio, c.uf].filter(Boolean).join(', ');
    const porteScore = c.porte === 'DEMAIS' ? 60 : c.porte === 'EPP' ? 50 : 40;

    await prisma.lead.upsert({
      where: { placeId },
      update: {
        name: c.nomeFantasia || c.razaoSocial,
        address: address || undefined,
        phone: phone || undefined,
        email: c.email || undefined,
        cnpj: c.cnpj,
        companyLegalName: c.razaoSocial,
        companyTradeName: c.nomeFantasia || undefined,
        companySize: c.porte || undefined,
        companyPorte: c.porte || undefined,
        companyMainCnae: cnaeMap.get(c.cnaePrincipal) || c.cnaePrincipal,
        companyCapitalSocial: c.capitalSocial,
        cnpjStatus: 'ATIVA',
        cnpjOpenedAt: c.dataAbertura || undefined,
        cnpjLastFetchedAt: new Date(),
        businessStatus: 'OPERATIONAL',
        lastSearchedAt: new Date(),
        opportunityScore: porteScore,
        lastScoredAt: new Date(),
      },
      create: {
        placeId,
        name: c.nomeFantasia || c.razaoSocial,
        address: address || undefined,
        phone: phone || undefined,
        email: c.email || undefined,
        cnpj: c.cnpj,
        companyLegalName: c.razaoSocial,
        companyTradeName: c.nomeFantasia || undefined,
        companySize: c.porte || undefined,
        companyPorte: c.porte || undefined,
        companyMainCnae: cnaeMap.get(c.cnaePrincipal) || c.cnaePrincipal,
        companyCapitalSocial: c.capitalSocial,
        cnpjStatus: 'ATIVA',
        cnpjOpenedAt: c.dataAbertura || undefined,
        cnpjLastFetchedAt: new Date(),
        businessStatus: 'OPERATIONAL',
        opportunityScore: porteScore,
        lastScoredAt: new Date(),
      },
    }).catch(() => { /* skip duplicates */ });
  }
}

/**
 * GET /api/rf-search/stats
 * Retorna estatísticas da base RF (total empresas, top UFs, top CNAEs).
 */
export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
    }

    const [totalCompanies, totalCnaes] = await Promise.all([
      estimateRfCompanyCount(),
      prisma.cnaeCode.count(),
    ]);

    return jsonWithRequestId({
      totalCompanies,
      totalCnaes,
      available: totalCompanies > 0,
    }, { requestId });
  } catch (err) {
    return jsonWithRequestId(
      { error: 'Internal server error' },
      { status: 500, requestId }
    );
  }
}
