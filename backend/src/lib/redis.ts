import Redis from 'ioredis';

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

export async function getCached<T>(key: string): Promise<T | null> {
    try {
        const client = getRedis();
        if (!client) return null;
        await client.connect().catch(() => { });
        const data = await client.get(key);
        if (!data) return null;
        return JSON.parse(data) as T;
    } catch {
        return null;
    }
}

export async function setCached(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    try {
        const client = getRedis();
        if (!client) return;
        await client.connect().catch(() => { });
        await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
        // silently fail — cache is optional
    }
}
