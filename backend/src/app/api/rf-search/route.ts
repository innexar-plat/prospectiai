import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const rfSearchSchema = z.object({
  cnae: z.string().max(7).optional(),
  cnaes: z.array(z.string().max(7)).max(10).optional(),
  uf: z.string().max(2).optional(),
  municipio: z.string().max(200).optional(),
  porte: z.string().max(20).optional(),
  razaoSocial: z.string().max(200).optional(),
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

    const { cnae, cnaes, uf, municipio, porte, razaoSocial, page, pageSize } = parsed.data;

    // Build where clause — support both single cnae and cnaes array
    const where: Record<string, unknown> = {};
    const effectiveCnaes = cnaes?.length ? cnaes : cnae ? [cnae] : [];
    if (effectiveCnaes.length === 1) {
      where.cnaePrincipal = { startsWith: effectiveCnaes[0] };
    } else if (effectiveCnaes.length > 1) {
      where.OR = effectiveCnaes.map((c) => ({ cnaePrincipal: { startsWith: c } }));
    }
    if (uf) where.uf = uf.toUpperCase();
    if (municipio) where.municipio = { contains: municipio, mode: 'insensitive' };
    if (porte) where.porte = porte;
    if (razaoSocial) where.razaoSocial = { contains: razaoSocial, mode: 'insensitive' };

    // Need at least one filter
    const filterCount = effectiveCnaes.length + (uf ? 1 : 0) + (municipio ? 1 : 0) + (porte ? 1 : 0) + (razaoSocial ? 1 : 0);
    if (filterCount === 0) {
      return jsonWithRequestId(
        { error: 'Informe pelo menos um filtro (CNAE, UF, município, porte ou razão social).' },
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

    const [companies, total] = await Promise.all([
      prisma.rfCompany.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: [{ uf: 'asc' }, { razaoSocial: 'asc' }],
      }),
      prisma.rfCompany.count({ where }),
    ]);

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
      prisma.rfCompany.count(),
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
