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

/**
 * Check if a webhook event has already been processed (idempotency guard).
 * Returns `true` if the event was already processed and should be skipped.
 * Returns `false` if this is a new event (and marks it as processed).
 * TTL = 24 hours to match typical webhook retry windows.
 */
export async function isWebhookDuplicate(provider: string, eventId: string): Promise<boolean> {
    const client = getRedis();
    if (!client) {
        // If Redis is down, allow processing (fail-open for webhooks to avoid losing events)
        logger.warn('Redis unavailable for webhook dedup — allowing processing', { provider, eventId });
        return false;
    }

    try {
        await client.connect().catch(() => {});
        const key = `webhook:dedup:${provider}:${eventId}`;
        // SET NX returns 'OK' if the key was set (new event), null if already exists (duplicate)
        const result = await client.set(key, '1', 'EX', 86400, 'NX');
        if (result === null) {
            logger.info('Webhook duplicate detected — skipping', { provider, eventId });
            return true;
        }
        return false;
    } catch (err) {
        logger.warn('Redis dedup check failed — allowing processing', {
            provider,
            eventId,
            error: err instanceof Error ? err.message : 'Unknown',
        });
        return false;
    }
}
