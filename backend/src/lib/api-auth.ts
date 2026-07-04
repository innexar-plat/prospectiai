import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

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

export async function getApiSessionWithTokenVersionCheck(): Promise<Session | null> {
    try {
        const session = await auth();
        if (!session?.user?.id) return null;

        const rawToken = (session as unknown as { token?: JWT }).token;
        const tokenVersion = rawToken?.tokenVersion;

        if (tokenVersion !== undefined) {
            const dbUser = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { tokenVersion: true },
            });

            if (!dbUser || dbUser.tokenVersion !== tokenVersion) {
                return null;
            }
        }

        return session;
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.warn('getApiSessionWithTokenVersionCheck: auth() failed', {
            error: error instanceof Error ? error.message : 'Unknown',
        });
        return null;
    }
}
