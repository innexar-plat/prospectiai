import Redis from 'ioredis';
import { logger } from './logger';

let redis: Redis | null = null;

function getRedis(): Redis | null {
    if (redis) return redis;
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
        redis = new Redis(url, {
            maxRetriesPerRequest: 1,
            retryStrategy: (times) => {
                if (times > 2) return null;
                return Math.min(times * 200, 1000);
            },
            lazyConnect: true,
        });
        redis.on('error', () => {
            redis = null;
        });
        return redis;
    } catch {
        return null;
    }
}

export async function rateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number
): Promise<{ success: boolean; remaining: number; reset: number }> {
    try {
        const client = getRedis();
        if (!client) {
            // Fail-closed: deny requests when Redis is unavailable
            logger.warn('Redis down, denying request (fail-closed)', { identifier });
            return { success: false, remaining: 0, reset: Date.now() + windowSeconds * 1000 };
        }

        await client.connect().catch(() => { });

        const key = `ratelimit:${identifier}`;

        // Atomic: INCR returns the new count; set TTL only on first increment
        const count = await client.incr(key);
        if (count === 1) {
            await client.expire(key, windowSeconds);
        }

        if (count > limit) {
            const ttl = await client.ttl(key);
            return {
                success: false,
                remaining: 0,
                reset: Date.now() + (ttl > 0 ? ttl * 1000 : windowSeconds * 1000),
            };
        }

        return {
            success: true,
            remaining: limit - count,
            reset: Date.now() + windowSeconds * 1000,
        };
    } catch (error) {
        // Fail-closed: deny on error
        logger.error('Rate limit error (fail-closed)', { error: error instanceof Error ? error.message : 'Unknown' });
        return { success: false, remaining: 0, reset: Date.now() + windowSeconds * 1000 };
    }
}
