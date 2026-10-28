/**
 * Win-back emails: users who searched before but stopped coming back get, at most once a week,
 * a short list of companies that recently OPENED in the same niche and city as their last
 * search (Receita Federal base). Phones are partly masked — the full contact is one click away
 * in the product. Falls back to unsaved high-opportunity leads from their own last search.
 *
 * Guard rails: e-mail notifications on, not unsubscribed (ALL/MARKETING), at most one email per
 * ISO week and MAX_SENDS in total per user, bounded RF queries, capped batch per run.
 */
import { prisma } from '@/lib/prisma';
import { getCached, setCached, getRedisClient } from '@/lib/redis';
import { addDays } from '@/lib/billing-period';
import { toRfText } from '@/lib/rf-fuzzy-match';
import { sendReengagementEmail, type ReengagementCompany } from '@/lib/billing-emails';
import { logger } from '@/lib/logger';

const INACTIVE_DAYS = 7;
const MAX_SENDS = 6;
const BATCH_LIMIT = 100;
const NEW_COMPANY_WINDOW_DAYS = 120;
const RF_TIMEOUT_MS = 2500;

export interface ReengagementResult { candidates: number; sent: number; fromRf: number; fromHistory: number }

function isoWeek(d: Date): string {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** "(47) 3322-1100" → "(47) 3322-••••" — enough to show it is real, not enough to skip the product. */
export function maskPhone(ddd: string | null, phone: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) return null;
    const visible = digits.slice(0, digits.length - 4);
    const formatted = `${visible.slice(0, -4)}${visible.slice(-4)}-••••`;
    return ddd ? `(${ddd}) ${formatted}` : formatted;
}

function formatRfDate(yyyymmdd: string | null): string | null {
    if (!yyyymmdd || yyyymmdd.length !== 8) return null;
    return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(0, 4)}`;
}

/** Newest opening date in the base (the base lags the calendar by weeks), cached for a day. */
async function rfLatestOpening(): Promise<string | null> {
    const cached = await getCached<string>('reengage:rf-latest-opening');
    if (cached) return cached;
    try {
        const [row] = await prisma.$queryRaw<[{ d: string | null }]>`SELECT max("dataAbertura") AS d FROM "RfCompany" WHERE "dataAbertura" >= '20260101'`;
        if (row?.d) await setCached('reengage:rf-latest-opening', row.d, 86400);
        return row?.d ?? null;
    } catch {
        return null;
    }
}

function prefixUpper(p: string): string {
    return p.slice(0, -1) + String.fromCharCode(p.charCodeAt(p.length - 1) + 1);
}

/** Recently opened companies matching the search niche/city; bounded, index-driven. */
async function newCompanies(cnaes: string[], city: string, uf: string | null, since: string): Promise<{ list: ReengagementCompany[]; total: number }> {
    if (cnaes.length === 0) return { list: [], total: 0 };
    const params: string[] = [toRfText(city)];
    const ranges = cnaes.slice(0, 5).map((c) => {
        if (c.length >= 7) { params.push(c); return `"cnaePrincipal" = $${params.length}`; }
        params.push(c, prefixUpper(c));
        return `("cnaePrincipal" >= $${params.length - 1} AND "cnaePrincipal" < $${params.length})`;
    });
    params.push(since);
    let where = `municipio = $1 AND (${ranges.join(' OR ')}) AND "dataAbertura" >= $${params.length}`;
    if (uf) { params.push(uf.toUpperCase()); where += ` AND uf = $${params.length}`; }

    return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${RF_TIMEOUT_MS}`);
        await tx.$executeRawUnsafe('SET LOCAL max_parallel_workers_per_gather = 0');
        await tx.$executeRawUnsafe('SET LOCAL jit = off');
        const rows = await tx.$queryRawUnsafe<Array<{
            razaoSocial: string; nomeFantasia: string | null; bairro: string | null; ddd: string | null;
            telefone: string | null; dataAbertura: string | null; porte: string | null;
        }>>(`SELECT "razaoSocial", "nomeFantasia", bairro, ddd, telefone, "dataAbertura", porte
             FROM "RfCompany" WHERE ${where} LIMIT 300`, ...params);
        const sorted = rows
            .filter((r) => r.telefone)
            .sort((a, b) => (b.dataAbertura ?? '').localeCompare(a.dataAbertura ?? ''));
        return {
            total: rows.length,
            list: sorted.slice(0, 5).map((r) => ({
                name: r.nomeFantasia?.trim() || r.razaoSocial,
                detail: [r.bairro, formatRfDate(r.dataAbertura) ? `aberta em ${formatRfDate(r.dataAbertura)}` : null].filter(Boolean).join(' · '),
                phone: maskPhone(r.ddd, r.telefone),
            })),
        };
    });
}

type HistoryPlace = { displayName?: { text?: string }; formattedAddress?: string; opportunityScore?: number; rating?: number; userRatingCount?: number; websiteUri?: string; nationalPhoneNumber?: string };

