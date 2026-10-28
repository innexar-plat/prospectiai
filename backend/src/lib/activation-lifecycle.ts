/**
 * Activation emails for users who signed up but did not get value yet (production data:
 * 88% of searchers never came back after day one). Runs inside the daily billing cron.
 *  - D+1, onboarding done, no search  → first-search email with niches inferred from profile
 *  - D+3, at most one search          → activation nudge
 * Each email goes once per user (Redis dedup) and only to users with e-mail notifications on.
 */
import { prisma } from '@/lib/prisma';
import { addDays } from '@/lib/billing-period';
import { sendActivationNudgeEmail, sendFirstSearchEmail } from '@/lib/billing-emails';
import { suggestSearchTerms } from '@/lib/search-suggestions';

export interface ActivationResult { firstSearch: number; nudge: number }

type Candidate = {
    id: string; email: string | null; name: string | null; market: string;
    workspaces: Array<{ workspace: { productService: string | null; targetAudience: string | null; city: string | null } }>;
    _count: { searchHistory: number };
};

async function candidates(createdFrom: Date, createdTo: Date): Promise<Candidate[]> {
    return prisma.user.findMany({
        where: {
            createdAt: { gte: createdFrom, lt: createdTo },
            onboardingCompletedAt: { not: null },
            notifyByEmail: true,
            disabledAt: null,
            email: { not: null },
        },
        select: {
            id: true, email: true, name: true, market: true,
            workspaces: { take: 1, orderBy: { createdAt: 'asc' }, select: { workspace: { select: { productService: true, targetAudience: true, city: true } } } },
            _count: { select: { searchHistory: true } },
        },
        take: 200,
    }) as unknown as Promise<Candidate[]>;
}

export async function runActivationEmails(now: Date, dryRun: boolean): Promise<ActivationResult> {
    const result: ActivationResult = { firstSearch: 0, nudge: 0 };

    for (const u of await candidates(addDays(now, -2), addDays(now, -1))) {
        if (u._count.searchHistory > 0 || !u.email) continue;
        result.firstSearch++;
        if (dryRun) continue;
        const ws = u.workspaces[0]?.workspace;
        const terms = await suggestSearchTerms({ productService: ws?.productService, targetAudience: ws?.targetAudience }).catch(() => []);
        await sendFirstSearchEmail(u.id, { email: u.email, name: u.name, market: u.market }, terms, ws?.city);
    }

    for (const u of await candidates(addDays(now, -4), addDays(now, -3))) {
        if (u._count.searchHistory > 1 || !u.email) continue;
        result.nudge++;
        if (dryRun) continue;
        await sendActivationNudgeEmail(u.id, { email: u.email, name: u.name, market: u.market });
    }
    return result;
}
