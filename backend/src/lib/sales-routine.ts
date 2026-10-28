/**
 * Sales routine ("Hoje"): the short list a rep should work through today — follow-ups that are
 * due plus the best saved leads nobody has contacted yet. Pure queries, no AI cost.
 */
import { prisma } from '@/lib/prisma';

export const DEFAULT_FOLLOW_UP_DAYS = 3;
const MAX_FOLLOW_UPS = 20;
const MAX_FRESH = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AgendaReason = 'overdue' | 'due_today' | 'hot_new' | 'new';

export interface AgendaItem {
    analysisId: string;
    placeId: string;
    name: string;
    phone: string | null;
    score: number | null;
    closeProbability: number | null;
    bestContactWindow: string | null;
    whatsappMessage: string | null;
    status: 'NEW' | 'CONTACTED';
    nextFollowUpAt: string | null;
    contactedAt: string | null;
    reason: AgendaReason;
    overdueDays: number;
}

export interface TodayAgenda {
    items: AgendaItem[];
    stats: { dueCount: number; contactedToday: number; contactedThisWeek: number; activeLeads: number };
}

export function addDays(base: Date, days: number): Date {
    return new Date(base.getTime() + days * DAY_MS);
}

/**
 * Local day bounds for the viewer. `tzOffsetMinutes` follows Date#getTimezoneOffset
 * (Brasília = 180); defaults to BRT so the e-mail cron agrees with the dashboard.
 */
export function localDayBounds(now: Date, tzOffsetMinutes = 180): { start: Date; end: Date } {
    const offsetMs = tzOffsetMinutes * 60 * 1000;
    const local = new Date(now.getTime() - offsetMs);
    const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    const start = new Date(startLocal + offsetMs);
    return { start, end: new Date(start.getTime() + DAY_MS) };
}

type AgendaRow = {
    id: string;
    score: number | null;
    closeProbability: number | null;
    bestContactWindow: string | null;
    suggestedWhatsAppMessage: string | null;
    firstContactMessage: string | null;
    status: string;
    nextFollowUpAt: Date | null;
    contactedAt: Date | null;
    lead: { placeId: string; name: string; phone: string | null; recommendedPhone: string | null };
};

const AGENDA_SELECT = {
    id: true,
    score: true,
    closeProbability: true,
    bestContactWindow: true,
    suggestedWhatsAppMessage: true,
    firstContactMessage: true,
    status: true,
    nextFollowUpAt: true,
    contactedAt: true,
    lead: { select: { placeId: true, name: true, phone: true, recommendedPhone: true } },
} as const;

function toItem(row: AgendaRow, reason: AgendaReason, dayStart: Date): AgendaItem {
    const overdueDays = row.nextFollowUpAt && row.nextFollowUpAt < dayStart
        ? Math.ceil((dayStart.getTime() - row.nextFollowUpAt.getTime()) / DAY_MS)
        : 0;
    return {
        analysisId: row.id,
        placeId: row.lead.placeId,
        name: row.lead.name,
        phone: row.lead.recommendedPhone || row.lead.phone || null,
        score: row.score,
        closeProbability: row.closeProbability,
        bestContactWindow: row.bestContactWindow,
        whatsappMessage: row.suggestedWhatsAppMessage || row.firstContactMessage || null,
        status: row.status === 'CONTACTED' ? 'CONTACTED' : 'NEW',
        nextFollowUpAt: row.nextFollowUpAt?.toISOString() ?? null,
        contactedAt: row.contactedAt?.toISOString() ?? null,
        reason,
        overdueDays,
    };
}

