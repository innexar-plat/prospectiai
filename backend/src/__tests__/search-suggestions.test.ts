jest.mock('@/lib/redis', () => ({ getCached: jest.fn().mockResolvedValue(null), setCached: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));
const mockGen = jest.fn();
jest.mock('@/lib/ai', () => ({
    generateCompletionForRole: (...a: unknown[]) => mockGen(...a),
    extractJsonFromLlm: (t: string) => JSON.parse(t),
}));
import { suggestSearchTerms, heuristicSuggestions } from '@/lib/search-suggestions';

describe('search suggestions', () => {
    it('returns sanitized, deduplicated AI terms (max 4)', async () => {
        mockGen.mockResolvedValue({ text: JSON.stringify({ terms: ['Clínicas odontológicas', 'clinicas odontologicas', 'Academias!', 'Restaurantes', 'Bares', 'Hotéis'] }) });
        expect(await suggestSearchTerms({ productService: 'software', targetAudience: 'pequenos negócios' }))
            .toEqual(['Clínicas odontológicas', 'Academias', 'Restaurantes', 'Bares']);
    });

    it('falls back to splitting the target audience when AI fails', async () => {
        mockGen.mockRejectedValue(new Error('down'));
        expect(await suggestSearchTerms({ targetAudience: 'dentistas, academias e pequenas empresas de contabilidade' }))
            .toEqual(['dentistas', 'academias', 'contabilidade']);
    });

    it('returns nothing without a profile', async () => {
        expect(await suggestSearchTerms({})).toEqual([]);
        expect(heuristicSuggestions({ targetAudience: '' })).toEqual([]);
    });
});
