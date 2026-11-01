const store = new Map<string, string>();
const client = {
    exists: jest.fn(async (k: string) => (store.has(k) ? 1 : 0)),
    set: jest.fn(async (k: string, v: string) => { store.set(k, v); return 'OK'; }),
    del: jest.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
};
jest.mock('@/lib/redis', () => ({ getRedisClient: () => client }));

import { clearCrmPushPause, isCrmPushPaused, pauseCrmPush } from '@/lib/crm-auth-pause';

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

    it('never blocks when Redis fails', async () => {
        client.exists.mockRejectedValueOnce(new Error('down'));
        expect(await isCrmPushPaused('u2', 'rdstation')).toBe(false);
    });
});
