/**
 * Smart Relations — PostgreSQL-powered "Knowledge Graph" for lead enrichment.
 *
 * Discovers connections between leads using:
 * 1. CNAE similarity  — companies in the same sector / activity
 * 2. Geographic cluster — companies in the same city/neighbourhood
 * 3. Contact network   — shared phone or email
 * 4. Same-sector leads — other leads the user prospected in the same niche
 *
 * All queries run against existing PostgreSQL tables (Lead + RfCompany).
 * No external graph DB required.
 */

import { prisma } from './prisma';
import { logger } from './logger';

const RELATIONS_QUERY_TIMEOUT_MS = 2500;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface RelatedCompany {
    cnpj: string;
    name: string;
    tradeName: string | null;
    cnae: string | null;
    city: string | null;
    uf: string | null;
    phone: string | null;
    email: string | null;
    capitalSocial: number | null;
    porte: string | null;
    relation: RelationType;
    relevance: number; // 0-100
}

export type RelationType =
    | 'same_cnae'
    | 'same_city_cnae'
    | 'same_neighbourhood'
    | 'shared_phone'
    | 'shared_email'
    | 'same_sector_lead';

export interface SmartRelationsResult {
    lead: { placeId: string; name: string; cnpj: string | null };
    relations: RelatedCompany[];
    clusters: {
        sameSector: RelatedCompany[];
        sameRegion: RelatedCompany[];
        contactNetwork: RelatedCompany[];
        userLeads: RelatedCompany[];
    };
    stats: {
        totalFound: number;
        sameSector: number;
        sameRegion: number;
        contactNetwork: number;
        userLeads: number;
    };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function extractCnaeCode(cnaeText: string | null): string | null {
    if (!cnaeText) return null;
    // CNAE can be code like "6920601" or text like "Atividades de contabilidade"
    const codeMatch = cnaeText.match(/^(\d{5,7})/);
    return codeMatch ? codeMatch[1]! : null;
}

function extractCity(address: string | null): string | null {
    if (!address) return null;
    // Typical Google Places address: "R. Xx, 123 - Bairro, Cidade - UF, CEP"
    const parts = address.split(',');
    if (parts.length >= 3) {
        const cityPart = parts[parts.length - 2]?.trim();
        // Remove UF suffix: "Praia Grande - SP" → "Praia Grande"
        const city = cityPart?.split('-')[0]?.trim();
        return city?.toUpperCase() || null;
    }
    return null;
}

function extractNeighbourhood(address: string | null): string | null {
    if (!address) return null;
    // "R. Xx, 123 - Bairro, Cidade - UF" → Bairro
    const parts = address.split(',');
    if (parts.length >= 3) {
        const streetPart = parts[0] + ',' + parts[1]; // skip street
        const bairroPart = parts[parts.length - 3]?.trim();
        if (bairroPart) {
            const bairro = bairroPart.split('-').pop()?.trim();
            return bairro?.toUpperCase() || null;
        }
    }
    return null;
}

/* ------------------------------------------------------------------ */
/*  Core queries                                                       */
/* ------------------------------------------------------------------ */

/**
 * Find companies with the same CNAE in the same city (via RfCompany).
 * High relevance: exact sector + same geography = best prospects.
 */
async function findSameSectorSameCity(
    cnaePrincipal: string,
    municipio: string,
    uf: string,
    excludeCnpj: string,
    limit: number = 10,
): Promise<RelatedCompany[]> {
    const rows = await prisma.$queryRawUnsafe<Array<{
        cnpj: string; razaoSocial: string; nomeFantasia: string | null;
        cnaePrincipal: string | null; municipio: string | null; uf: string | null;
        ddd: string | null; telefone: string | null; email: string | null;
        capitalSocial: number | null; porte: string | null;
    }>>(
        `SELECT cnpj, "razaoSocial", "nomeFantasia", "cnaePrincipal", municipio, uf,
                ddd, telefone, email, "capitalSocial", porte
         FROM "RfCompany"
         WHERE "cnaePrincipal" = $1
           AND municipio = $2
           AND uf = $3
           AND cnpj != $4
         ORDER BY "capitalSocial" DESC NULLS LAST
         LIMIT $5`,
        cnaePrincipal, municipio, uf, excludeCnpj, limit,
    );
    return rows.map(r => ({
        cnpj: r.cnpj,
        name: r.razaoSocial,
        tradeName: r.nomeFantasia,
        cnae: r.cnaePrincipal,
        city: r.municipio,
        uf: r.uf,
        phone: r.ddd && r.telefone ? `(${r.ddd}) ${r.telefone}` : null,
        email: r.email || null,
        capitalSocial: r.capitalSocial,
        porte: r.porte,
        relation: 'same_city_cnae' as RelationType,
        relevance: 90,
    }));
}

/**
 * Find companies with the same CNAE code (sector) anywhere in the state.
 */
async function findSameSector(
    cnaePrincipal: string,
    uf: string,
    excludeCnpj: string,
    excludeMunicipio: string,
    limit: number = 10,
): Promise<RelatedCompany[]> {
    const rows = await prisma.$queryRawUnsafe<Array<{
        cnpj: string; razaoSocial: string; nomeFantasia: string | null;
        cnaePrincipal: string | null; municipio: string | null; uf: string | null;
        ddd: string | null; telefone: string | null; email: string | null;
        capitalSocial: number | null; porte: string | null;
    }>>(
        `SELECT cnpj, "razaoSocial", "nomeFantasia", "cnaePrincipal", municipio, uf,
                ddd, telefone, email, "capitalSocial", porte
         FROM "RfCompany"
         WHERE "cnaePrincipal" = $1
           AND uf = $2
           AND municipio != $3
           AND cnpj != $4
         ORDER BY "capitalSocial" DESC NULLS LAST
         LIMIT $5`,
        cnaePrincipal, uf, excludeMunicipio, excludeCnpj, limit,
    );
    return rows.map(r => ({
        cnpj: r.cnpj,
        name: r.razaoSocial,
        tradeName: r.nomeFantasia,
        cnae: r.cnaePrincipal,
        city: r.municipio,
        uf: r.uf,
        phone: r.ddd && r.telefone ? `(${r.ddd}) ${r.telefone}` : null,
        email: r.email || null,
        capitalSocial: r.capitalSocial,
        porte: r.porte,
        relation: 'same_cnae' as RelationType,
        relevance: 70,
    }));
}

/**
 * Find companies in the same neighbourhood (bairro) in the same city.
 */
async function findSameNeighbourhood(
    municipio: string,
    uf: string,
    bairro: string,
    excludeCnpj: string,
    limit: number = 10,
): Promise<RelatedCompany[]> {
    const rows = await prisma.$queryRawUnsafe<Array<{
        cnpj: string; razaoSocial: string; nomeFantasia: string | null;
        cnaePrincipal: string | null; municipio: string | null; uf: string | null;
        bairro: string | null;
        ddd: string | null; telefone: string | null; email: string | null;
        capitalSocial: number | null; porte: string | null;
    }>>(
        `SELECT cnpj, "razaoSocial", "nomeFantasia", "cnaePrincipal", municipio, uf,
                bairro, ddd, telefone, email, "capitalSocial", porte
         FROM "RfCompany"
         WHERE municipio = $1
           AND uf = $2
           AND UPPER(bairro) = $3
           AND cnpj != $4
         ORDER BY "capitalSocial" DESC NULLS LAST
         LIMIT $5`,
        municipio, uf, bairro, excludeCnpj, limit,
    );
    return rows.map(r => ({
        cnpj: r.cnpj,
        name: r.razaoSocial,
        tradeName: r.nomeFantasia,
        cnae: r.cnaePrincipal,
        city: r.municipio,
        uf: r.uf,
        phone: r.ddd && r.telefone ? `(${r.ddd}) ${r.telefone}` : null,
        email: r.email || null,
        capitalSocial: r.capitalSocial,
        porte: r.porte,
        relation: 'same_neighbourhood' as RelationType,
        relevance: 60,
    }));
}

/**
 * Find companies sharing the same phone number (DDD + phone).
 * This often reveals related companies / conglomerates.
 */
async function findSharedPhone(
    ddd: string,
    telefone: string,
    excludeCnpj: string,
    limit: number = 5,
): Promise<RelatedCompany[]> {
    const rows = await prisma.$queryRawUnsafe<Array<{
        cnpj: string; razaoSocial: string; nomeFantasia: string | null;
        cnaePrincipal: string | null; municipio: string | null; uf: string | null;
        ddd: string | null; telefone: string | null; email: string | null;
        capitalSocial: number | null; porte: string | null;
    }>>(
        `SELECT cnpj, "razaoSocial", "nomeFantasia", "cnaePrincipal", municipio, uf,
                ddd, telefone, email, "capitalSocial", porte
         FROM "RfCompany"
         WHERE ddd = $1
           AND telefone = $2
           AND cnpj != $3
         LIMIT $4`,
        ddd, telefone, excludeCnpj, limit,
    );
    return rows.map(r => ({
        cnpj: r.cnpj,
        name: r.razaoSocial,
        tradeName: r.nomeFantasia,
        cnae: r.cnaePrincipal,
        city: r.municipio,
        uf: r.uf,
        phone: r.ddd && r.telefone ? `(${r.ddd}) ${r.telefone}` : null,
        email: r.email || null,
        capitalSocial: r.capitalSocial,
        porte: r.porte,
        relation: 'shared_phone' as RelationType,
        relevance: 95,
    }));
}

/**
 * Find companies sharing the same email address.
 * High relevance — same contact person = strong business link.
 */
async function findSharedEmail(
    email: string,
    excludeCnpj: string,
    limit: number = 5,
): Promise<RelatedCompany[]> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) return [];

    const rows = await prisma.$queryRawUnsafe<Array<{
        cnpj: string; razaoSocial: string; nomeFantasia: string | null;
        cnaePrincipal: string | null; municipio: string | null; uf: string | null;
        ddd: string | null; telefone: string | null; email: string | null;
        capitalSocial: number | null; porte: string | null;
    }>>(
        `SELECT cnpj, "razaoSocial", "nomeFantasia", "cnaePrincipal", municipio, uf,
                ddd, telefone, email, "capitalSocial", porte
         FROM "RfCompany"
                 WHERE email = $1
           AND cnpj != $2
         LIMIT $3`,
                normalizedEmail, excludeCnpj, limit,
    );
    return rows.map(r => ({
        cnpj: r.cnpj,
        name: r.razaoSocial,
        tradeName: r.nomeFantasia,
        cnae: r.cnaePrincipal,
        city: r.municipio,
        uf: r.uf,
        phone: r.ddd && r.telefone ? `(${r.ddd}) ${r.telefone}` : null,
        email: r.email || null,
        capitalSocial: r.capitalSocial,
        porte: r.porte,
        relation: 'shared_email' as RelationType,
        relevance: 95,
    }));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T | null> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            logger.warn('Smart relations query timeout', { label, timeoutMs });
            resolve(null);
        }, timeoutMs);

        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((err) => {
                clearTimeout(timer);
                logger.warn('Smart relations query failed', {
                    label,
                    error: err instanceof Error ? err.message : 'Unknown',
                });
                resolve(null);
            });
    });
}

