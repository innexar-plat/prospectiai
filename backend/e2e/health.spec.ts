import { test, expect } from '@playwright/test';

test('GET /api/health returns 200 and status ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBe(true);
  expect(await res.json()).toMatchObject({ status: 'ok' });
});
