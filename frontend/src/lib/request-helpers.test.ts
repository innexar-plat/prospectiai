import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, API_BASE } from './request-helpers';

describe('request-helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('API_BASE is defined', () => {
    expect(API_BASE).toBeDefined();
  });

  it('request throws on !res.ok with error message from body', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });
    await expect(request('/test')).rejects.toThrow('Unauthorized');
  });

  it('request throws with HTTP status when body has no error', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    await expect(request('/test')).rejects.toThrow('HTTP');
  });

  it('request returns json on ok', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 1 }),
    });
    const out = await request<{ data: number }>('/test');
    expect(out).toEqual({ data: 1 });
  });
});
