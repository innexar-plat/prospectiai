import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    searchHistory: {
      create: jest.fn().mockResolvedValue({ id: 'sh1' }),
    },
  },
}));

describe('search-history-queue', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.SEARCH_HISTORY_QUEUE_CONCURRENCY = '1';
    process.env.SEARCH_HISTORY_QUEUE_MAX_SIZE = '10';
  });

  it('enqueues and persists history asynchronously', async () => {
    const { enqueueSearchHistoryWrite } = await import('@/lib/search-history-queue');
    const { prisma } = await import('@/lib/prisma');

    enqueueSearchHistoryWrite({
      workspaceId: 'w1',
      userId: 'u1',
      textQuery: 'cafes',
      pageSize: 20,
      filters: { includedType: null, hasWebsite: null, hasPhone: null },
      resultsCount: 3,
      resultsData: [{ id: 'p1' }],
      city: 'Sao Paulo',
      state: 'SP',
      country: 'Brasil',
    });

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.searchHistory.create).toHaveBeenCalledTimes(1);
  });
});
