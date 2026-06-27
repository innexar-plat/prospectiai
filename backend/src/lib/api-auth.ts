import { auth } from '@/auth';
import type { Session } from 'next-auth';

/**
 * Resolves the current session for API routes without surfacing auth internals as 500.
 * Returns null when unauthenticated or when auth() throws (invalid/expired JWT, etc.).
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
