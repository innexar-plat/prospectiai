import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/search/route';
import { auth } from '@/auth';
import { runSearch, SearchHttpError } from '@/modules/search';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/modules/search', () => ({
  runSearch: jest.fn(),
  SearchHttpError: class SearchHttpError extends Error {
    status: number;
    body: Record<string, unknown>;
    constructor(status: number, body: Record<string, unknown>) {
      super('Request failed');
      this.status = status;
      this.body = body;
    }
  },
}));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));

describe('V1 Search API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const { rateLimit } = await import('@/lib/ratelimit');
    (rateLimit as jest.Mock).mockResolvedValueOnce({ success: false });

    const req = new NextRequest('http://localhost/api/v1/search', {
      method: 'POST',
      body: JSON.stringify({ textQuery: 'cafes' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('returns 401 when user is not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/v1/search', {
      method: 'POST',
      body: JSON.stringify({ textQuery: 'cafes' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('delegates search to runSearch and returns response', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } });
    (runSearch as jest.Mock).mockResolvedValueOnce({ places: [{ id: 'p1', displayName: { text: 'P1' } }] });

    const req = new NextRequest('http://localhost/api/v1/search', {
      method: 'POST',
      body: JSON.stringify({ textQuery: 'cafes' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(runSearch).toHaveBeenCalled();
    expect(data.places).toHaveLength(1);
  });

  it('maps SearchHttpError to HTTP status', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } });
    (runSearch as jest.Mock).mockRejectedValueOnce(new SearchHttpError(403, { error: 'Limit reached' }));

    const req = new NextRequest('http://localhost/api/v1/search', {
      method: 'POST',
      body: JSON.stringify({ textQuery: 'cafes' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('Limit reached');
  });
});
