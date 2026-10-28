/**
 * Daily backfill: saved leads with a website but no e-mail get their site (and its contact page)
 * scraped once. Bounded per run and remembered for 30 days, so it never hammers a site.
 */
import { prisma } from '@/lib/prisma';
import { acquireRedisLock } from '@/lib/redis';
import { scrapeWebsite, pickBestEmail } from '@/lib/website-scraper';

const BATCH = 50;
const CONCURRENCY = 5;
const RETRY_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export async function runEmailEnrichment(dryRun: boolean): Promise<{ checked: number; found: number }> {
    const leads = await prisma.lead.findMany({
        where: { website: { not: null }, email: null, recommendedEmail: null, analyses: { some: {} } },
        orderBy: { updatedAt: 'desc' },
        take: BATCH * 3,
        select: { id: true, website: true },
    });
    if (dryRun) return { checked: Math.min(leads.length, BATCH), found: 0 };

    const queue: Array<{ id: string; website: string }> = [];
    for (const lead of leads) {
        if (queue.length >= BATCH) break;
        if (!lead.website) continue;
        if (await acquireRedisLock(`email-enrich:${lead.id}`, '1', RETRY_AFTER_MS)) queue.push({ id: lead.id, website: lead.website });
    }

    let found = 0;
    for (let i = 0; i < queue.length; i += CONCURRENCY) {
        await Promise.all(queue.slice(i, i + CONCURRENCY).map(async (lead) => {
            const meta = await scrapeWebsite(lead.website);
            const email = pickBestEmail(meta.emails, lead.website);
            if (!email) return;
            const r = await prisma.lead.updateMany({ where: { id: lead.id, email: null, recommendedEmail: null }, data: { recommendedEmail: email } });
            found += r.count;
        }));
    }
    return { checked: queue.length, found };
}
