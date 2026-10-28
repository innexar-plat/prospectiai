/**
 * Lightweight operational telemetry kept in Redis for the admin "Saúde do sistema" page:
 * last run of each cron, last webhook per provider, and an error counter / recent error list.
 * Every call is best-effort: telemetry must never break the request that records it.
 */
import { getRedisClient } from '@/lib/redis';

const CRON_KEY = (name: string) => `ops:cron:${name}`;
const CRON_HISTORY_KEY = (name: string) => `ops:cron-history:${name}`;
const WEBHOOK_KEY = (provider: string) => `ops:webhook:${provider}`;
const ERROR_HOUR_KEY = (d: Date) => `ops:errors:${d.toISOString().slice(0, 13)}`;
const RECENT_ERRORS_KEY = 'ops:errors:recent';
const HISTORY_LEN = 20;
const RECENT_ERRORS_LEN = 50;
const ERROR_HOUR_TTL_S = 8 * 24 * 3600;

export interface CronRun {
    at: string;
    ok: boolean;
    durationMs: number;
    summary?: string;
}

export interface WebhookStatus {
    lastAt?: string;
    lastOkAt?: string;
    lastError?: string;
    lastErrorAt?: string;
}

export interface RecentError {
    at: string;
    message: string;
    route?: string;
}

export async function recordCronRun(name: string, run: Omit<CronRun, 'at'>): Promise<void> {
    try {
        const r = getRedisClient();
        if (!r) return;
        const entry: CronRun = { at: new Date().toISOString(), ...run, summary: run.summary?.slice(0, 300) };
        await r.set(CRON_KEY(name), JSON.stringify(entry));
        await r.lpush(CRON_HISTORY_KEY(name), JSON.stringify(entry));
        await r.ltrim(CRON_HISTORY_KEY(name), 0, HISTORY_LEN - 1);
    } catch {
        // best-effort
    }
}

/** Wraps a cron handler: records duration, success and a short summary. */
export async function withCronTelemetry<T>(name: string, fn: () => Promise<T>, summarize?: (result: T) => string): Promise<T> {
    const start = Date.now();
    try {
        const result = await fn();
        await recordCronRun(name, { ok: true, durationMs: Date.now() - start, summary: summarize?.(result) });
        return result;
    } catch (err) {
        await recordCronRun(name, { ok: false, durationMs: Date.now() - start, summary: err instanceof Error ? err.message : 'Unknown' });
        throw err;
    }
}

export async function recordWebhook(provider: string, ok: boolean, error?: string): Promise<void> {
    try {
        const r = getRedisClient();
        if (!r) return;
        const now = new Date().toISOString();
        const fields: Record<string, string> = { lastAt: now };
        if (ok) fields.lastOkAt = now;
        else {
            fields.lastErrorAt = now;
            fields.lastError = (error ?? 'error').slice(0, 200);
        }
        await r.hset(WEBHOOK_KEY(provider), fields);
    } catch {
        // best-effort
    }
}

export async function recordErrorEvent(message: string, route?: string): Promise<void> {
    try {
        const r = getRedisClient();
        if (!r) return;
        const now = new Date();
        const hourKey = ERROR_HOUR_KEY(now);
        await r.incr(hourKey);
        await r.expire(hourKey, ERROR_HOUR_TTL_S);
        const entry: RecentError = { at: now.toISOString(), message: message.slice(0, 300), ...(route ? { route } : {}) };
        await r.lpush(RECENT_ERRORS_KEY, JSON.stringify(entry));
        await r.ltrim(RECENT_ERRORS_KEY, 0, RECENT_ERRORS_LEN - 1);
    } catch {
        // best-effort
    }
}

export async function getCronRuns(names: string[]): Promise<Record<string, { last: CronRun | null; history: CronRun[] }>> {
    const out: Record<string, { last: CronRun | null; history: CronRun[] }> = {};
    const r = getRedisClient();
    for (const name of names) {
        try {
            const [last, history] = r
                ? await Promise.all([r.get(CRON_KEY(name)), r.lrange(CRON_HISTORY_KEY(name), 0, HISTORY_LEN - 1)])
                : [null, []];
            out[name] = { last: last ? JSON.parse(last) as CronRun : null, history: history.map((h) => JSON.parse(h) as CronRun) };
        } catch {
            out[name] = { last: null, history: [] };
        }
    }
    return out;
}

export async function getWebhookStatus(providers: string[]): Promise<Record<string, WebhookStatus>> {
    const out: Record<string, WebhookStatus> = {};
    const r = getRedisClient();
    for (const p of providers) {
        try {
            out[p] = r ? (await r.hgetall(WEBHOOK_KEY(p))) as WebhookStatus : {};
        } catch {
            out[p] = {};
        }
    }
    return out;
}

/** Errors per hour for the last `hours` hours (oldest first) plus the most recent error lines. */
export async function getErrorStats(hours = 24): Promise<{ perHour: Array<{ hour: string; count: number }>; recent: RecentError[] }> {
    const r = getRedisClient();
    const now = Date.now();
    const keys = Array.from({ length: hours }, (_, i) => new Date(now - (hours - 1 - i) * 3600_000));
    try {
        if (!r) return { perHour: [], recent: [] };
        const counts = await r.mget(...keys.map(ERROR_HOUR_KEY));
        const recent = await r.lrange(RECENT_ERRORS_KEY, 0, 19);
        return {
            perHour: keys.map((d, i) => ({ hour: d.toISOString().slice(0, 13), count: Number(counts[i] ?? 0) })),
            recent: recent.map((e) => JSON.parse(e) as RecentError),
        };
    } catch {
        return { perHour: [], recent: [] };
    }
}

/**
 * Wraps a cron route handler: records each real run (status < 400 = ok) with a short summary
 * taken from the JSON response. Unauthorized calls and `?dryRun=1` are not recorded.
 */
export function instrumentCron<R extends Request>(name: string, handler: (req: R) => Promise<Response>): (req: R) => Promise<Response> {
    return async (req: R) => {
        const start = Date.now();
        const res = await handler(req);
        if (res.status === 401 || new URL(req.url).searchParams.get('dryRun') === '1') return res;
        let summary: string | undefined;
        try {
            summary = JSON.stringify(await res.clone().json());
        } catch {
            summary = undefined;
        }
        await recordCronRun(name, { ok: res.status < 400, durationMs: Date.now() - start, summary });
        return res;
    };
}
