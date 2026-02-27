import { test, expect } from '@playwright/test';

/**
 * E2E: todas as rotas do frontend devem retornar 200 e o HTML do SPA (index.html).
 * Usa request (sem browser) para garantir que o servidor faz SPA fallback.
 * baseURL = frontend (ex.: http://localhost:5173).
 */
test.describe('Frontend routes E2E', () => {
  const routes = [
    '/',
    '/privacy',
    '/terms',
    '/auth/signin',
    '/auth/signup',
    '/dashboard',
    '/dashboard/historico',
    '/dashboard/leads',
    '/dashboard/resultados',
    '/dashboard/listas',
    '/dashboard/relatorios',
    '/geracao-de-leads-b2b-praia-grande',
    '/prospeccao-b2b-dentistas-santos',
  ];

  for (const path of routes) {
    test(`GET ${path || '/'} returns 200 and SPA HTML`, async ({ request }) => {
      const res = await request.get(path || '/');
      expect(res.status(), `Route ${path || '/'} should return 200`).toBe(200);
      const text = await res.text();
      expect(text).toContain('root');
      expect(text).toMatch(/<html|<!doctype html/i);
    });
  }

  test('GET unknown path returns 200 and SPA HTML (fallback)', async ({ request }) => {
    const res = await request.get('/qualquer-rota-inexistente');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('root');
  });
});
