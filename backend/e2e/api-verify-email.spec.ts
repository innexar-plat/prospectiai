import { test, expect } from '@playwright/test';

test.describe('Verify email API E2E', () => {
  test('GET /api/auth/verify-email without token returns 400', async ({ request }) => {
    const res = await request.get('/api/auth/verify-email');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/token/i);
  });

  test('GET /api/auth/verify-email with invalid token returns 400', async ({ request }) => {
    const res = await request.get('/api/auth/verify-email?token=invalid-token-123');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid|expired/i);
  });
});
