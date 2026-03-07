import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildTextQuery, validateSearchPayload, startSearch } from './searchService';

vi.mock('./api', () => ({
  searchApi: {
    search: vi.fn(),
  },
}));

const searchApi = (await import('./api')).searchApi as unknown as { search: ReturnType<typeof vi.fn> };

describe('searchService', () => {
  beforeEach(() => {
    vi.mocked(searchApi.search).mockReset();
  });

  describe('buildTextQuery', () => {
    it('uses advancedTerm when at least 3 chars', () => {
      const q = buildTextQuery({
        advancedTerm: '  cafes especiais  ',
        country: 'BR',
        niches: [],
      });
      expect(q).toBe('cafes especiais');
    });

    it('uses includedType label when provided', () => {
      const q = buildTextQuery({
        includedType: 'restaurant',
        city: 'BH',
        state: 'MG',
        country: 'Brasil',
        niches: [],
      });
      expect(q).toContain('BH');
      expect(q).toContain('MG');
      expect(q).toContain('Brasil');
    });

    it('uses first niche when no includedType', () => {
      const q = buildTextQuery({
        niches: ['restaurantes'],
        city: 'SP',
        country: 'BR',
      });
      expect(q).toContain('restaurantes');
      expect(q).toContain('SP');
    });

    it('defaults to empresas when no type or niche', () => {
      const q = buildTextQuery({
        city: 'RJ',
        country: 'Brasil',
        niches: [],
      });
      expect(q).toContain('empresas');
      expect(q).toContain('RJ');
    });
  });

  describe('validateSearchPayload', () => {
    it('returns ok false when query too short', () => {
      const r = validateSearchPayload({
        country: 'BR',
        niches: [],
        city: '',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toContain('mín. 3 caracteres');
    });

    it('returns ok true when has type or niches', () => {
      const r = validateSearchPayload({
        country: 'Brasil',
        state: 'MG',
        city: 'BH',
        niches: ['restaurantes'],
      });
      expect(r.ok).toBe(true);
    });

    it('returns ok false when no type, no niches, short advancedTerm', () => {
      const r = validateSearchPayload({
        country: 'BR',
        niches: [],
        advancedTerm: 'ab',
      });
      expect(r.ok).toBe(false);
    });
  });

  describe('startSearch', () => {
    it('throws when validation fails', async () => {
      await expect(
        startSearch({ country: 'BR', niches: [], city: '' })
      ).rejects.toThrow('mín. 3 caracteres');
      expect(searchApi.search).not.toHaveBeenCalled();
    });

    it('calls searchApi and returns places', async () => {
      vi.mocked(searchApi.search).mockResolvedValue({
        places: [{ id: 'p1', displayName: { text: 'Place' } }],
        nextPageToken: undefined,
      });
      const result = await startSearch({
        country: 'Brasil',
        city: 'BH',
        niches: ['cafes'],
      });
      expect(result.places).toHaveLength(1);
      expect(searchApi.search).toHaveBeenCalledWith(
        expect.objectContaining({
          textQuery: expect.any(String),
          city: 'BH',
        })
      );
    });
  });
});
