/**
 * Radar de empresas novas: for each niche + place the user actually searches, the companies
 * that opened recently (Receita base, refreshed monthly). Shown on the dashboard and sent as a
 * weekly digest (e-mail + push) to active users — a reason to come back every week that never
 * runs out, because the base keeps growing.
 *
 * Cost: one bounded, index-driven RF query per interest (max 3), cached for 12 h per user.
 */
import { prisma } from '@/lib/prisma';
import { getCached, setCached, getRedisClient } from '@/lib/redis';
import { addDays } from '@/lib/billing-period';
import { fold } from '@/lib/br-cities';
import { parseSearchIntent } from '@/lib/search-intent';
import { displayName } from '@/lib/sample-list';
import { formatRfDate, queryNewCompanyRows, rfLatestOpening } from '@/lib/reengagement';
import { claimMarketingSlot } from '@/lib/marketing-cap';
import { logger } from '@/lib/logger';

const MAX_INTERESTS = 3;
const COMPANIES_PER_INTEREST = 8;
const WINDOW_DAYS = 45;
const CACHE_TTL_SECONDS = 12 * 60 * 60;
const DIGEST_BATCH_LIMIT = 150;
const ACTIVE_DAYS = 14;

export interface RadarInterest { niche: string; city: string | null; state: string | null; includedType: string | null }

export interface RadarCompany {
    cnpj: string;
    name: string;
    bairro: string | null;
    openedAt: string | null;
    porte: string | null;
    phone: string | null;
    email: string | null;
}

export interface RadarItem {
    niche: string;
    city: string | null;
    state: string | null;
    /** Companies opened in the window (capped at 300 by the query). */
    total: number;
    companies: RadarCompany[];
}

export interface Radar { since: string | null; items: RadarItem[]; generatedAt: string }

const PORTE_LABEL: Record<string, string> = { ME: 'Microempresa', EPP: 'Pequeno porte', DEMAIS: 'Médio/grande porte' };

function formatPhone(ddd: string | null, tel: string | null): string | null {
    const digits = (tel ?? '').replace(/\D/g, '');
    if (digits.length < 8) return null;
    const local = `${digits.slice(0, -4)}-${digits.slice(-4)}`;
    return ddd ? `(${ddd}) ${local}` : local;
}

/**
 * The user's distinct niche + place pairs, most recent first. Searches without a place are
 * skipped (a whole-country radar is noise); the business profile is the fallback.
 */
export async function getRadarInterests(userId: string): Promise<RadarInterest[]> {
    const history = await prisma.searchHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: { textQuery: true, city: true, state: true, filters: true },
    });
    const seen = new Set<string>();
    const out: RadarInterest[] = [];
    for (const h of history) {
        const state = h.state && /^[A-Z]{2}$/.test(h.state) ? h.state : null;
        const parsed = parseSearchIntent(h.textQuery, state);
        const city = h.city?.trim() || parsed.city;
        const uf = state ?? parsed.state;
        const niche = (parsed.understood ? parsed.term : h.textQuery).trim();
        if (niche.length < 3 || (!city && !uf)) continue;
        const key = `${fold(niche)}|${fold(city ?? '')}|${uf ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ niche, city: city ?? null, state: uf ?? null, includedType: (h.filters as { includedType?: string } | null)?.includedType ?? null });
        if (out.length >= MAX_INTERESTS) break;
    }
    if (out.length > 0) return out;

    const membership = await prisma.workspaceMember.findFirst({
        where: { userId },
        orderBy: { workspace: { createdAt: 'asc' } },
        select: { workspace: { select: { targetAudience: true, city: true, state: true } } },
    });
    const ws = membership?.workspace;
    const niche = ws?.targetAudience?.split(/[,;\n]/)[0]?.trim();
    if (niche && niche.length >= 3 && (ws?.city || ws?.state)) {
        return [{ niche, city: ws.city ?? null, state: ws.state ?? null, includedType: null }];
    }
    return [];
}

async function radarSince(): Promise<string | null> {
    const latest = await rfLatestOpening();
    if (!latest) return null;
    const d = new Date(`${latest.slice(0, 4)}-${latest.slice(4, 6)}-${latest.slice(6, 8)}T00:00:00Z`);
    return addDays(d, -WINDOW_DAYS).toISOString().slice(0, 10).replace(/-/g, '');
}

async function buildItem(interest: RadarInterest, since: string): Promise<RadarItem | null> {
    const { inferCnaesForSearch } = await import('@/modules/search/application/search-rf-integration');
    const cnaes = await inferCnaesForSearch(interest.niche, interest.includedType);
    if (cnaes.length === 0) return null;
    const rows = await queryNewCompanyRows(cnaes, interest.city, interest.state, since);
    const companies = rows
        .filter((r) => r.telefone || r.email)
        .sort((a, b) => (b.dataAbertura ?? '').localeCompare(a.dataAbertura ?? ''))
        .slice(0, COMPANIES_PER_INTEREST)
        .map((r) => ({
            cnpj: r.cnpj,
            name: displayName(r.nomeFantasia, r.razaoSocial),
            bairro: r.bairro?.trim() || null,
            openedAt: formatRfDate(r.dataAbertura),
            porte: r.porte ? PORTE_LABEL[r.porte] ?? null : null,
            phone: formatPhone(r.ddd, r.telefone),
            email: r.email?.trim().toLowerCase() || null,
        }));
    return { niche: interest.niche, city: interest.city, state: interest.state, total: rows.length, companies };
}

export async function getRadar(userId: string, opts: { fresh?: boolean } = {}): Promise<Radar> {
    const key = `radar:v1:${userId}`;
    if (!opts.fresh) {
        const cached = await getCached<Radar>(key);
        if (cached) return cached;
    }
    const [interests, since] = await Promise.all([getRadarInterests(userId), radarSince()]);
    const items: RadarItem[] = [];
    if (since) {
        for (const interest of interests) {
            try {
                const item = await buildItem(interest, since);
                if (item && item.companies.length > 0) items.push(item);
            } catch (err) {
                logger.warn('Radar lookup skipped', { userId, niche: interest.niche, error: err instanceof Error ? err.message : 'Unknown' });
            }
        }
    }
    const radar: Radar = { since: since ? formatRfDate(since) : null, items, generatedAt: new Date().toISOString() };
    await setCached(key, radar, CACHE_TTL_SECONDS).catch(() => undefined);
    return radar;
}

// ── Weekly digest ──────────────────────────────────────────────────────────

export interface RadarDigestResult { candidates: number; sent: number; pushed: number }

function isoWeek(d: Date): string {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)).padStart(2, '0')}`;
}

