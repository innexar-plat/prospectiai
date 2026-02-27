import { test, expect } from '@playwright/test';

test.describe('Export API E2E', () => {
  test('GET /api/export/leads?format=json without auth returns 401', async ({ request }) => {
    const res = await request.get('/api/export/leads?format=json');
    expect(res.status()).toBe(401);
  });

  test('GET /api/export/leads?format=invalid without auth returns 401 (auth before validation)', async ({ request }) => {
    const res = await request.get('/api/export/leads?format=xml');
    expect(res.status()).toBe(401);
  });
});
