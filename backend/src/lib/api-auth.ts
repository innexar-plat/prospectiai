import { auth } from '@/auth';
import type { Session } from 'next-auth';

/**
 * Session revocation (deactivated account, force-logout, tokenVersion bump) is enforced
 * centrally in the `jwt()` callback in `@/auth`, so any `auth()` call — including this one —
 * already returns `null` for a revoked session.
 */
export async function getApiSession(): Promise<Session | null> {
    try {
        const session = await auth();
        return session;
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.warn('getApiSession: auth() failed', {
            error: error instanceof Error ? error.message : 'Unknown',
        });
        return null;
    }
}
