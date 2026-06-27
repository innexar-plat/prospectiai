import { describe, it, expect } from 'vitest';
import {
  BR_ORIGIN,
  US_ORIGIN,
  buildSitemapXml,
  getBrIndexableRoutes,
  getBrLocalSeoPaths,
  getIndexableRoutesForMarket,
  getUsIndexableRoutes,
  routeToUrl,
} from './sitemap-routes';
import { getAllSeoSlugs } from './seo-local';

describe('sitemap-routes', () => {
  it('US routes use precisionai.innexar.app origin only', () => {
    const routes = getUsIndexableRoutes();
    const xml = buildSitemapXml(US_ORIGIN, routes);
    expect(xml).toContain(`<loc>${US_ORIGIN}/</loc>`);
    expect(xml).toContain(`<loc>${US_ORIGIN}/en/pricing</loc>`);
    expect(xml).not.toContain('precisionia.com.br');
    expect(xml).not.toContain('geracao-de-leads-b2b');
    expect(xml).not.toContain('/blog/');
  });

  it('BR routes include blog and local SEO slugs', () => {
    const routes = getBrIndexableRoutes();
    const paths = routes.map((r) => r.path);
    expect(paths).toContain('blog');
    expect(paths).toContain('mapa-do-site');
    expect(paths).toContain('geracao-de-leads-b2b-sao-paulo');
    expect(paths).toContain('prospeccao-b2b-dentistas-santos');
    expect(getBrLocalSeoPaths()).toEqual(getAllSeoSlugs());
  });

  it('US funnel is smaller than BR and excludes BR-only integrations', () => {
    const us = getUsIndexableRoutes();
    const br = getBrIndexableRoutes();
    expect(us.length).toBeLessThan(br.length);
    const usPaths = us.map((r) => r.path);
    expect(usPaths).not.toContain('integracoes/rdstation');
    expect(usPaths).not.toContain('integracoes/agendor');
    expect(usPaths).toContain('integracoes/hubspot');
    expect(usPaths).toContain('pricing');
  });

  it('getIndexableRoutesForMarket selects by market', () => {
    expect(getIndexableRoutesForMarket('US')[0].title).toMatch(/B2B Lead Generation/i);
    expect(getIndexableRoutesForMarket('BR')[0].title).toMatch(/Encontrar Empresas/i);
  });

  it('routeToUrl builds canonical paths', () => {
    const home = getUsIndexableRoutes()[0];
    expect(routeToUrl(US_ORIGIN, home)).toBe(`${US_ORIGIN}/`);
    const pricing = getUsIndexableRoutes().find((r) => r.path === 'pricing');
    expect(routeToUrl(US_ORIGIN, pricing!)).toBe(`${US_ORIGIN}/pricing`);
  });

  it('buildSitemapXml is valid urlset with lastmod', () => {
    const xml = buildSitemapXml(BR_ORIGIN, getBrIndexableRoutes().slice(0, 1), '2026-06-27');
    expect(xml).toMatch(/^<\?xml version="1.0"/);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<lastmod>2026-06-27</lastmod>');
    expect(xml).toContain('</urlset>');
  });
});
