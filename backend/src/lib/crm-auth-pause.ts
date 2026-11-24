/**
 * When a CRM integration loses authorization, pushing every 30 minutes only produces the same
 * error. The push is paused per integration owner until the token is saved again (reconnect) or
 * the pause expires, so the health page is not red all day for one known problem.
 */
import { getRedisClient } from '@/lib/redis';

export const CRM_AUTH_PAUSE_HOURS = 6;
/** Repeated failures back off: 6 h, 12 h, 24 h, 48 h, then 72 h until someone reconnects. */
export const CRM_AUTH_PAUSE_MAX_HOURS = 72;

const key = (ownerUserId: string, provider: string) => `crm-auth-paused:${ownerUserId}:${provider}`;
const strikesKey = (ownerUserId: string, provider: string) => `crm-auth-strikes:${ownerUserId}:${provider}`;

export function pauseHoursForStrike(strike: number): number {
    return Math.min(CRM_AUTH_PAUSE_MAX_HOURS, CRM_AUTH_PAUSE_HOURS * 2 ** Math.max(0, strike - 1));
}

export async function isCrmPushPaused(ownerUserId: string, provider: string): Promise<boolean> {
    try {
        return (await getRedisClient()?.exists(key(ownerUserId, provider))) === 1;
    } catch {
        return false;
    }
}

export async function pauseCrmPush(ownerUserId: string, provider: string): Promise<number> {
    let hours = CRM_AUTH_PAUSE_HOURS;
    try {
        const redis = getRedisClient();
        if (!redis) return hours;
        const strike = await redis.incr(strikesKey(ownerUserId, provider));
        await redis.expire(strikesKey(ownerUserId, provider), 14 * 24 * 60 * 60);
        hours = pauseHoursForStrike(strike);
        await redis.set(key(ownerUserId, provider), '1', 'EX', hours * 60 * 60);
    } catch {
        /* best effort */
    }
    return hours;
}

/** Called whenever new CRM tokens are saved: the next run pushes again. */
export async function clearCrmPushPause(ownerUserId: string, provider: string): Promise<void> {
    try {
        await getRedisClient()?.del(key(ownerUserId, provider), strikesKey(ownerUserId, provider));
    } catch {
        /* best effort */
    }
}