/** Monday in Brasília (UTC-3). */
export function isRadarDay(now: Date): boolean {
    return new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCDay() === 1;
}

/**
 * Monday digest for users who searched in the last 14 days (the inactive ones get the win-back
 * e-mail instead). One per ISO week, respects e-mail opt-out and the shared marketing cap.
 */
export async function runRadarDigest(now: Date, dryRun: boolean): Promise<RadarDigestResult> {
    const result: RadarDigestResult = { candidates: 0, sent: 0, pushed: 0 };
    if (!isRadarDay(now)) return result;
    const users = await prisma.user.findMany({
        where: {
            disabledAt: null,
            email: { not: null },
            market: 'BR',
            searchHistory: { some: { createdAt: { gte: addDays(now, -ACTIVE_DAYS) } } },
        },
        select: { id: true, email: true, name: true, market: true, notifyByEmail: true },
        take: DIGEST_BATCH_LIMIT * 2,
    });
    if (users.length === 0) return result;

    const unsubscribed = new Set((await prisma.emailUnsubscribe.findMany({
        where: { email: { in: users.map((u) => u.email!).filter(Boolean) }, category: { in: ['ALL', 'MARKETING'] } },
        select: { email: true },
    })).map((u) => u.email.toLowerCase()));
    const week = isoWeek(now);
    const redis = getRedisClient();
    const { sendRadarDigestEmail } = await import('@/lib/billing-emails');
    const { createNotification } = await import('@/lib/notification-service');

    for (const u of users) {
        if (result.sent >= DIGEST_BATCH_LIMIT) break;
        const weekKey = `radar:week:${u.id}:${week}`;
        if (await redis?.get(weekKey).catch(() => null)) continue;
        const radar = await getRadar(u.id, { fresh: true });
        const total = radar.items.reduce((n, i) => n + i.total, 0);
        if (radar.items.length === 0 || total < 3) continue;
        result.candidates++;
        if (dryRun) { result.sent++; continue; }

        const top = radar.items[0]!;
        const place = top.city ?? top.state ?? '';
        await createNotification({
            userId: u.id,
            channel: 'radar_weekly',
            title: `Radar: ${total >= 300 ? '300+' : total} empresas novas para você`,
            message: `${top.niche}${place ? ` em ${place}` : ''}: ${top.companies.slice(0, 2).map((c) => c.name).join(', ')} e outras acabaram de abrir.`,
            link: '/dashboard#radar',
        }).then(() => { result.pushed++; }).catch(() => undefined);

        const email = u.email!;
        if (u.notifyByEmail && !unsubscribed.has(email.toLowerCase()) && await claimMarketingSlot(u.id)) {
            const ok = await sendRadarDigestEmail(u.id, { email, name: u.name, market: u.market }, {
                week,
                total,
                items: radar.items.map((i) => ({
                    niche: i.niche,
                    place: i.city ? `${i.city}${i.state ? `/${i.state}` : ''}` : i.state ?? '',
                    total: i.total,
                    companies: i.companies.slice(0, 3).map((c) => ({
                        name: c.name,
                        detail: [c.bairro, c.openedAt ? `aberta em ${c.openedAt}` : null].filter(Boolean).join(' · '),
                        // Enough to show it is real; the full number is one click away.
                        phone: c.phone ? c.phone.replace(/\d{4}$/, '••••') : null,
                    })),
                })),
            });
            if (ok) result.sent++;
        }
        await redis?.set(weekKey, '1', 'EX', 8 * 86400).catch(() => undefined);
    }
    return result;
}