export async function getTodayAgenda(
    scope: { userId: string; workspaceId?: string | null },
    now = new Date(),
    tzOffsetMinutes?: number,
): Promise<TodayAgenda> {
    const owner = scope.workspaceId ? { workspaceId: scope.workspaceId } : { userId: scope.userId };
    const { start, end } = localDayBounds(now, tzOffsetMinutes);
    const active = { in: ['NEW', 'CONTACTED'] as ('NEW' | 'CONTACTED')[] };

    const [due, fresh, activeLeads, contactedToday, contactedThisWeek] = await Promise.all([
        prisma.leadAnalysis.findMany({
            where: { ...owner, status: active, nextFollowUpAt: { lt: end } },
            orderBy: { nextFollowUpAt: 'asc' },
            take: MAX_FOLLOW_UPS,
            select: AGENDA_SELECT,
        }),
        prisma.leadAnalysis.findMany({
            where: { ...owner, status: 'NEW', nextFollowUpAt: null, contactedAt: null },
            orderBy: [{ score: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
            take: MAX_FRESH,
            select: AGENDA_SELECT,
        }),
        prisma.leadAnalysis.count({ where: { ...owner, status: active } }),
        prisma.leadAnalysis.count({ where: { ...owner, contactedAt: { gte: start, lt: end } } }),
        prisma.leadAnalysis.count({ where: { ...owner, contactedAt: { gte: addDays(start, -6), lt: end } } }),
    ]);

    const items = [
        ...(due as AgendaRow[]).map((r) => toItem(r, r.nextFollowUpAt && r.nextFollowUpAt < start ? 'overdue' : 'due_today', start)),
        ...(fresh as AgendaRow[]).map((r) => toItem(r, (r.score ?? 0) >= 70 ? 'hot_new' : 'new', start)),
    ];

    return { items, stats: { dueCount: due.length, contactedToday, contactedThisWeek, activeLeads } };
}

/** Follow-up date implied by a status change, or undefined to leave it untouched. */
export function followUpForStatusChange(
    status: string | undefined,
    previous: string,
    explicit: string | null | undefined,
    now = new Date(),
): Date | null | undefined {
    if (explicit !== undefined) return explicit === null ? null : new Date(explicit);
    if (status === 'CONVERTED' || status === 'LOST') return null;
    if (status === 'CONTACTED' && previous !== 'CONTACTED') return addDays(now, DEFAULT_FOLLOW_UP_DAYS);
    return undefined;
}

/**
 * Daily e-mail: "you have N follow-ups today". Sent only when at least one follow-up falls due
 * today (overdue ones are counted in, but never trigger an e-mail alone — no daily nagging).
 */
export async function runFollowUpReminders(now: Date, dryRun: boolean): Promise<{ sent: number; pushed: number; candidates: number }> {
    const { start, end } = localDayBounds(now);
    const due = await prisma.leadAnalysis.findMany({
        where: { status: { in: ['NEW', 'CONTACTED'] }, nextFollowUpAt: { lt: end } },
        orderBy: { nextFollowUpAt: 'asc' },
        take: 5000,
        select: { userId: true, nextFollowUpAt: true, lead: { select: { name: true } } },
    });

    const byUser = new Map<string, { names: string[]; dueToday: number; overdue: number }>();
    for (const row of due) {
        const entry = byUser.get(row.userId) ?? { names: [], dueToday: 0, overdue: 0 };
        if (row.nextFollowUpAt && row.nextFollowUpAt >= start) entry.dueToday += 1;
        else entry.overdue += 1;
        if (entry.names.length < 5) entry.names.push(row.lead.name);
        byUser.set(row.userId, entry);
    }
    const userIds = [...byUser].filter(([, e]) => e.dueToday > 0).map(([id]) => id);
    if (userIds.length === 0) return { sent: 0, pushed: 0, candidates: 0 };

    const users = await prisma.user.findMany({
        where: { id: { in: userIds }, disabledAt: null },
        select: { id: true, email: true, name: true, market: true, notifyByEmail: true },
    });
    if (dryRun) return { sent: 0, pushed: 0, candidates: users.length };

    const { sendFollowUpReminderEmail } = await import('@/lib/billing-emails');
    const { createNotification } = await import('@/lib/notification-service');
    const { acquireRedisLock } = await import('@/lib/redis');
    const day = start.toISOString().slice(0, 10);
    let sent = 0;
    let pushed = 0;
    for (const user of users) {
        const entry = byUser.get(user.id);
        if (!entry) continue;
        const total = entry.dueToday + entry.overdue;
        const en = user.market === 'US';

        // In-app notification + web push (phone), once per user per day.
        if (await acquireRedisLock(`followup-push:${user.id}:${day}`, '1', 36 * 60 * 60 * 1000)) {
            await createNotification({
                userId: user.id,
                channel: 'follow_up_due',
                title: en ? `${total} follow-up${total === 1 ? '' : 's'} today` : `${total} follow-up${total === 1 ? '' : 's'} para hoje`,
                message: en
                    ? `${entry.names.slice(0, 2).join(', ')}${total > 2 ? ' and more' : ''} are waiting. The message is ready.`
                    : `${entry.names.slice(0, 2).join(', ')}${total > 2 ? ' e outros' : ''} estão esperando. A mensagem já está pronta.`,
                link: '/dashboard#hoje',
                locale: en ? 'en' : 'pt',
                market: en ? 'US' : 'BR',
            }).then(() => { pushed += 1; }).catch(() => { /* best effort */ });
        }

        if (!user.email || !user.notifyByEmail) continue;
        const ok = await sendFollowUpReminderEmail(user.id, { email: user.email, name: user.name, market: user.market }, {
            total,
            overdue: entry.overdue,
            names: entry.names,
            day,
        });
        if (ok) sent += 1;
    }
    return { sent, pushed, candidates: users.length };
}