/**
 * Find the user's other prospected leads in the same CNAE sector.
 * Shows "you already prospected similar companies".
 */
async function findSameSectorLeads(
    cnaeText: string,
    excludePlaceId: string,
    userId: string,
    limit: number = 5,
): Promise<RelatedCompany[]> {
    const rows = await prisma.$queryRawUnsafe<Array<{
        placeId: string; name: string; cnpj: string | null;
        companyMainCnae: string | null; address: string | null;
        phone: string | null; email: string | null;
        companyCapitalSocial: number | null; companyPorte: string | null;
    }>>(
        `SELECT l."placeId", l.name, l.cnpj, l."companyMainCnae", l.address,
                l.phone, l.email, l."companyCapitalSocial", l."companyPorte"
         FROM "Lead" l
         JOIN "LeadAnalysis" la ON la."leadId" = l.id
         WHERE l."companyMainCnae" = $1
           AND l."placeId" != $2
           AND la."userId" = $3
         ORDER BY la."createdAt" DESC
         LIMIT $4`,
        cnaeText, excludePlaceId, userId, limit,
    );
    return rows.map(r => ({
        cnpj: r.cnpj || '',
        name: r.name || '',
        tradeName: null,
        cnae: r.companyMainCnae,
        city: extractCity(r.address),
        uf: null,
        phone: r.phone,
        email: r.email,
        capitalSocial: r.companyCapitalSocial,
        porte: r.companyPorte,
        relation: 'same_sector_lead' as RelationType,
        relevance: 50,
    }));
}

