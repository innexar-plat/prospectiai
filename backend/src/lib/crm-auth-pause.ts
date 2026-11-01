/**
 * When a CRM integration loses authorization, pushing every 30 minutes only produces the same
 * error. The push is paused per integration owner until the token is saved again (reconnect) or
 * the pause expires, so the health page is not red all day for one known problem.
 */
import { getRedisClient } from '@/lib/redis';

export const CRM_AUTH_PAUSE_HOURS = 6;

const key = (ownerUserId: string, provider: string) => `crm-auth-paused:${ownerUserId}:${provider}`;

export async function isCrmPushPaused(ownerUserId: string, provider: string): Promise<boolean> {
    try {
        return (await getRedisClient()?.exists(key(ownerUserId, provider))) === 1;
    } catch {
        return false;
    }
}

export async function pauseCrmPush(ownerUserId: string, provider: string, hours = CRM_AUTH_PAUSE_HOURS): Promise<void> {
    try {
        await getRedisClient()?.set(key(ownerUserId, provider), '1', 'EX', hours * 60 * 60);
    } catch {
        /* best effort */
    }
}

/** Called whenever new CRM tokens are saved: the next run pushes again. */
export async function clearCrmPushPause(ownerUserId: string, provider: string): Promise<void> {
    try {
        await getRedisClient()?.del(key(ownerUserId, provider));
    } catch {
        /* best effort */
    }
}
