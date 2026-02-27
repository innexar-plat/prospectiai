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
            // If redis is down, we allow the request but log it
            logger.warn('Redis down, bypassing rate limit', { identifier });
            return { success: true, remaining: limit, reset: 0 };
        }

        await client.connect().catch(() => { });

        const key = `ratelimit:${identifier}`;
        const current = await client.get(key);
        const count = current ? parseInt(current) : 0;

        if (count >= limit) {
            const ttl = await client.ttl(key);
            return {
                success: false,
                remaining: 0,
                reset: Date.now() + (ttl > 0 ? ttl * 1000 : windowSeconds * 1000)
            };
        }

        const multi = client.multi();
        multi.incr(key);
        if (!current) {
            multi.expire(key, windowSeconds);
        }
        await multi.exec();

        return {
            success: true,
            remaining: limit - (count + 1),
            reset: Date.now() + windowSeconds * 1000
        };
    } catch (error) {
        logger.error('Rate limit error', { error: error instanceof Error ? error.message : 'Unknown' });
        return { success: true, remaining: limit, reset: 0 };
    }
}