/* ------------------------------------------------------------------ */
/*  Main orchestrator                                                  */
/* ------------------------------------------------------------------ */

export async function getSmartRelations(
    placeId: string,
    userId: string,
): Promise<SmartRelationsResult> {
    // 1. Load the lead
    const lead = await prisma.lead.findUnique({
        where: { placeId },
        select: {
            placeId: true, name: true, cnpj: true, address: true,
            phone: true, email: true, companyMainCnae: true,
        },
    });
    if (!lead) {
        return {
            lead: { placeId, name: '', cnpj: null },
            relations: [],
            clusters: { sameSector: [], sameRegion: [], contactNetwork: [], userLeads: [] },
            stats: { totalFound: 0, sameSector: 0, sameRegion: 0, contactNetwork: 0, userLeads: 0 },
        };
    }

    // 2. Resolve RF company data for richer queries
    let rfCompany: {
        cnpj: string; cnaePrincipal: string | null; municipio: string | null;
        uf: string | null; bairro: string | null; ddd: string | null;
        telefone: string | null; email: string | null;
    } | null = null;

    if (lead.cnpj) {
        const row = await prisma.$queryRawUnsafe<Array<{
            cnpj: string; cnaePrincipal: string | null; municipio: string | null;
            uf: string | null; bairro: string | null; ddd: string | null;
            telefone: string | null; email: string | null;
        }>>(
            `SELECT cnpj, "cnaePrincipal", municipio, uf, bairro, ddd, telefone, email
             FROM "RfCompany" WHERE cnpj = $1 LIMIT 1`,
            lead.cnpj,
        );
        rfCompany = row[0] ?? null;
    }

    const sameSector: RelatedCompany[] = [];
    const sameRegion: RelatedCompany[] = [];
    const contactNetwork: RelatedCompany[] = [];
    const userLeads: RelatedCompany[] = [];

    // 3. Run queries in parallel
    const queries: Promise<unknown>[] = [];

    if (rfCompany?.cnaePrincipal && rfCompany?.municipio && rfCompany?.uf) {
        // Same CNAE + same city
        queries.push(
            withTimeout(
                findSameSectorSameCity(rfCompany.cnaePrincipal, rfCompany.municipio, rfCompany.uf, rfCompany.cnpj, 10),
                RELATIONS_QUERY_TIMEOUT_MS,
                'same_sector_same_city',
            ).then((r) => {
                if (r) sameSector.push(...r);
            })
        );
        // Same CNAE + same state (different city)
        queries.push(
            withTimeout(
                findSameSector(rfCompany.cnaePrincipal, rfCompany.uf, rfCompany.cnpj, rfCompany.municipio, 10),
                RELATIONS_QUERY_TIMEOUT_MS,
                'same_sector_state',
            ).then((r) => {
                if (r) sameSector.push(...r);
            })
        );
    }

    if (rfCompany?.municipio && rfCompany?.uf && rfCompany?.bairro) {
        // Same neighbourhood
        queries.push(
            withTimeout(
                findSameNeighbourhood(rfCompany.municipio, rfCompany.uf, rfCompany.bairro.toUpperCase(), rfCompany.cnpj, 10),
                RELATIONS_QUERY_TIMEOUT_MS,
                'same_neighbourhood',
            ).then((r) => {
                if (r) sameRegion.push(...r);
            })
        );
    }

    if (rfCompany?.ddd && rfCompany?.telefone) {
        // Shared phone
        queries.push(
            withTimeout(
                findSharedPhone(rfCompany.ddd, rfCompany.telefone, rfCompany.cnpj, 5),
                RELATIONS_QUERY_TIMEOUT_MS,
                'shared_phone',
            ).then((r) => {
                if (r) contactNetwork.push(...r);
            })
        );
    }

    if (rfCompany?.email) {
        // Shared email
        queries.push(
            withTimeout(
                findSharedEmail(rfCompany.email, rfCompany.cnpj, 5),
                RELATIONS_QUERY_TIMEOUT_MS,
                'shared_email',
            ).then((r) => {
                if (r) contactNetwork.push(...r);
            })
        );
    }

    if (lead.companyMainCnae) {
        // User's other leads in same sector
        queries.push(
            withTimeout(
                findSameSectorLeads(lead.companyMainCnae, placeId, userId, 5),
                RELATIONS_QUERY_TIMEOUT_MS,
                'same_sector_leads',
            ).then((r) => {
                if (r) userLeads.push(...r);
            })
        );
    }

    const settled = await Promise.allSettled(queries);
    const rejectedCount = settled.filter((q) => q.status === 'rejected').length;
    if (rejectedCount > 0) {
        logger.warn('Smart relations: partial query failures', { placeId, rejectedCount, userId });
    }

    // 4. Deduplicate by CNPJ
    const seen = new Set<string>();
    const dedup = (arr: RelatedCompany[]) => arr.filter(c => {
        if (!c.cnpj || seen.has(c.cnpj)) return false;
        seen.add(c.cnpj);
        return true;
    });

    const dedupSameSector = dedup(sameSector);
    const dedupSameRegion = dedup(sameRegion);
    const dedupContactNetwork = dedup(contactNetwork);
    const dedupUserLeads = dedup(userLeads);

    const allRelations = [
        ...dedupContactNetwork,
        ...dedupSameSector,
        ...dedupSameRegion,
        ...dedupUserLeads,
    ].sort((a, b) => b.relevance - a.relevance);

    return {
        lead: { placeId: lead.placeId, name: lead.name || '', cnpj: lead.cnpj },
        relations: allRelations,
        clusters: {
            sameSector: dedupSameSector,
            sameRegion: dedupSameRegion,
            contactNetwork: dedupContactNetwork,
            userLeads: dedupUserLeads,
        },
        stats: {
            totalFound: allRelations.length,
            sameSector: dedupSameSector.length,
            sameRegion: dedupSameRegion.length,
            contactNetwork: dedupContactNetwork.length,
            userLeads: dedupUserLeads.length,
        },
    };
}
