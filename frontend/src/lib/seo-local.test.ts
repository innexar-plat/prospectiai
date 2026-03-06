import { describe, it, expect } from 'vitest';
import {
  slugCidade,
  slugCidadeNicho,
  slugBairro,
  getWave1Slugs,
  getSeoTitle,
  getSeoDescription,
  getSeoEntryBySlug,
  getAllSeoSlugs,
  getSeoIntro,
  getSeoLocalBlock,
  getSeoFaq,
  getRelatedSeoSlugs,
} from './seo-local';

describe('seo-local', () => {
  describe('slugCidade', () => {
    it('returns base plus city slug', () => {
      expect(slugCidade('praia-grande')).toBe('geracao-de-leads-b2b-praia-grande');
    });
  });

  describe('slugCidadeNicho', () => {
    it('returns base plus niche and city', () => {
      expect(slugCidadeNicho('dentistas', 'santos')).toBe('prospeccao-b2b-dentistas-santos');
    });
  });

  describe('slugBairro', () => {
    it('returns bairro base plus slug', () => {
      expect(slugBairro('vila-mariana')).toBe('lista-de-empresas-por-bairro-vila-mariana');
    });
  });

  describe('getWave1Slugs', () => {
    it('returns entries for cities and city-nicho', () => {
      const list = getWave1Slugs();
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]).toMatchObject({ type: 'cidade', city: expect.any(String) });
      const cidadeNicho = list.find((e) => e.type === 'cidade-nicho');
      expect(cidadeNicho).toMatchObject({ type: 'cidade-nicho', city: expect.any(String), niche: expect.any(String) });
    });
  });

  describe('getSeoTitle', () => {
    it('returns city title for type cidade', () => {
      const t = getSeoTitle({ slug: 'x', type: 'cidade', city: 'Praia Grande' });
      expect(t).toContain('Praia Grande');
      expect(t).toContain('Innexar');
    });

    it('returns niche and city for type cidade-nicho', () => {
      const t = getSeoTitle({ slug: 'x', type: 'cidade-nicho', city: 'Santos', niche: 'Dentistas' });
      expect(t).toContain('Dentistas');
      expect(t).toContain('Santos');
    });

    it('returns neighborhood for type bairro', () => {
      const t = getSeoTitle({ slug: 'x', type: 'bairro', neighborhood: 'Vila Mariana' });
      expect(t).toContain('Vila Mariana');
    });

    it('returns default title when type has no city/neighborhood', () => {
      const t = getSeoTitle({ slug: 'x', type: 'cidade' });
      expect(t).toContain('Geração de Leads B2B');
      expect(t).toContain('Innexar');
    });
  });

  describe('getSeoDescription', () => {
    it('returns description for cidade', () => {
      const d = getSeoDescription({ slug: 'x', type: 'cidade', city: 'BH' });
      expect(d).toContain('BH');
    });

    it('returns description for cidade-nicho', () => {
      const d = getSeoDescription({ slug: 'x', type: 'cidade-nicho', city: 'SP', niche: 'Dentistas' });
      expect(d).toContain('Dentistas');
      expect(d).toContain('SP');
    });

    it('returns description for bairro', () => {
      const d = getSeoDescription({ slug: 'x', type: 'bairro', neighborhood: 'Vila Mariana' });
      expect(d).toContain('Vila Mariana');
    });

    it('returns default when type has no city/neighborhood', () => {
      const d = getSeoDescription({ slug: 'x', type: 'cidade' });
      expect(d).toContain('Plataforma B2B');
    });
  });

  describe('getSeoEntryBySlug', () => {
    it('returns entry when slug exists in wave1', () => {
      const slug = slugCidade('praia-grande');
      const entry = getSeoEntryBySlug(slug);
      expect(entry).not.toBeNull();
      expect(entry?.slug).toBe(slug);
    });

    it('returns null for unknown slug', () => {
      expect(getSeoEntryBySlug('unknown-slug-xyz')).toBeNull();
    });
  });

  describe('getAllSeoSlugs', () => {
    it('returns all slugs from wave1', () => {
      const slugs = getAllSeoSlugs();
      expect(slugs.length).toBeGreaterThan(0);
      expect(slugs).toContain(slugCidade('praia-grande'));
    });
  });

  describe('getSeoIntro', () => {
    it('returns intro paragraphs for cidade', () => {
      const intro = getSeoIntro({ slug: 'x', type: 'cidade', city: 'SP' });
      expect(Array.isArray(intro)).toBe(true);
      expect(intro.length).toBeGreaterThan(0);
      expect(intro[0]).toContain('SP');
    });

    it('returns intro for bairro', () => {
      const intro = getSeoIntro({ slug: 'x', type: 'bairro', neighborhood: 'Moema' });
      expect(intro.length).toBeGreaterThan(0);
      expect(intro[0]).toContain('Moema');
    });

    it('returns default intro when type has no city/neighborhood', () => {
      const intro = getSeoIntro({ slug: 'x', type: 'cidade' });
      expect(intro.length).toBe(1);
      expect(intro[0]).toContain('ProspectorAI');
    });
  });

  describe('getSeoLocalBlock', () => {
    it('returns local block for cidade', () => {
      const block = getSeoLocalBlock({ slug: 'x', type: 'cidade', city: 'Santos' });
      expect(Array.isArray(block)).toBe(true);
      expect(block[0]).toContain('Santos');
    });

    it('returns local block for cidade-nicho', () => {
      const block = getSeoLocalBlock({ slug: 'x', type: 'cidade-nicho', city: 'RJ', niche: 'Clinicas' });
      expect(Array.isArray(block)).toBe(true);
      expect(block[0]).toContain('RJ');
      expect(block[0]).toContain('Clinicas');
    });

    it('returns local block for bairro', () => {
      const block = getSeoLocalBlock({ slug: 'x', type: 'bairro', neighborhood: 'Pinheiros' });
      expect(block[0]).toContain('Pinheiros');
    });

    it('returns empty array for unknown type or missing fields', () => {
      const block = getSeoLocalBlock({ slug: 'x', type: 'cidade' });
      expect(block).toEqual([]);
    });
  });

  describe('getSeoFaq', () => {
    it('returns FAQ for cidade', () => {
      const faq = getSeoFaq({ slug: 'x', type: 'cidade', city: 'Curitiba' });
      expect(faq.length).toBeGreaterThan(0);
      expect(faq[0]).toHaveProperty('question');
      expect(faq[0]).toHaveProperty('answer');
      expect(faq[0].question).toContain('Curitiba');
    });

    it('returns FAQ for cidade-nicho', () => {
      const faq = getSeoFaq({ slug: 'x', type: 'cidade-nicho', city: 'BH', niche: 'Contadores' });
      expect(faq.length).toBeGreaterThan(0);
      expect(faq[0].question).toContain('Contadores');
      expect(faq[0].question).toContain('BH');
    });

    it('returns FAQ for bairro', () => {
      const faq = getSeoFaq({ slug: 'x', type: 'bairro', neighborhood: 'Jardins' });
      expect(faq.length).toBeGreaterThan(0);
      expect(faq[0].question).toContain('Jardins');
    });

    it('returns empty array when type has no city/neighborhood', () => {
      const faq = getSeoFaq({ slug: 'x', type: 'cidade' });
      expect(faq).toEqual([]);
    });
  });

  describe('getRelatedSeoSlugs', () => {
    it('returns related slugs for cidade entry', () => {
      const entry = getSeoEntryBySlug(slugCidade('praia-grande'));
      expect(entry).not.toBeNull();
      const related = getRelatedSeoSlugs(entry!, 3);
      expect(related.length).toBeLessThanOrEqual(3);
      expect(related.every((e) => e.slug !== entry!.slug)).toBe(true);
    });

    it('returns related slugs for cidade-nicho entry', () => {
      const slug = slugCidadeNicho('dentistas', 'santos');
      const entry = getSeoEntryBySlug(slug);
      expect(entry).not.toBeNull();
      const related = getRelatedSeoSlugs(entry!, 4);
      expect(related.length).toBeLessThanOrEqual(4);
    });

    it('respects limit', () => {
      const entry = getSeoEntryBySlug(slugCidade('praia-grande'));
      const related = getRelatedSeoSlugs(entry!, 2);
      expect(related.length).toBeLessThanOrEqual(2);
    });
  });
});
