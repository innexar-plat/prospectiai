import { parseSearchIntent } from '@/lib/search-intent';

describe('parseSearchIntent', () => {
    it('splits niche, city and state', () => {
        expect(parseSearchIntent('lojas de eletrônicos em Florianópolis SC')).toMatchObject({ term: 'lojas de eletrônicos', city: 'Florianópolis', state: 'SC', understood: true });
        expect(parseSearchIntent('Clínicas de estética, Sorocaba/SP')).toMatchObject({ term: 'Clínicas de estética', city: 'Sorocaba', state: 'SP' });
        expect(parseSearchIntent('padaria em sao paulo')).toMatchObject({ term: 'padaria', city: 'São Paulo', state: 'SP' });
    });
    it('understands a whole state (the case that confused our first paying customer)', () => {
        expect(parseSearchIntent('loja de eletrônicos em Santa Catarina')).toMatchObject({ term: 'loja de eletrônicos', city: null, state: 'SC' });
        expect(parseSearchIntent('construtoras no Rio Grande do Sul')).toMatchObject({ term: 'construtoras', state: 'RS' });
    });
    it('uses the preferred state for ambiguous city names and lists the others', () => {
        const r = parseSearchIntent('mercados em Bom Jesus', 'PI');
        expect(r.state).toBe('PI');
        expect(r.otherStates.length).toBeGreaterThan(0);
    });
    it('does not mistake common words for places', () => {
        expect(parseSearchIntent('restaurantes se possível').understood).toBe(false);
        expect(parseSearchIntent('agência de marketing').understood).toBe(false);
        expect(parseSearchIntent('pet shop').understood).toBe(false);
    });
    it('drops a city that does not belong to the given state', () => {
        expect(parseSearchIntent('academias em Campinas RJ')).toMatchObject({ city: null, state: 'RJ', term: 'academias' });
    });
});
