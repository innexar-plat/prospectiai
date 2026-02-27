import { test, expect } from '@playwright/test';

test.describe('API E2E', () => {
  test('GET /api/health returns 200 and status ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok' });
  });
});