/** Fallback: the best leads from the user's own last search that they never saved. */
function fromHistory(resultsData: unknown, savedNames: Set<string>): ReengagementCompany[] {
    if (!Array.isArray(resultsData)) return [];
    return (resultsData as HistoryPlace[])
        .filter((p) => p.displayName?.text && !savedNames.has(p.displayName.text.toLowerCase()))
        .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
        .slice(0, 4)
        .map((p) => ({
            name: p.displayName!.text!,
            detail: [
                !p.websiteUri ? 'sem site' : null,
                p.rating != null ? `nota ${p.rating.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${p.userRatingCount != null ? ` (${p.userRatingCount})` : ''}` : null,
            ].filter(Boolean).join(' · '),
            phone: p.nationalPhoneNumber ? maskPhone(null, p.nationalPhoneNumber) : null,
        }));
}

export async function runReengagementEmails(now: Date, dryRun: boolean): Promise<ReengagementResult> {
    const result: ReengagementResult = { candidates: 0, sent: 0, fromRf: 0, fromHistory: 0 };
    const cutoff = addDays(now, -INACTIVE_DAYS);
    const users = await prisma.user.findMany({
        where: {
            notifyByEmail: true,
            disabledAt: null,
            email: { not: null },
            market: 'BR',
            searchHistory: { some: {}, none: { createdAt: { gte: cutoff } } },
        },
        select: {
            id: true, email: true, name: true, market: true,
            searchHistory: { orderBy: { createdAt: 'desc' }, take: 1, select: { textQuery: true, city: true, state: true, filters: true, resultsData: true } },
            analyses: { select: { lead: { select: { name: true } } }, take: 200 },
        },
        take: BATCH_LIMIT * 2,
    });
    if (users.length === 0) return result;

    const unsubscribed = new Set((await prisma.emailUnsubscribe.findMany({
        where: { email: { in: users.map((u) => u.email!).filter(Boolean) }, category: { in: ['ALL', 'MARKETING'] } },
        select: { email: true },
    })).map((u) => u.email.toLowerCase()));

    const latest = await rfLatestOpening();
    const since = latest ? addDays(new Date(`${latest.slice(0, 4)}-${latest.slice(4, 6)}-${latest.slice(6, 8)}T00:00:00Z`), -NEW_COMPANY_WINDOW_DAYS).toISOString().slice(0, 10).replace(/-/g, '') : null;
    const week = isoWeek(now);
    const redis = getRedisClient();
    const { inferCnaesForSearch } = await import('@/modules/search/application/search-rf-integration');

    for (const u of users) {
        if (result.sent >= BATCH_LIMIT) break;
        const last = u.searchHistory[0];
        if (!u.email || !last || unsubscribed.has(u.email.toLowerCase())) continue;
        const sends = Number((await redis?.get(`reengage:count:${u.id}`).catch(() => null)) ?? 0);
        if (sends >= MAX_SENDS) continue;
        if (await redis?.get(`reengage:week:${u.id}:${week}`).catch(() => null)) continue;
        result.candidates++;

        const niche = last.textQuery.replace(new RegExp(`\\b${(last.city ?? '').replace(/[.*+?^${}()|[\]\\]/g, '')}\\b`, 'gi'), '').replace(/\s+/g, ' ').trim() || last.textQuery;
        let companies: ReengagementCompany[] = [];
        let total = 0;
        let source: 'rf' | 'history' = 'history';
        try {
            if (last.city && since) {
                const includedType = (last.filters as { includedType?: string } | null)?.includedType ?? null;
                const cnaes = await inferCnaesForSearch(niche, includedType);
                const found = await newCompanies(cnaes, last.city, last.state && last.state !== 'Todos' ? last.state : null, since);
                if (found.list.length >= 2) { companies = found.list; total = found.total; source = 'rf'; }
            }
        } catch (err) {
            logger.warn('Reengagement RF lookup failed', { userId: u.id, error: err instanceof Error ? err.message : 'Unknown' });
        }
        if (companies.length === 0) {
            companies = fromHistory(last.resultsData, new Set(u.analyses.map((a) => a.lead.name.toLowerCase())));
            total = companies.length;
        }
        if (companies.length < 2) continue;

        if (dryRun) { result.sent++; source === 'rf' ? result.fromRf++ : result.fromHistory++; continue; }
        const ok = await sendReengagementEmail(u.id, { email: u.email, name: u.name, market: u.market }, {
            source, niche, city: last.city ?? null, companies, total, week,
        });
        if (ok) {
            result.sent++;
            source === 'rf' ? result.fromRf++ : result.fromHistory++;
            await redis?.set(`reengage:week:${u.id}:${week}`, '1', 'EX', 8 * 86400).catch(() => undefined);
            await redis?.incr(`reengage:count:${u.id}`).catch(() => undefined);
        }
    }
    return result;
}
