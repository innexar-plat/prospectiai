import { test, expect } from '@playwright/test';

test.describe('Auth API E2E', () => {
  test('GET /api/auth/session returns 200 (unauthenticated)', async ({ request }) => {
    const res = await request.get('/api/auth/session');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('user');
    expect(body.user).toBeNull();
  });

  test('POST /api/auth/forgot-password with invalid email returns 200 or 429 (no leak)', async ({ request }) => {
    const res = await request.post('/api/auth/forgot-password', {
      data: { email: 'nonexistent@example.com' },
    });
    expect([200, 429]).toContain(res.status());
    const body = await res.json();
    if (res.status() === 200) {
      expect(body.message).toMatch(/reset link has been sent/i);
    } else {
      expect(body.error).toMatch(/too many|requests/i);
    }
  });

  test('POST /api/auth/register validation returns 400 or 429 (rate limit)', async ({ request }) => {
    const res = await request.post('/api/auth/register', {
      data: { email: 'invalid', password: 'short' },
    });
    expect([400, 429]).toContain(res.status());
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
