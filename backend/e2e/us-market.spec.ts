import { test, expect, type BrowserContext } from '@playwright/test';

/** Headers that simulate requests from the US production domain. */
const US_API_HEADERS: Record<string, string> = {
  'X-Prospector-Market': 'US',
  host: 'precisionai.innexar.app',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function seedUsMarketCookie(context: BrowserContext, baseURL: string | undefined): Promise<void> {
  const origin = baseURL ?? 'http://localhost:5173';
  const { hostname } = new URL(origin);
  await context.addCookies([
    {
      name: 'prospector-market',
      value: 'US',
      domain: hostname,
      path: '/',
    },
  ]);
}

test.describe('US market API E2E', () => {
  test('POST /api/auth/register validation with US headers returns 400 or 429', async ({ request }) => {
    const res = await request.post('/api/auth/register', {
      headers: US_API_HEADERS,
      data: { email: 'invalid', password: 'short' },
    });
    expect([400, 429]).toContain(res.status());
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test('POST /api/auth/forgot-password with US headers returns English message on 200', async ({ request }) => {
    const res = await request.post('/api/auth/forgot-password', {
      headers: US_API_HEADERS,
      data: { email: 'nonexistent-us-e2e@example.com' },
    });
    expect([200, 429]).toContain(res.status());
    const body = await res.json();
    if (res.status() === 200) {
      expect(body.message).toMatch(/reset link has been sent/i);
    } else {
      expect(body.error).toMatch(/too many|requests/i);
    }
  });

  test('GET /api/auth/session accepts US host header', async ({ request }) => {
    const res = await request.get('/api/auth/session', { headers: US_API_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('user');
    expect(body.user).toBeNull();
  });
});

test.describe('US market frontend smoke', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await seedUsMarketCookie(context, baseURL);
  });

  test('landing loads US conversion hero in English', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('qualify leads with AI')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Get started — from \$19\/mo/i })).toBeVisible();
  });

  test('signup page renders English copy and USD starter note', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Starter $19/mo · 50 credits to get started.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get started — $19/mo' })).toBeVisible();
  });

  test('pricing page shows USD plan labels', async ({ page }) => {
    await page.goto('/en/pricing');
    await expect(page.getByRole('heading', { name: 'Plans and pricing' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('$19', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('$49', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Prices in USD. Secure checkout via Stripe.')).toBeVisible();
  });
});
