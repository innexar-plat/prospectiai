const mockQueryRawUnsafe = jest.fn();
const mockCnaeFindFirst = jest.fn();
jest.mock('@/lib/prisma', () => ({
    prisma: {
        $queryRawUnsafe: (...a: unknown[]) => mockQueryRawUnsafe(...a),
        cnaeCode: { findMany: jest.fn().mockResolvedValue([]), findFirst: (...a: unknown[]) => mockCnaeFindFirst(...a) },
        rfSearchConfig: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
    },
}));
jest.mock('@/lib/redis', () => ({ getCached: jest.fn().mockResolvedValue(null), setCached: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const mockGen = jest.fn();
jest.mock('@/lib/ai', () => ({
    generateCompletionForRole: (...a: unknown[]) => mockGen(...a),
    extractJsonFromLlm: (t: string) => JSON.parse(t),
}));

import { stripLocationFromQuery, inferCnaesForSearch } from '@/modules/search/application/search-rf-integration';
import { addressUf, filterByState, stripUnsupportedQualifiers } from '@/modules/search/application/search.service';

beforeEach(() => jest.clearAllMocks());

describe('stripLocationFromQuery', () => {
    it('removes city, UF and country so they never reach CNAE inference', () => {
        expect(stripLocationFromQuery('distrribuidora de salgados campo grande MS', 'campo grande', 'MS')).toBe('distrribuidora de salgados');
        expect(stripLocationFromQuery('Dentista São Paulo SP Brasil', 'São Paulo', 'SP')).toBe('dentista');
        expect(stripLocationFromQuery('restaurantes', null, 'Todos')).toBe('restaurantes');
    });
});

describe('inferCnaesForSearch', () => {
    it('never looks up CNAEs by location or generic words ("campo", "distribuidora")', async () => {
        mockQueryRawUnsafe.mockResolvedValue([]);
        mockGen.mockResolvedValue({ text: JSON.stringify({ codes: ['4637', '1091', '9999'] }) });
        mockCnaeFindFirst.mockImplementation(({ where }: { where: { code: { startsWith: string } } }) =>
            Promise.resolve(where.code.startsWith === '9999' ? null : { code: `${where.code.startsWith}101` }));

        const codes = await inferCnaesForSearch('distrribuidora de salgados campo grande MS', null, { city: 'campo grande', state: 'MS' });

        const likeTerms = mockQueryRawUnsafe.mock.calls.map((c) => c[1]);
        expect(likeTerms).not.toContain('%campo%');
        expect(likeTerms).not.toContain('%grande%');
        expect(likeTerms.some((t: string) => t.includes('salgados'))).toBe(true);
        // AI fallback answered; the invented code that does not exist was dropped.
        expect(codes).toEqual(['4637', '1091']);
        expect(mockGen.mock.calls[0][1].prompt).toContain('distrribuidora de salgados');
        expect(mockGen.mock.calls[0][1].prompt).not.toMatch(/campo grande/i);
    });
});

it('drops generic words like "distribuidora" from keyword lookups', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    mockGen.mockResolvedValue({ text: JSON.stringify({ codes: [] }) });
    await inferCnaesForSearch('distribuidora de bebidas', null, {});
    const likeTerms = mockQueryRawUnsafe.mock.calls.map((c) => c[1]);
    expect(likeTerms).not.toContain('%distribuidora%');
    expect(likeTerms).toContain('%bebidas%');
});

describe('state filter', () => {
    it('reads the UF from Google addresses', () => {
        expect(addressUf('R. Rui Barbosa, 2750 - Centro, Campo Grande - MS, 79002-365, Brasil')).toBe('MS');
        expect(addressUf('R. Firmino Moreira, 43 - Campo Grande, Rio de Janeiro - RJ, 23045-400')).toBe('RJ');
        expect(addressUf('Sem UF aqui')).toBeNull();
    });

    it('drops listings from another state and keeps those without a UF', () => {
        const places = [
            { id: 'a', formattedAddress: 'R. A, 1 - Centro, Campo Grande - MS, 79002-365' },
            { id: 'b', formattedAddress: 'R. B, 2 - Campo Grande, Rio de Janeiro - RJ, 23045-400' },
            { id: 'c', formattedAddress: 'Endereço sem estado' },
        ];
        expect(filterByState(places, 'MS').map((p) => p.id)).toEqual(['a', 'c']);
        expect(filterByState(places, 'Todos')).toHaveLength(3);
        expect(filterByState(places, null)).toHaveLength(3);
    });
});

describe('stripUnsupportedQualifiers', () => {
    it('removes size/audience qualifiers Google Maps cannot apply', () => {
        expect(stripUnsupportedQualifiers('bares e restaurantes com até 10 funcionarios Blumenau')).toBe('bares e restaurantes Blumenau');
        expect(stripUnsupportedQualifiers('consorcio para empresas Campo Grande')).toBe('consorcio Campo Grande');
        expect(stripUnsupportedQualifiers('clínicas de pequeno porte em SP')).toBe('clínicas em SP');
        expect(stripUnsupportedQualifiers('pequenas empresas de contabilidade')).toBe('de contabilidade');
        expect(stripUnsupportedQualifiers('dentista Blumenau')).toBe('dentista Blumenau');
    });
});
