import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/data/seo-company-stats.json', () => ({
  default: {
    generatedAt: '2026-11-01',
    segments: [{ slug: 'restaurantes', name: 'Restaurantes' }, { slug: 'dentistas', name: 'Clínicas odontológicas' }],
    cities: [{ slug: 'santos-sp', name: 'Santos', uf: 'SP' }, { slug: 'sao-paulo-sp', name: 'São Paulo', uf: 'SP' }],
    pages: {
      'restaurantes-em-santos-sp': { segment: 'restaurantes', segmentName: 'Restaurantes', city: 'Santos', uf: 'SP', total: 3000, openedLast12m: 400, porte: { ME: 2500, EPP: 400, DEMAIS: 100 }, withPhonePct: 95, withEmailPct: 90, topBairros: [{ name: 'Gonzaga', count: 300 }, { name: 'Boqueirão', count: 200 }] },
      'dentistas-em-santos-sp': { segment: 'dentistas', segmentName: 'Clínicas odontológicas', city: 'Santos', uf: 'SP', total: 800, openedLast12m: 50, porte: { ME: 700, EPP: 80, DEMAIS: 20 }, withPhonePct: 97, withEmailPct: 92, topBairros: [] },
      'restaurantes-em-sao-paulo-sp': { segment: 'restaurantes', segmentName: 'Restaurantes', city: 'São Paulo', uf: 'SP', total: 75000, openedLast12m: 12000, porte: { ME: 65000, EPP: 8000, DEMAIS: 2000 }, withPhonePct: 96, withEmailPct: 94, topBairros: [] },
    },
  },
}));

import { companyLinkForLocalEntry, companyRouteMeta, getAllCompanyRouteSlugs, getCityHub, getCityHubLinks, getSegmentHub } from './seo-company-stats';
import { pageFaq } from './company-stats-text';
import { clearSeoSearchIntent, readSeoSearchIntent, saveSeoSearchIntent } from './seo-search-intent';

describe('company stats routes', () => {
  it('builds city and segment hubs with totals, biggest first', () => {
    const santos = getCityHub('em-santos-sp');
    expect(santos?.total).toBe(3800);
    expect(santos?.links.map((l) => l.slug)).toEqual(['restaurantes-em-santos-sp', 'dentistas-em-santos-sp']);
    expect(getSegmentHub('restaurantes')?.links[0]?.slug).toBe('restaurantes-em-sao-paulo-sp');
    expect(getCityHubLinks()[0]?.slug).toBe('em-sao-paulo-sp');
    expect(getAllCompanyRouteSlugs()).toEqual(expect.arrayContaining(['em-santos-sp', 'restaurantes', 'dentistas-em-santos-sp']));
  });

  it('titles match how people search', () => {
    expect(companyRouteMeta('restaurantes-em-santos-sp')?.title).toBe('Lista de Restaurantes em Santos (SP) — 3.000 empresas | Precision');
    expect(companyRouteMeta('em-santos-sp')?.title).toMatch(/^Empresas em Santos \(SP\) por segmento/);
    expect(companyRouteMeta('nao-existe')).toBeNull();
  });

  it('FAQ answers with real numbers and neighbourhoods', () => {
    const faq = pageFaq(companyRouteMetaPage());
    expect(faq[0]?.a).toContain('3.000 empresas ativas');
    expect(faq[1]?.a).toContain('Gonzaga, Boqueirão');
  });

  it('links older local pages to the matching data page or city hub', () => {
    expect(companyLinkForLocalEntry({ slug: 'prospeccao-b2b-dentistas-santos', city: 'Santos', niche: 'Dentistas' })?.href).toBe('/empresas/dentistas-em-santos-sp');
    expect(companyLinkForLocalEntry({ slug: 'geracao-de-leads-b2b-santos', city: 'Santos' })?.href).toBe('/empresas/em-santos-sp');
    expect(companyLinkForLocalEntry({ slug: 'x', city: 'Cidade Sem Dados' })).toBeNull();
  });
});

function companyRouteMetaPage() {
  return { segment: 'restaurantes', segmentName: 'Restaurantes', city: 'Santos', uf: 'SP', total: 3000, openedLast12m: 400, porte: { ME: 2500, EPP: 400, DEMAIS: 100 }, withPhonePct: 95, withEmailPct: 90, topBairros: [{ name: 'Gonzaga', count: 300 }, { name: 'Boqueirão', count: 200 }] };
}

describe('seo search intent', () => {
  beforeEach(() => localStorage.clear());

  it('remembers what the visitor came for, for 7 days', () => {
    saveSeoSearchIntent({ term: 'restaurantes', city: 'Santos', uf: 'SP' });
    expect(readSeoSearchIntent()).toEqual({ term: 'restaurantes', city: 'Santos', uf: 'SP' });
    clearSeoSearchIntent();
    expect(readSeoSearchIntent()).toBeNull();
  });

  it('expires old intents', () => {
    localStorage.setItem('precision:seo-search-intent', JSON.stringify({ term: 'x', city: 'y', uf: 'SP', savedAt: Date.now() - 8 * 24 * 3600 * 1000 }));
    expect(readSeoSearchIntent()).toBeNull();
  });
});
