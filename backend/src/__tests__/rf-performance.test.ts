const mockTx = { $executeRawUnsafe: jest.fn().mockResolvedValue(0), $queryRawUnsafe: jest.fn() };
jest.mock('@/lib/prisma', () => ({
    prisma: {
        $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(mockTx)),
        $queryRaw: jest.fn().mockResolvedValue([{ n: 27133836 }]),
    },
}));

import { toRfText, splitBrPhone, fuzzyMatchRfCompany } from '@/lib/rf-fuzzy-match';
import { buildRfWhere, searchRfCompanies, estimateRfCompanyCount, RF_COUNT_CAP } from '@/lib/rf-query';

const row = (o: Record<string, unknown> = {}) => ({
    cnpj: '1', razaoSocial: 'PADARIA SAO JOSE LTDA', nomeFantasia: 'PADARIA SAO JOSE', municipio: 'SAO PAULO',
    logradouro: null, numero: '10', email: null, ddd: '11', telefone: '33334444', porte: 'ME', capitalSocial: 1000,
    cnaePrincipal: '1091101', dataAbertura: null, ...o,
});

beforeEach(() => { jest.clearAllMocks(); mockTx.$executeRawUnsafe.mockResolvedValue(0); });

describe('RF text helpers', () => {
    it('normalizes like the Receita base (uppercase, no accents)', () => {
        expect(toRfText(' São José dos Pinhais ')).toBe('SAO JOSE DOS PINHAIS');
    });
    it('splits Brazilian phones into ddd + number', () => {
        expect(splitBrPhone('(47) 3322-1100')).toEqual({ ddd: '47', number: '33221100' });
        expect(splitBrPhone('+55 11 99911-2233')).toEqual({ ddd: '11', number: '999112233' });
        expect(splitBrPhone('3322-1100')).toBeNull();
        expect(splitBrPhone(null)).toBeNull();
    });
});

describe('fuzzyMatchRfCompany', () => {
    it('matches by phone first, without any name/trigram query', async () => {
        mockTx.$queryRawUnsafe.mockResolvedValueOnce([row()]);
        const r = await fuzzyMatchRfCompany('Padaria São José', 'R. A, 10 - Centro, São Paulo - SP, 01000-000, Brasil', '(11) 3333-4444');
        expect(r?.matchMethod).toBe('phone_exact');
        expect(mockTx.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        expect(mockTx.$queryRawUnsafe.mock.calls[0][0]).toContain('ddd = $1 AND telefone = $2');
    });

    it('runs bounded, index-friendly queries with the accent-free city', async () => {
        mockTx.$queryRawUnsafe.mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...row(), sim: 0.8 }]);
        const r = await fuzzyMatchRfCompany('Padaria São José', 'R. A, 10 - Centro, São Paulo - SP, 01000-000, Brasil');
        expect(r?.matchMethod).toBe('name_fuzzy_city_address');
        const [exactSql, exactParams] = [mockTx.$queryRawUnsafe.mock.calls[0][0], mockTx.$queryRawUnsafe.mock.calls[0].slice(1)];
        expect(exactSql).toContain('municipio = $1');
        expect(exactParams).toEqual(['SAO PAULO', 'PADARIA SAO JOSE']);
        expect(mockTx.$queryRawUnsafe.mock.calls[1][0]).toContain('upper("nomeFantasia") % $2');
        const settings = mockTx.$executeRawUnsafe.mock.calls.map((c) => c[0]);
        expect(settings).toEqual(expect.arrayContaining([
            expect.stringContaining('statement_timeout'),
            'SET LOCAL max_parallel_workers_per_gather = 0',
            'SET LOCAL jit = off',
        ]));
    });

    it('returns null instead of failing when a lookup times out', async () => {
        mockTx.$queryRawUnsafe.mockRejectedValue(new Error('canceling statement due to statement timeout'));
        await expect(fuzzyMatchRfCompany('Padaria', 'R. A, 10 - Centro, São Paulo - SP, 01000-000, Brasil')).resolves.toBeNull();
    });
});

describe('rf-query', () => {
    it('builds indexed predicates: CNAE prefix as range, exact city, trigram-friendly name', () => {
        const { sql, params } = buildRfWhere({ cnaes: ['5611', '8630506'], uf: 'sp', municipio: 'São Paulo', porte: 'me', razaoSocial: 'padaria' });
        expect(sql).toBe('(("cnaePrincipal" >= $1 AND "cnaePrincipal" < $2) OR "cnaePrincipal" = $3) AND uf = $4 AND municipio = $5 AND porte = $6 AND upper("razaoSocial") LIKE $7');
        expect(params).toEqual(['5611', '5612', '8630506', 'SP', 'SAO PAULO', 'ME', '%PADARIA%']);
        expect(sql).not.toMatch(/ILIKE|ORDER BY/);
    });

    it('caps the count and flags when there are more results', async () => {
        mockTx.$queryRawUnsafe.mockResolvedValueOnce([row()]).mockResolvedValueOnce([{ n: BigInt(RF_COUNT_CAP + 1) }]);
        const r = await searchRfCompanies({ cnaes: ['5611'], uf: 'SP' }, 1, 20);
        expect(r).toEqual(expect.objectContaining({ total: RF_COUNT_CAP, capped: true }));
        expect(mockTx.$queryRawUnsafe.mock.calls[1][0]).toContain(`LIMIT ${RF_COUNT_CAP + 1}`);
    });

    it('still returns the page when the count runs out of time', async () => {
        mockTx.$queryRawUnsafe.mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => row({ cnpj: String(i) })))
            .mockRejectedValueOnce(new Error('statement timeout'));
        const r = await searchRfCompanies({ municipio: 'Belo Horizonte', razaoSocial: 'padaria' }, 1, 20);
        expect(r.companies).toHaveLength(20);
        expect(r.capped).toBe(true);
    });

    it('adds opening-date and contact filters without ordering the match set', async () => {
        const { sql, params } = buildRfWhere({ cnaes: ['4637'], uf: 'MS', openedSince: '20260101', hasPhone: true, hasEmail: true });
        expect(sql).toContain('"dataAbertura" >= $4');
        expect(sql).toContain("telefone IS NOT NULL AND telefone <> ''");
        expect(sql).toContain("email IS NOT NULL AND email <> ''");
        expect(params).toEqual(['4637', '4638', 'MS', '20260101']);
        mockTx.$queryRawUnsafe.mockResolvedValueOnce([]).mockResolvedValueOnce([{ n: BigInt(0) }]);
        await searchRfCompanies({ cnaes: ['4637'], uf: 'MS', openedSince: '20260101' }, 1, 20);
        expect(mockTx.$queryRawUnsafe.mock.calls[0][0]).not.toContain('ORDER BY');
    });

    it('estimates the table size instead of counting 27M rows', async () => {
        expect(await estimateRfCompanyCount()).toBe(27133836);
    });
});
