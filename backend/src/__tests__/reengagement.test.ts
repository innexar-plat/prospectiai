const mockUsers = jest.fn();
const mockUnsub = jest.fn().mockResolvedValue([]);
const mockTx = { $executeRawUnsafe: jest.fn().mockResolvedValue(0), $queryRawUnsafe: jest.fn() };
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findMany: (...a: unknown[]) => mockUsers(...a) },
        emailUnsubscribe: { findMany: (...a: unknown[]) => mockUnsub(...a) },
        $queryRaw: jest.fn().mockResolvedValue([{ d: '20260315' }]),
        $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(mockTx)),
    },
}));
const redisStore = new Map<string, string>();
jest.mock('@/lib/redis', () => ({
    getCached: jest.fn().mockResolvedValue(null),
    setCached: jest.fn(),
    getRedisClient: () => ({
        get: async (k: string) => redisStore.get(k) ?? null,
        set: async (k: string, v: string) => { redisStore.set(k, v); },
        incr: async (k: string) => { redisStore.set(k, String(Number(redisStore.get(k) ?? 0) + 1)); },
    }),
}));
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));
const mockSend = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/billing-emails', () => ({ sendReengagementEmail: (...a: unknown[]) => mockSend(...a) }));
const mockInfer = jest.fn().mockResolvedValue(['8630']);
jest.mock('@/modules/search/application/search-rf-integration', () => ({ inferCnaesForSearch: (...a: unknown[]) => mockInfer(...a) }));

import { runReengagementEmails, maskPhone } from '@/lib/reengagement';

const NOW = new Date('2026-10-28T12:00:00Z');
const user = (o: Record<string, unknown> = {}) => ({
    id: 'u1', email: 'ana@x.com', name: 'Ana', market: 'BR', analyses: [],
    searchHistory: [{
        textQuery: 'Dentista Blumenau', city: 'Blumenau', state: 'SC', filters: null,
        resultsData: [
            { displayName: { text: 'Odonto A' }, opportunityScore: 80, rating: 3.9, userRatingCount: 4, nationalPhoneNumber: '(47) 3322-1100' },
            { displayName: { text: 'Odonto B' }, opportunityScore: 60 },
            { displayName: { text: 'Odonto C' }, opportunityScore: 10, websiteUri: 'https://c.com' },
        ],
    }],
    ...o,
});
const rfRow = (n: string, d: string) => ({ razaoSocial: `${n} LTDA`, nomeFantasia: n, bairro: 'CENTRO', ddd: '47', telefone: '33221100', dataAbertura: d, porte: 'ME' });

beforeEach(() => { jest.clearAllMocks(); redisStore.clear(); mockUnsub.mockResolvedValue([]); });

describe('maskPhone', () => {
    it('hides the last 4 digits', () => {
        expect(maskPhone('47', '33221100')).toBe('(47) 3322-••••');
        expect(maskPhone(null, '(47) 99911-2233')).toBe('4799911-••••');
        expect(maskPhone('47', '123')).toBeNull();
    });
});

describe('runReengagementEmails', () => {
    it('sends newly opened companies of the same niche/city, newest first, and the niche without the city', async () => {
        mockUsers.mockResolvedValue([user()]);
        mockTx.$queryRawUnsafe.mockResolvedValue([rfRow('Sorriso', '20260210'), rfRow('Dental Max', '20260301'), rfRow('Odonto Vida', '20260120')]);
        const r = await runReengagementEmails(NOW, false);
        expect(r).toEqual(expect.objectContaining({ sent: 1, fromRf: 1 }));
        expect(mockInfer).toHaveBeenCalledWith('Dentista', null);
        const [, , payload] = mockSend.mock.calls[0];
        expect(payload.source).toBe('rf');
        expect(payload.companies[0]).toEqual({ name: 'Dental Max', detail: 'CENTRO · aberta em 01/03/2026', phone: '(47) 3322-••••' });
        const sql = mockTx.$queryRawUnsafe.mock.calls[0][0];
        expect(sql).toContain('municipio = $1');
        expect(sql).toContain('"dataAbertura" >=');
    });

    it('falls back to unsaved leads from the last search when the base has nothing new', async () => {
        mockUsers.mockResolvedValue([user({ analyses: [{ lead: { name: 'Odonto B' } }] })]);
        mockTx.$queryRawUnsafe.mockResolvedValue([]);
        await runReengagementEmails(NOW, false);
        const [, , payload] = mockSend.mock.calls[0];
        expect(payload.source).toBe('history');
        expect(payload.companies.map((c: { name: string }) => c.name)).toEqual(['Odonto A', 'Odonto C']);
        expect(payload.companies[0].detail).toBe('sem site · nota 3,9 (4)');
    });

    it('respects unsubscribes, the weekly limit and the lifetime cap', async () => {
        mockUsers.mockResolvedValue([user()]);
        mockTx.$queryRawUnsafe.mockResolvedValue([rfRow('A', '20260301'), rfRow('B', '20260302')]);
        mockUnsub.mockResolvedValueOnce([{ email: 'ana@x.com' }]);
        expect((await runReengagementEmails(NOW, false)).sent).toBe(0);

        expect((await runReengagementEmails(NOW, false)).sent).toBe(1);
        expect((await runReengagementEmails(NOW, false)).sent).toBe(0); // same week

        redisStore.clear();
        redisStore.set('reengage:count:u1', '6');
        expect((await runReengagementEmails(NOW, false)).sent).toBe(0); // lifetime cap
    });

    it('queries only inactive users with email on, and dry run sends nothing', async () => {
        mockUsers.mockResolvedValue([user()]);
        mockTx.$queryRawUnsafe.mockResolvedValue([rfRow('A', '20260301'), rfRow('B', '20260302')]);
        const r = await runReengagementEmails(NOW, true);
        expect(r.sent).toBe(1);
        expect(mockSend).not.toHaveBeenCalled();
        expect(mockUsers.mock.calls[0][0].where).toEqual(expect.objectContaining({
            notifyByEmail: true, disabledAt: null, market: 'BR',
            searchHistory: { some: {}, none: { createdAt: { gte: new Date('2026-10-21T12:00:00Z') } } },
        }));
    });
});
