/**
 * Bounded queries over the RfCompany table (27M rows, larger than the DB's RAM).
 * Every query: indexed predicates only, statement timeout, no parallel workers, no JIT,
 * no ORDER BY over the full match set and a capped count — so a single user search can
 * never scan the table or monopolise CPU.
 */
import type { RfCompany } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { toRfText } from '@/lib/rf-fuzzy-match';

export const RF_COUNT_CAP = 1000;
const RF_QUERY_TIMEOUT_MS = Number.parseInt(process.env.RF_QUERY_TIMEOUT_MS ?? '5000', 10);
const RF_MAX_OFFSET = 2000;
const RF_COUNT_TIMEOUT_MS = Number.parseInt(process.env.RF_COUNT_TIMEOUT_MS ?? '1500', 10);

export interface RfFilters {
    cnaes?: string[];
    uf?: string | null;
    municipio?: string | null;
    porte?: string | null;
    razaoSocial?: string | null;
    /** YYYYMMDD — only companies opened on/after this date. */
    openedSince?: string | null;
    hasPhone?: boolean;
    hasEmail?: boolean;
    /** Lists (auto-prospecting profiles): any of these states / company sizes. */
    ufs?: string[];
    portes?: string[];
    minCapital?: number | null;
}

/** Next lexicographic string after a prefix: '5611' → '5612' (prefix match as an index range). */
function prefixUpperBound(prefix: string): string {
    return prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
}

export function buildRfWhere(f: RfFilters): { sql: string; params: string[] } {
    const conds: string[] = [];
    const params: string[] = [];
    const p = (v: string) => { params.push(v); return `$${params.length}`; };

    const cnaes = (f.cnaes ?? []).map((c) => c.replace(/\D/g, '')).filter((c) => c.length >= 2);
    if (cnaes.length > 0) {
        conds.push(`(${cnaes.map((c) => (c.length >= 7
            ? `"cnaePrincipal" = ${p(c)}`
            : `("cnaePrincipal" >= ${p(c)} AND "cnaePrincipal" < ${p(prefixUpperBound(c))})`)).join(' OR ')})`);
    }
    if (f.uf?.trim()) conds.push(`uf = ${p(f.uf.trim().toUpperCase())}`);
    const ufs = (f.ufs ?? []).map((u) => u.trim().toUpperCase()).filter((u) => /^[A-Z]{2}$/.test(u));
    if (ufs.length > 0) conds.push(`uf IN (${ufs.map(p).join(', ')})`);
    const portes = (f.portes ?? []).map((v) => v.trim().toUpperCase()).filter(Boolean);
    if (portes.length > 0) conds.push(`porte IN (${portes.map(p).join(', ')})`);
    if (f.minCapital != null && Number.isFinite(f.minCapital)) conds.push(`"capitalSocial" >= ${p(String(f.minCapital))}::float8`);
    if (f.municipio?.trim()) conds.push(`municipio = ${p(toRfText(f.municipio))}`);
    if (f.porte?.trim()) conds.push(`porte = ${p(f.porte.trim().toUpperCase())}`);
    if (f.razaoSocial && f.razaoSocial.trim().length >= 3) {
        // upper(...) LIKE uses the trigram GIN index on upper("razaoSocial").
        conds.push(`upper("razaoSocial") LIKE ${p(`%${toRfText(f.razaoSocial).replace(/[%_]/g, '')}%`)}`);
    }
    if (f.openedSince && /^\d{8}$/.test(f.openedSince)) conds.push(`"dataAbertura" >= ${p(f.openedSince)}`);
    if (f.hasPhone) conds.push(`telefone IS NOT NULL AND telefone <> ''`);
    if (f.hasEmail) conds.push(`email IS NOT NULL AND email <> ''`);
    return { sql: conds.length ? conds.join(' AND ') : 'false', params };
}

async function bounded<T>(timeoutMs: number, fn: (tx: typeof prisma) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${Math.max(200, timeoutMs)}`);
        await tx.$executeRawUnsafe('SET LOCAL max_parallel_workers_per_gather = 0');
        await tx.$executeRawUnsafe('SET LOCAL jit = off');
        return fn(tx as unknown as typeof prisma);
    });
}

/** Up to `limit` matching companies, bounded like interactive searches (no ORDER BY, no count). */
export async function findRfCompanies(filters: RfFilters, limit: number): Promise<RfCompany[]> {
    const { sql, params } = buildRfWhere(filters);
    const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
    return bounded(RF_QUERY_TIMEOUT_MS, (tx) => tx.$queryRawUnsafe<RfCompany[]>(
        `SELECT * FROM "RfCompany" WHERE ${sql} LIMIT ${safeLimit}`,
        ...params,
    ));
}

/**
 * One page of companies plus a count capped at RF_COUNT_CAP (`capped` = there are more, or the
 * count did not finish in its short budget — broad name searches in big cities).
 */
export async function searchRfCompanies(
    filters: RfFilters,
    page: number,
    pageSize: number,
): Promise<{ companies: RfCompany[]; total: number; capped: boolean }> {
    const { sql, params } = buildRfWhere(filters);
    const offset = Math.min(RF_MAX_OFFSET, Math.max(0, (page - 1) * pageSize));
    const companies = await bounded(RF_QUERY_TIMEOUT_MS, (tx) => tx.$queryRawUnsafe<RfCompany[]>(
        // No ORDER BY: sorting a sector (even within one city) means reading every match — measured
        // at >5 s for restaurants in São Paulo. The date window already keeps results recent.
        `SELECT * FROM "RfCompany" WHERE ${sql} LIMIT ${pageSize} OFFSET ${offset}`,
        ...params,
    ));
    try {
        const [{ n }] = await bounded(RF_COUNT_TIMEOUT_MS, (tx) => tx.$queryRawUnsafe<[{ n: bigint }]>(
            `SELECT count(*) AS n FROM (SELECT 1 FROM "RfCompany" WHERE ${sql} LIMIT ${RF_COUNT_CAP + 1}) t`,
            ...params,
        ));
        const total = Number(n);
        return { companies, total: Math.min(total, RF_COUNT_CAP), capped: total > RF_COUNT_CAP };
    } catch {
        return { companies, total: Math.max(offset + companies.length, companies.length === pageSize ? RF_COUNT_CAP : 0), capped: companies.length === pageSize };
    }
}

/** Planner estimate of the table size — instant, instead of count(*) over 27M rows. */
export async function estimateRfCompanyCount(): Promise<number> {
    const [row] = await prisma.$queryRaw<[{ n: number }]>`SELECT reltuples::bigint AS n FROM pg_class WHERE relname = 'RfCompany'`;
    return Number(row?.n ?? 0);
}
