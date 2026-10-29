/**
 * Admin view of cold outreach: volume, opens, opt-outs, bounces, warm-up budget for today and
 * the latest e-mails sent. Aggregated in the database.
 */
import { prisma } from '@/lib/prisma';
import { brtDayStart, isBusinessHoursBrt, warmupDailyCap } from '@/lib/cold-email-guard';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getAutoProspEmailStats(workspaceId: string, now = new Date()) {
    const lead = { workspaceId };
    const [config, poolSenders, sentToday, sent7d, sentTotal, opened7d, openedTotal, byStatus, recent, daily] = await Promise.all([
        prisma.autoProspeccaoConfig.findUnique({ where: { workspaceId } }),
        prisma.autoProspSenderPool.count({ where: { workspaceId, isActive: true } }),
        prisma.prospectedLeadEmailEvent.count({ where: { lead, sentAt: { gte: brtDayStart(now) } } }),
        prisma.prospectedLeadEmailEvent.count({ where: { lead, sentAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } } }),
        prisma.prospectedLeadEmailEvent.count({ where: { lead } }),
        prisma.prospectedLeadEmailEvent.count({ where: { lead, sentAt: { gte: new Date(now.getTime() - 7 * DAY_MS) }, openedAt: { not: null } } }),
        prisma.prospectedLeadEmailEvent.count({ where: { lead, openedAt: { not: null } } }),
        prisma.prospectedLead.groupBy({ by: ['status'], where: { workspaceId }, _count: { _all: true } }),
        prisma.prospectedLeadEmailEvent.findMany({
            where: { lead },
            orderBy: { sentAt: 'desc' },
            take: 50,
            select: {
                id: true, step: true, subject: true, sentAt: true, openedAt: true,
                lead: { select: { razaoSocial: true, nomeFantasia: true, email: true, municipio: true, uf: true, status: true, score: true } },
            },
        }),
        prisma.$queryRaw<Array<{ day: string; sent: bigint; opened: bigint }>>`
            SELECT to_char(date_trunc('day', e."sentAt" - interval '3 hours'), 'YYYY-MM-DD') AS day,
                   count(*) AS sent, count(e."openedAt") AS opened
            FROM "ProspectedLeadEmailEvent" e JOIN "ProspectedLead" l ON l.id = e."leadId"
            WHERE l."workspaceId" = ${workspaceId} AND e."sentAt" >= ${new Date(now.getTime() - 14 * DAY_MS)}
            GROUP BY 1 ORDER BY 1`,
    ]);

    const useSystem = poolSenders === 0 && config?.useSystemSender === true;
    const dailyCap = useSystem
        ? warmupDailyCap(config?.systemSenderStartedAt ?? null, now, config?.maxEmailsPerDay ?? 120)
        : (config?.maxEmailsPerDay ?? 0);
    const status = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]));

    return {
        sender: {
            mode: poolSenders > 0 ? 'pool' : useSystem ? 'system' : 'none',
            active: config?.isActive === true && config?.emailAutoSend === true,
            startedAt: config?.systemSenderStartedAt?.toISOString() ?? null,
            dailyCap,
            sentToday,
            remainingToday: Math.max(0, dailyCap - sentToday),
            businessHoursNow: isBusinessHoursBrt(now),
            replyTo: config?.replyToEmail ?? null,
            senderName: config?.senderName ?? null,
        },
        totals: {
            sent7d, sentTotal, opened7d, openedTotal,
            openRate7d: sent7d ? Math.round((opened7d / sent7d) * 100) : null,
            optedOut: status.OPTED_OUT ?? 0,
            bounced: status.BOUNCED ?? 0,
        },
        pipeline: status,
        daily: daily.map((d) => ({ day: d.day, sent: Number(d.sent), opened: Number(d.opened) })),
        recent: recent.map((e) => ({
            id: e.id,
            step: e.step,
            subject: e.subject,
            sentAt: e.sentAt?.toISOString() ?? null,
            openedAt: e.openedAt?.toISOString() ?? null,
            company: e.lead.nomeFantasia || e.lead.razaoSocial,
            email: e.lead.email,
            city: [e.lead.municipio, e.lead.uf].filter(Boolean).join(' / '),
            leadStatus: e.lead.status,
            score: e.lead.score,
        })),
    };
}
