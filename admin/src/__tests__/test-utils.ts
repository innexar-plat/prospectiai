import { vi } from 'vitest';

export type MockFetchResponse =
  | { ok: true; data: unknown }
  | { ok: false; status?: number; data?: unknown };

export function createMockFetch(responses: MockFetchResponse[] = []) {
  const queue = [...responses];
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    void url;
    void init;
    const next = queue.shift();
    if (!next) {
      return Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'No mock',
        json: () => Promise.resolve({ error: 'No mock response' }),
      } as Response);
    }
    if (next.ok) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(next.data),
      } as Response);
    }
    return Promise.resolve({
      ok: false,
      status: next.status ?? 400,
      statusText: 'Error',
      json: () => Promise.resolve(next.data ?? { error: 'Error' }),
    } as Response);
  });
}
