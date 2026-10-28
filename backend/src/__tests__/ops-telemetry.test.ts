const store = new Map<string, string>();
const lists = new Map<string, string[]>();
const fakeRedis = {
    set: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    lpush: jest.fn(async (k: string, v: string) => { lists.set(k, [v, ...(lists.get(k) ?? [])]); }),
    ltrim: jest.fn(async () => undefined),
    lrange: jest.fn(async (k: string) => lists.get(k) ?? []),
    incr: jest.fn(async (k: string) => { store.set(k, String(Number(store.get(k) ?? 0) + 1)); }),
    expire: jest.fn(async () => undefined),
    mget: jest.fn(async (...ks: string[]) => ks.map((k) => store.get(k) ?? null)),
    hset: jest.fn(async (k: string, f: Record<string, string>) => { store.set(k, JSON.stringify({ ...JSON.parse(store.get(k) ?? '{}'), ...f })); }),
    hgetall: jest.fn(async (k: string) => JSON.parse(store.get(k) ?? '{}')),
};
jest.mock('@/lib/redis', () => ({ getRedisClient: () => fakeRedis }));

import { instrumentCron, getCronRuns, recordErrorEvent, getErrorStats, recordWebhook, getWebhookStatus } from '@/lib/ops-telemetry';

beforeEach(() => { store.clear(); lists.clear(); });

describe('ops-telemetry', () => {
    it('records real cron runs with a summary, skipping unauthorized calls and dry runs', async () => {
        const ok = instrumentCron('billing-lifecycle', async () => new Response(JSON.stringify({ counts: { x: 1 } }), { status: 200 }));
        await ok(new Request('http://x/api/cron/billing-lifecycle?dryRun=1'));
        expect((await getCronRuns(['billing-lifecycle']))['billing-lifecycle']!.last).toBeNull();

        const denied = instrumentCron('billing-lifecycle', async () => new Response('{}', { status: 401 }));
        await denied(new Request('http://x/api/cron/billing-lifecycle'));
        expect((await getCronRuns(['billing-lifecycle']))['billing-lifecycle']!.last).toBeNull();

        await ok(new Request('http://x/api/cron/billing-lifecycle'));
        const runs = (await getCronRuns(['billing-lifecycle']))['billing-lifecycle']!;
        expect(runs.last).toEqual(expect.objectContaining({ ok: true, summary: '{"counts":{"x":1}}' }));
        expect(runs.history).toHaveLength(1);
    });

    it('marks failed runs', async () => {
        await instrumentCron('weekly-report', async () => new Response('{"error":"x"}', { status: 500 }))(new Request('http://x/'));
        expect((await getCronRuns(['weekly-report']))['weekly-report']!.last?.ok).toBe(false);
    });

    it('counts errors per hour and keeps the recent list', async () => {
        await recordErrorEvent('boom', '/api/search');
        await recordErrorEvent('boom 2');
        const stats = await getErrorStats(3);
        expect(stats.perHour).toHaveLength(3);
        expect(stats.perHour.at(-1)!.count).toBe(2);
        expect(stats.recent[0]).toEqual(expect.objectContaining({ message: 'boom 2' }));
    });

    it('tracks last webhook success and failure', async () => {
        await recordWebhook('mercadopago', true);
        await recordWebhook('mercadopago', false, 'invalid signature');
        const s = (await getWebhookStatus(['mercadopago'])).mercadopago!;
        expect(s.lastOkAt).toBeDefined();
        expect(s.lastError).toBe('invalid signature');
    });
});
