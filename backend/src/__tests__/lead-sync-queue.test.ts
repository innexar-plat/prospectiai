import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('@/lib/db-sync', () => ({
  syncLeads: jest.fn().mockResolvedValue([]),
}));

describe('lead-sync-queue', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.LEAD_SYNC_QUEUE_CONCURRENCY = '1';
    process.env.LEAD_SYNC_QUEUE_MAX_SIZE = '10';
  });

  it('enqueues and processes lead sync asynchronously', async () => {
    const { enqueueLeadSync } = await import('@/lib/lead-sync-queue');
    const { syncLeads } = await import('@/lib/db-sync');

    enqueueLeadSync([{ id: 'p1', displayName: { text: 'P1', languageCode: 'pt-BR' } } as any]);

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(syncLeads).toHaveBeenCalledTimes(1);
  });
});
