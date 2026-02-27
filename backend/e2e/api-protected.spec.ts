import { test, expect } from '@playwright/test';

test.describe('Protected API E2E', () => {
  test('GET /api/export/leads without auth returns 401', async ({ request }) => {
    const res = await request.get('/api/export/leads');
    expect(res.status()).toBe(401);
  });

  test('GET /api/leads without auth returns 401', async ({ request }) => {
    const res = await request.get('/api/leads');
    expect(res.status()).toBe(401);
  });

  test('GET /api/user/me without auth returns 200 with null user', async ({ request }) => {
    const res = await request.get('/api/user/me');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
  });

  test('POST /api/competitors without auth returns 401 (or 404 if route not deployed)', async ({ request }) => {
    const res = await request.post('/api/competitors', {
      data: { textQuery: 'cafes' },
    });
    expect([401, 404]).toContain(res.status());
    if (res.status() === 401) {
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    }
  });

  test('POST /api/market-report without auth returns 401 (or 404 if route not deployed)', async ({ request }) => {
    const res = await request.post('/api/market-report', {
      data: { textQuery: 'restaurantes' },
    });
    expect([401, 404]).toContain(res.status());
    if (res.status() === 401) {
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    }
  });
});
