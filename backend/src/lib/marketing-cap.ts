/**
 * Marketing frequency cap shared by win-back e-mails and admin campaigns: at most one
 * marketing e-mail per user every few days, whichever system sends first.
 */
import { acquireRedisLock } from '@/lib/redis';

export const MARKETING_GAP_DAYS = 4;

/** True when the user may receive a marketing e-mail now (and reserves the slot). */
export async function claimMarketingSlot(userId: string, gapDays = MARKETING_GAP_DAYS): Promise<boolean> {
    try {
        return await acquireRedisLock(`mkt-touch:${userId}`, '1', gapDays * 24 * 60 * 60 * 1000);
    } catch {
        return true; // Redis down: do not block sends, dedup keys elsewhere still apply
    }
}
