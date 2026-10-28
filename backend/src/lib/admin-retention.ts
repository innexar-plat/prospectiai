/**
 * Admin retention metrics: activation funnel for a signup cohort, weekly engagement with the
 * sales routine and AI token cost per analysis. Aggregated in SQL — never loads rows into memory.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const PAID_PLANS = ['BASIC', 'PRO', 'BUSINESS', 'SCALE'];

export interface RetentionFunnel {
    signups: number;
    onboarded: number;
    searched: number;
    savedLead: number;
    contacted: number;
    paid: number;
    /** Cohort members old enough (7+ days) to have returned in week 2. */
    eligibleForReturn: number;
    returnedAfter7d: number;
}

export interface WeeklyEngagement {
    activeSearchers: number;
    contactsLogged: number;
    usersContacting: number;
    followUpsScheduled: number;
    followUpsOverdue: number;
}

export interface AiCostDay {
    day: string;
    calls: number;
    avgInput: number;
    avgOutput: number;
}

export interface RetentionReport {
    cohortDays: number;
    funnel: RetentionFunnel;
    weekly: WeeklyEngagement;
    aiCost: AiCostDay[];
}

const toNum = (v: unknown): number => (typeof v === 'bigint' ? Number(v) : Number(v ?? 0));

export async function getRetentionReport(cohortDays: number, now = new Date()): Promise<RetentionReport> {
    const since = new Date(now.getTime() - cohortDays * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [funnelRows, weeklyRows, aiRows] = await Promise.all([
        prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
            WITH cohort AS (
                SELECT id, "createdAt", "onboardingCompletedAt" FROM "User"
                WHERE "createdAt" >= ${since} AND "disabledAt" IS NULL
            )
            SELECT
                count(*) AS signups,
                count(*) FILTER (WHERE c."onboardingCompletedAt" IS NOT NULL) AS onboarded,
                count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "SearchHistory" s WHERE s."userId" = c.id)) AS searched,
                count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "LeadAnalysis" l WHERE l."userId" = c.id)) AS "savedLead",
                count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "LeadAnalysis" l WHERE l."userId" = c.id AND l."contactedAt" IS NOT NULL)) AS contacted,
                count(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM "WorkspaceMember" m JOIN "Workspace" w ON w.id = m."workspaceId"
                    WHERE m."userId" = c.id AND w.plan::text IN (${Prisma.join(PAID_PLANS)}) AND w."subscriptionId" IS NOT NULL
                )) AS paid,
                count(*) FILTER (WHERE c."createdAt" <= ${weekAgo}) AS "eligibleForReturn",
                count(*) FILTER (WHERE c."createdAt" <= ${weekAgo} AND EXISTS (
                    SELECT 1 FROM "SearchHistory" s WHERE s."userId" = c.id AND s."createdAt" >= c."createdAt" + interval '7 days'
                )) AS "returnedAfter7d"
            FROM cohort c
        `),
        prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
            SELECT
                (SELECT count(DISTINCT "userId") FROM "SearchHistory" WHERE "createdAt" >= ${weekAgo}) AS "activeSearchers",
                (SELECT count(*) FROM "LeadAnalysis" WHERE "contactedAt" >= ${weekAgo}) AS "contactsLogged",
                (SELECT count(DISTINCT "userId") FROM "LeadAnalysis" WHERE "contactedAt" >= ${weekAgo}) AS "usersContacting",
                (SELECT count(*) FROM "LeadAnalysis" WHERE "nextFollowUpAt" IS NOT NULL AND status IN ('NEW', 'CONTACTED')) AS "followUpsScheduled",
                (SELECT count(*) FROM "LeadAnalysis" WHERE "nextFollowUpAt" < ${now} AND status IN ('NEW', 'CONTACTED')) AS "followUpsOverdue"
        `),
        prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
            SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
                   count(*) AS calls,
                   round(avg((metadata->>'inputTokens')::numeric)) AS "avgInput",
                   round(avg((metadata->>'outputTokens')::numeric)) AS "avgOutput"
            FROM "UsageEvent"
            WHERE type = 'AI_TOKENS' AND "createdAt" >= ${new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)}
            GROUP BY 1 ORDER BY 1
        `),
    ]);

    const f = funnelRows[0] ?? {};
    const w = weeklyRows[0] ?? {};
    return {
        cohortDays,
        funnel: {
            signups: toNum(f.signups),
            onboarded: toNum(f.onboarded),
            searched: toNum(f.searched),
            savedLead: toNum(f.savedLead),
            contacted: toNum(f.contacted),
            paid: toNum(f.paid),
            eligibleForReturn: toNum(f.eligibleForReturn),
            returnedAfter7d: toNum(f.returnedAfter7d),
        },
        weekly: {
            activeSearchers: toNum(w.activeSearchers),
            contactsLogged: toNum(w.contactsLogged),
            usersContacting: toNum(w.usersContacting),
            followUpsScheduled: toNum(w.followUpsScheduled),
            followUpsOverdue: toNum(w.followUpsOverdue),
        },
        aiCost: aiRows.map((r) => ({ day: String(r.day), calls: toNum(r.calls), avgInput: toNum(r.avgInput), avgOutput: toNum(r.avgOutput) })),
    };
}
