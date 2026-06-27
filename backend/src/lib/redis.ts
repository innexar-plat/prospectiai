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

export async function acquireRedisLock(key: string, token: string, ttlMs: number): Promise<boolean> {
    try {
        const client = getRedis();
        if (!client) return false;
        await client.connect().catch(() => { });
        const result = await client.set(key, token, 'PX', Math.max(250, ttlMs), 'NX');
        return result === 'OK';
    } catch {
        return false;
    }
}

export async function releaseRedisLock(key: string, token: string): Promise<void> {
    try {
        const client = getRedis();
        if (!client) return;
        await client.connect().catch(() => { });
        // Delete lock only if token matches (prevents releasing another worker's lock).
        await client.eval(
            "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
            1,
            key,
            token,
        );
    } catch {
        // silently fail
    }
}

export async function waitForCached<T>(
    key: string,
    timeoutMs: number,
    pollIntervalMs: number,
): Promise<T | null> {
    const timeout = Math.max(0, timeoutMs);
    const poll = Math.max(25, pollIntervalMs);
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeout) {
        const cached = await getCached<T>(key);
        if (cached != null) return cached;
        await new Promise((resolve) => setTimeout(resolve, poll));
    }

    return null;
}

const PRESENCE_PREFIX = 'presence:';
const PRESENCE_TTL = 90; // seconds — heartbeat every 30s, key expires after 90s

export async function setPresence(userId: string): Promise<void> {
    try {
        const client = getRedis();
        if (!client) return;
        await client.connect().catch(() => { });
        await client.set(`${PRESENCE_PREFIX}${userId}`, '1', 'EX', PRESENCE_TTL);
    } catch {
        // silently fail
    }
}

export async function countOnlineUsers(): Promise<number> {
    try {
        const client = getRedis();
        if (!client) return 0;
        await client.connect().catch(() => { });
        let cursor = '0';
        let count = 0;
        do {
            const [next, keys] = await client.scan(cursor, 'MATCH', `${PRESENCE_PREFIX}*`, 'COUNT', 200);
            cursor = next;
            count += keys.length;
        } while (cursor !== '0');
        return count;
    } catch {
        return 0;
    }
}
