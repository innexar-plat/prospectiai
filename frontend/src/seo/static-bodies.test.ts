import { describe, it, expect } from 'vitest';
import { buildBrStaticBodies, localLandingForCompanyPage, wrapStaticBody } from './static-bodies';
import { getWave1Slugs } from '@/lib/seo-local';
import { BLOG_POSTS } from '@/pages/blog/blogData';

describe('static SEO bodies', () => {
  const bodies = buildBrStaticBodies();

  it('covers every public page with exactly one H1 and internal links', () => {
    const expected = ['', 'pricing', 'blog', 'mapa-do-site', 'privacy', 'terms', 'integracoes/rdstation', 'integracoes/agendor', 'integracoes/hubspot',
      ...BLOG_POSTS.map((p) => `blog/${p.slug}`), ...getWave1Slugs().map((e) => e.slug)];
    for (const path of expected) {
      const html = bodies[path];
      expect(html, path).toBeTruthy();
      expect(html!.match(/<h1>/g), path).toHaveLength(1);
      expect((html!.match(/<a href="\//g) ?? []).length, path).toBeGreaterThan(10);
    }
  });

  it('uses accented place names and the real Starter price', () => {
    expect(bodies['prospeccao-b2b-dentistas-sao-paulo']).toContain('Prospecção B2B para Dentistas em São Paulo');
    expect(bodies['prospeccao-b2b-dentistas-sao-paulo']).toContain('href="/empresas/dentistas-em-sao-paulo-sp"');
    expect(bodies['']).toContain('R$ 99/mês');
    expect(bodies['']).not.toMatch(/R\$ 97|\$19/);
  });

  it('renders blog articles and FAQ structured data', () => {
    expect(bodies['blog/como-encontrar-empresas-para-vender']).toContain('Perfil de Cliente Ideal');
    expect(bodies['']).toContain('"@type":"FAQPage"');
  });

  it('links data pages back to the local landings', () => {
    expect(localLandingForCompanyPage('dentistas', 'santos-sp')).toEqual({ href: '/prospeccao-b2b-dentistas-santos', label: 'Como prospectar clínicas odontológicas em Santos' });
    expect(localLandingForCompanyPage('padarias', 'campinas-sp')?.href).toBe('/geracao-de-leads-b2b-campinas');
    expect(localLandingForCompanyPage('padarias', 'goiania-go')).toBeNull();
    expect(wrapStaticBody('<h1>X</h1>')).toMatch(/<nav[\s\S]*<h1>X<\/h1>[\s\S]*<footer>/);
  });
});
