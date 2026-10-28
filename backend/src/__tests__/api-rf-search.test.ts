const mockAuth = jest.fn();
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));
const mockMember = jest.fn();
const mockWsUpdate = jest.fn().mockResolvedValue({});
jest.mock('@/lib/prisma', () => ({
    prisma: {
        workspaceMember: { findFirst: (...a: unknown[]) => mockMember(...a) },
        workspace: { update: (...a: unknown[]) => mockWsUpdate(...a) },
        cnaeCode: { findMany: jest.fn().mockResolvedValue([{ code: '4637101', description: 'Comércio atacadista de alimentos' }]), count: jest.fn() },
        lead: { upsert: jest.fn().mockResolvedValue({}) },
    },
}));
const mockSearch = jest.fn();
jest.mock('@/lib/rf-query', () => ({ searchRfCompanies: (...a: unknown[]) => mockSearch(...a), estimateRfCompanyCount: jest.fn() }));
const mockInfer = jest.fn();
jest.mock('@/modules/search/application/search-rf-integration', () => ({ inferCnaesForSearch: (...a: unknown[]) => mockInfer(...a) }));
jest.mock('@/lib/credit-alerts', () => ({ maybeSendLowCreditsAlert: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/rf-search/route';

const req = (body: unknown) => new NextRequest('http://x/api/rf-search', { method: 'POST', body: JSON.stringify(body) });
const ws = (o: Record<string, unknown> = {}) => ({ workspace: { id: 'w1', plan: 'PRO', leadsUsed: 10, leadsLimit: 400, subscriptionStatus: 'active', currentPeriodEnd: null, ...o } });
const company = { cnpj: '12345678000190', razaoSocial: 'SALGADOS LTDA', nomeFantasia: 'Sabor', cnaePrincipal: '4637101', uf: 'MS', municipio: 'CAMPO GRANDE', cep: null, bairro: 'CENTRO', logradouro: null, numero: null, ddd: '67', telefone: '33334444', email: null, porte: 'ME', capitalSocial: 1000, dataAbertura: '20260201' };

beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockMember.mockResolvedValue(ws());
    mockSearch.mockResolvedValue({ companies: [company], total: 1, capped: false });
});

describe('POST /api/rf-search', () => {
    it('infers CNAEs from the niche (without the city) and charges one credit on page 1', async () => {
        mockInfer.mockResolvedValue(['4637']);
        const res = await POST(req({ niche: 'distribuidora de salgados', uf: 'MS', municipio: 'Campo Grande', openedWithinDays: 90, hasPhone: true }));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(mockInfer).toHaveBeenCalledWith('distribuidora de salgados', null, { city: 'Campo Grande', state: 'MS' });
        expect(mockSearch.mock.calls[0][0]).toEqual(expect.objectContaining({ cnaes: ['4637'], hasPhone: true, openedSince: expect.stringMatching(/^\d{8}$/) }));
        expect(body.cnaesUsed).toEqual(['4637']);
        expect(body.companies[0]).toEqual(expect.objectContaining({ placeId: 'rf_12345678000190', telefone: '(67) 33334444' }));
        expect(mockWsUpdate).toHaveBeenCalledWith({ where: { id: 'w1' }, data: { leadsUsed: { increment: 1 } } });
    });

    it('paging is free', async () => {
        await POST(req({ cnaes: ['4637'], uf: 'MS', page: 2 }));
        expect(mockWsUpdate).not.toHaveBeenCalled();
    });

    it('blocks a new search without credits and explains unknown niches', async () => {
        mockMember.mockResolvedValueOnce(ws({ leadsUsed: 400 }));
        expect((await POST(req({ cnaes: ['4637'], uf: 'MS' }))).status).toBe(403);

        mockInfer.mockResolvedValue([]);
        const res = await POST(req({ niche: 'xyzabc', uf: 'MS' }));
        expect(res.status).toBe(422);
        expect((await res.json()).code).toBe('NICHE_NOT_RECOGNIZED');
    });
});
