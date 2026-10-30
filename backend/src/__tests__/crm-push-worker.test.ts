const mockConfig = jest.fn();
const mockLeads = jest.fn();
jest.mock('@/lib/prisma', () => ({
    prisma: {
        autoProspeccaoConfig: { findUnique: (...a: unknown[]) => mockConfig(...a) },
        prospectedLead: { findMany: (...a: unknown[]) => mockLeads(...a), update: jest.fn().mockResolvedValue({}) },
        autoProspeccaoRun: { update: jest.fn().mockResolvedValue({}) },
    },
}));
const mockToken = jest.fn();
jest.mock('@/lib/rdstation-oauth', () => ({
    getValidRdStationAccessToken: (...a: unknown[]) => mockToken(...a),
    forceRefreshRdTokenIfPossible: (...a: unknown[]) => mockToken(...a),
    getRdProductMode: () => 'crm',
}));
jest.mock('@/lib/hubspot-oauth', () => ({ getValidHubspotAccessToken: jest.fn(), forceRefreshHubspotTokenIfPossible: jest.fn() }));
jest.mock('@/lib/agendor-config', () => ({ getAgendorApiTokenForUser: jest.fn() }));
const mockLock = jest.fn();
jest.mock('@/lib/redis', () => ({ acquireRedisLock: (...a: unknown[]) => mockLock(...a) }));
const mockAlert = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/telegram-alert', () => ({ alertWarning: (...a: unknown[]) => mockAlert(...a) }));
const mockLogError = jest.fn();
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: (...a: unknown[]) => mockLogError(...a) } }));

import { runCrmPushWorker, isCrmAuthError } from '@/modules/auto-prospeccao/application/crm-push.worker';

const lead = (id: string) => ({ id, razaoSocial: `Empresa ${id}`, nomeFantasia: null, email: 'a@b.com', ddd: '11', telefone: '999999999', cnpj: '1', municipio: 'SP', uf: 'SP', score: 80 });

beforeEach(() => jest.clearAllMocks());

describe('crm push worker', () => {
    it('stops at the first authorization failure and alerts once per day', async () => {
        mockConfig.mockResolvedValue({ crmAutoSend: true, crmProvider: 'rdstation', crmOwnerUserId: 'u1' });
        mockLeads.mockResolvedValue([lead('a'), lead('b'), lead('c')]);
        mockToken.mockResolvedValue('expired');
        global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401 })) as unknown as typeof fetch;
        mockLock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

        const r1 = await runCrmPushWorker('w1', 'run1', 50);
        const r2 = await runCrmPushWorker('w1', 'run2', 50);

        expect(r1).toEqual({ pushed: 0, failed: 1 });
        expect(r2).toEqual({ pushed: 0, failed: 1 });
        expect(mockAlert).toHaveBeenCalledTimes(1);
        expect(mockLogError).toHaveBeenCalledTimes(2);
        expect(mockLogError.mock.calls[0][0]).toMatch(/authorization lost/);
    });

    it('classifies auth errors', () => {
        expect(isCrmAuthError('RD Station error 401: {"error":"invalid_token"}')).toBe(true);
        expect(isCrmAuthError('RD Station token refresh failed')).toBe(true);
        expect(isCrmAuthError('RD Station error 422: {"errors":"email inválido"}')).toBe(false);
    });
});
