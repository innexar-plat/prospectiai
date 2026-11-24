const store = new Map<string, string>();
const client = {
    exists: jest.fn(async (k: string) => (store.has(k) ? 1 : 0)),
    set: jest.fn(async (k: string, v: string) => { store.set(k, v); return 'OK'; }),
    del: jest.fn(async (...keys: string[]) => keys.filter((k) => store.delete(k)).length),
    incr: jest.fn(async (k: string) => { const n = Number(store.get(k) ?? 0) + 1; store.set(k, String(n)); return n; }),
    expire: jest.fn(async () => 1),
};
jest.mock('@/lib/redis', () => ({ getRedisClient: () => client }));

import { clearCrmPushPause, isCrmPushPaused, pauseCrmPush, pauseHoursForStrike } from '@/lib/crm-auth-pause';

beforeEach(() => { store.clear(); jest.clearAllMocks(); });

describe('crm auth pause', () => {
    it('pauses per owner and provider until cleared by a reconnect', async () => {
        expect(await isCrmPushPaused('u1', 'rdstation')).toBe(false);
        await pauseCrmPush('u1', 'rdstation');
        expect(client.set).toHaveBeenCalledWith('crm-auth-paused:u1:rdstation', '1', 'EX', 6 * 3600);
        expect(await isCrmPushPaused('u1', 'rdstation')).toBe(true);
        expect(await isCrmPushPaused('u1', 'hubspot')).toBe(false);
        await clearCrmPushPause('u1', 'rdstation');
        expect(await isCrmPushPaused('u1', 'rdstation')).toBe(false);
    });

    it('backs off on repeated failures and a reconnect resets it', async () => {
        expect([1, 2, 3, 4, 5, 9].map(pauseHoursForStrike)).toEqual([6, 12, 24, 48, 72, 72]);
        expect(await pauseCrmPush('u1', 'rdstation')).toBe(6);
        expect(await pauseCrmPush('u1', 'rdstation')).toBe(12);
        expect(await pauseCrmPush('u1', 'rdstation')).toBe(24);
        await clearCrmPushPause('u1', 'rdstation');
        expect(await pauseCrmPush('u1', 'rdstation')).toBe(6);
    });

    it('never blocks when Redis fails', async () => {
        client.exists.mockRejectedValueOnce(new Error('down'));
        expect(await isCrmPushPaused('u2', 'rdstation')).toBe(false);
    });
});
