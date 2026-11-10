import { suggestBrCities } from '@/lib/br-cities';

describe('suggestBrCities', () => {
    it('matches without accents, prefix first', () => {
        const r = suggestBrCities('SC', 'florian');
        expect(r[0]).toBe('Florianópolis');
        expect(suggestBrCities('SP', 'sao paulo')).toContain('São Paulo');
    });
    it('returns the first cities for short queries and [] for an unknown state', () => {
        expect(suggestBrCities('SC', 'a')).toHaveLength(20);
        expect(suggestBrCities('XX', 'flor')).toEqual([]);
    });
});
