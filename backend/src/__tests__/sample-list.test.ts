process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret';
const m = {
    findRf: jest.fn(), leadFind: jest.fn(), leadUpdate: jest.fn().mockResolvedValue({}), reqCount: jest.fn().mockResolvedValue(0),
    reqCreate: jest.fn().mockResolvedValue({}), pipelineFind: jest.fn(), dealFind: jest.fn(), dealCreate: jest.fn().mockResolvedValue({}),
    activityCreate: jest.fn().mockResolvedValue({}), send: jest.fn().mockResolvedValue({ sent: true }),
};
jest.mock('@/lib/rf-query', () => ({ findRfCompanies: (...a: unknown[]) => m.findRf(...a) }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        prospectedLead: { findUnique: (...a: unknown[]) => m.leadFind(...a), update: (...a: unknown[]) => m.leadUpdate(...a) },
        sampleRequest: { count: (...a: unknown[]) => m.reqCount(...a), create: (...a: unknown[]) => m.reqCreate(...a) },
        crmPipeline: { findFirst: (...a: unknown[]) => m.pipelineFind(...a) },
        crmDeal: { findFirst: (...a: unknown[]) => m.dealFind(...a), create: (...a: unknown[]) => m.dealCreate(...a) },
        crmActivity: { create: (...a: unknown[]) => m.activityCreate(...a) },
    },
}));
jest.mock('@/lib/email', () => ({ sendEmail: (...a: unknown[]) => m.send(...a) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { buildSample, displayName, requestSample, sampleTokenFor, verifySampleToken } from '@/lib/sample-list';

const rf = (i: number, opened: string, email: string | null) => ({
    cnpj: String(i), razaoSocial: `EMPRESA ${i} LTDA`, nomeFantasia: i % 2 ? `PADARIA ${i}` : null, bairro: 'CENTRO', porte: 'ME',
    dataAbertura: opened, ddd: '19', telefone: '988887777', email,
});

beforeEach(() => { jest.clearAllMocks(); m.reqCount.mockResolvedValue(0); });

describe('sample token', () => {
    it('round-trips and rejects tampering', () => {
        const t = sampleTokenFor('lead123');
        expect(verifySampleToken(t)).toBe('lead123');
        expect(verifySampleToken(t.replace('lead123', 'lead999'))).toBeNull();
        expect(verifySampleToken('garbage')).toBeNull();
    });
});

describe('buildSample', () => {
    it('returns up to 20 companies, newest first, formatted for people', async () => {
        m.findRf.mockResolvedValueOnce([rf(2, '20261001', 'OI@X.COM')])
            .mockResolvedValueOnce([rf(1, '20200101', null), rf(2, '20261001', 'OI@X.COM'), ...Array.from({ length: 30 }, (_, i) => rf(10 + i, '20190101', null))]);
        const r = await buildSample('padarias', 'Campinas', 'sp');
        expect(r).toHaveLength(20);
        expect(r[0]).toEqual({ name: 'Empresa 2', bairro: 'Centro', porte: 'Micro', openedAt: '01/10/2026', phone: '(19) 98888-7777', email: 'oi@x.com' });
        expect(m.findRf).toHaveBeenNthCalledWith(1, expect.objectContaining({ cnaes: ['1091102', '4721102'], municipio: 'CAMPINAS', uf: 'SP', hasPhone: true, openedSince: expect.stringMatching(/^\d{8}$/) }), 80);
        expect(r.filter((c) => c.email === 'oi@x.com')).toHaveLength(1);
    });

    it('never shows the MEI owner CPF that the Receita appends to the legal name', () => {
        expect(displayName(null, 'EDINALDO GUEDES DA SILVA 78865727420')).toBe('Edinaldo Guedes da Silva');
        expect(displayName(null, 'MARIA SOUZA 123.456.789-01')).toBe('Maria Souza');
        expect(displayName('PADARIA SOL', 'X 12345678901')).toBe('Padaria Sol');
        expect(displayName(null, 'CONSTRUTORA HORIZONTE LTDA')).toBe('Construtora Horizonte');
    });
});

describe('requestSample', () => {
    it('SEO visitors must leave an e-mail and get the list by e-mail', async () => {
        await expect(requestSample({ segment: 'padarias', city: 'Campinas', uf: 'SP' })).rejects.toMatchObject({ status: 400 });
        m.findRf.mockResolvedValue([rf(1, '20261001', null)]);
        const r = await requestSample({ segment: 'padarias', city: 'Campinas', uf: 'SP', email: 'ana@loja.com', ip: '1.2.3.4' });
        expect(r.companies).toHaveLength(1);
        expect(m.send).toHaveBeenCalledWith('ana@loja.com', 'Sua amostra: Padarias em Campinas', expect.stringContaining('Padaria 1'), { replyTo: 'comercial@precisionia.com.br' });
        expect(m.reqCreate.mock.calls[0][0].data).toEqual(expect.objectContaining({ source: 'seo', email: 'ana@loja.com', resultCount: 1 }));
    });

    it('a cold-email click engages the lead and opens a CRM deal with a call task', async () => {
        m.leadFind.mockResolvedValueOnce({ id: 'L1', email: 'dono@agencia.com', razaoSocial: 'AGENCIA X LTDA', nomeFantasia: 'Agência X', telefone: '33334444', ddd: '11', status: 'EMAILING' });
        m.findRf.mockResolvedValue([rf(1, '20261001', null)]);
        m.pipelineFind.mockResolvedValueOnce({ id: 'p1', stages: [{ id: 's0' }, { id: 's1' }] });
        m.dealFind.mockResolvedValueOnce(null);

        const r = await requestSample({ token: sampleTokenFor('L1'), segment: 'restaurantes', city: 'São Paulo', uf: 'SP' });

        expect(r.fromColdEmail).toBe(true);
        expect(m.leadUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'L1' }, data: expect.objectContaining({ status: 'ENGAGED' }) }));
        const deal = m.dealCreate.mock.calls[0][0].data;
        expect(deal).toEqual(expect.objectContaining({ title: 'Agência X', stageId: 's1', source: 'amostra', contactEmail: 'dono@agencia.com' }));
        expect(deal.activities.create.map((a: { type: string }) => a.type)).toEqual(['NOTE', 'TASK']);
    });

    it('limits abuse per IP / e-mail', async () => {
        m.reqCount.mockResolvedValueOnce(5);
        await expect(requestSample({ segment: 'padarias', city: 'Campinas', uf: 'SP', email: 'a@b.com', ip: '9.9.9.9' })).rejects.toMatchObject({ status: 429 });
        expect(m.findRf).not.toHaveBeenCalled();
    });
});
