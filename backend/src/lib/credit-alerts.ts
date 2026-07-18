/**
 * Low-credit upgrade nudge: when a workspace crosses ~70% credit usage,
 * email the owner once per cycle (Redis SET-NX dedup, 30-day TTL).
 * Fire-and-forget — must never block or fail a search/analyze request.
 */
import { prisma } from '@/lib/prisma';
import { sendLowCreditsEmail } from '@/lib/email';
import { getSiteUrlForMarket } from '@/lib/site-url';
import { acquireRedisLock } from '@/lib/redis';
import { logger } from '@/lib/logger';
import type { Locale } from '@/lib/i18n/locale';

const DEDUP_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function maybeSendLowCreditsAlert(workspaceId: string): Promise<void> {
    try {
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: {
                plan: true,
                leadsUsed: true,
                leadsLimit: true,
                members: {
                    where: { role: 'OWNER' },
                    take: 1,
                    select: { user: { select: { email: true, market: true } } },
                },
            },
        });
        if (!workspace || workspace.leadsLimit <= 0) return;

        const remaining = workspace.leadsLimit - workspace.leadsUsed;
        const threshold = Math.max(1, Math.ceil(workspace.leadsLimit * 0.3));
        if (remaining <= 0 || remaining > threshold) return;

        const owner = workspace.members[0]?.user;
        if (!owner?.email) return;

        const firstSend = await acquireRedisLock(`lowcredit:email:${workspaceId}`, '1', DEDUP_TTL_MS);
        if (!firstSend) return;

        const market = owner.market === 'US' ? 'US' : 'BR';
        const locale: Locale = market === 'US' ? 'en' : 'pt';
        const siteUrl = getSiteUrlForMarket(market);

        const result = await sendLowCreditsEmail(owner.email, remaining, workspace.leadsLimit, locale, siteUrl);
        if (result.sent) {
            logger.info('Low-credits email sent', { workspaceId, email: owner.email, remaining });
        }
    } catch (err) {
        logger.warn('Low-credits alert failed', { workspaceId, error: err instanceof Error ? err.message : 'Unknown' });
    }
}
