import { describe, expect, it, jest } from '@jest/globals';
import { computeBackoffDelayMs, fetchWithRetry } from '@/lib/fetch-http';

describe('fetch-http', () => {
  it('computeBackoffDelayMs applies bounded jitter', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const low = computeBackoffDelayMs(2, 1000);
    expect(low).toBe(3000); // 4000 * 0.75

    randomSpy.mockReturnValue(1);
    const high = computeBackoffDelayMs(2, 1000);
    expect(high).toBe(5000); // 4000 * 1.25

    randomSpy.mockRestore();
  });

  it('retries on 5xx and returns final success', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce(new Response('err', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const response = await fetchWithRetry('https://example.com', { method: 'GET' }, { maxRetries: 2, initialBackoffMs: 1 });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });
});
