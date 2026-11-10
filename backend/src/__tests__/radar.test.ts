const mockHistory = jest.fn();
const mockMember = jest.fn();
const mockUsers = jest.fn();
const mockUnsub = jest.fn().mockResolvedValue([]);
jest.mock('@/lib/prisma', () => ({
    prisma: {
        searchHistory: { findMany: (...a: unknown[]) => mockHistory(...a) },
        workspaceMember: { findFirst: (...a: unknown[]) => mockMember(...a) },
        user: { findMany: (...a: unknown[]) => mockUsers(...a) },
        emailUnsubscribe: { findMany: (...a: unknown[]) => mockUnsub(...a) },
    },
}));
const redisStore = new Map<string, string>();
jest.mock('@/lib/redis', () => ({
    getCached: jest.fn().mockResolvedValue(null),
    setCached: jest.fn().mockResolvedValue(undefined),
    getRedisClient: () => ({
        get: async (k: string) => redisStore.get(k) ?? null,
        set: async (k: string, v: string) => { redisStore.set(k, v); return 'OK'; },
    }),
}));
const mockRows = jest.fn();
jest.mock('@/lib/reengagement', () => ({
    rfLatestOpening: jest.fn().mockResolvedValue('20261020'),
    formatRfDate: (d: string | null) => (d ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : null),
    queryNewCompanyRows: (...a: unknown[]) => mockRows(...a),
}));
jest.mock('@/modules/search/application/search-rf-integration', () => ({ inferCnaesForSearch: jest.fn().mockResolvedValue(['4753900']) }));
jest.mock('@/lib/sample-list', () => ({ displayName: (f: string | null, r: string) => f || r }));
jest.mock('@/lib/marketing-cap', () => ({ claimMarketingSlot: jest.fn().mockResolvedValue(true) }));
const mockSend = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/billing-emails', () => ({ sendRadarDigestEmail: (...a: unknown[]) => mockSend(...a) }));
const mockNotify = jest.fn().mockResolvedValue({ id: 'n1' });
jest.mock('@/lib/notification-service', () => ({ createNotification: (...a: unknown[]) => mockNotify(...a) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { getRadarInterests, getRadar, runRadarDigest, isRadarDay } from '@/lib/radar';

const row = (n: number, extra: Record<string, unknown> = {}) => ({
    cnpj: `0000000000000${n}`, razaoSocial: `EMPRESA ${n} LTDA`, nomeFantasia: `Loja ${n}`, bairro: 'Centro',
    ddd: '48', telefone: '33221100', email: null, dataAbertura: `202610${String(n).padStart(2, '0')}`, porte: 'ME', ...extra,
});
const MONDAY = new Date('2026-11-16T13:00:00Z');

beforeEach(() => {
    jest.clearAllMocks();
    redisStore.clear();
    mockMember.mockResolvedValue(null);
});

describe('radar interests', () => {
    it('dedupes searches and reads the place from the text when the record has none', async () => {
        mockHistory.mockResolvedValueOnce([
            { textQuery: 'Loja de eletrônicos BA', city: null, state: 'BA', filters: null },
            { textQuery: 'loja de eletrônicos', city: null, state: 'BA', filters: null },
            { textQuery: 'padarias em Florianópolis SC', city: null, state: null, filters: { includedType: 'bakery' } },
            { textQuery: 'qualquer coisa', city: null, state: null, filters: null },
        ]);
        const r = await getRadarInterests('u1');
        expect(r).toEqual([
            { niche: 'Loja de eletrônicos', city: null, state: 'BA', includedType: null },
            { niche: 'padarias', city: 'Florianópolis', state: 'SC', includedType: 'bakery' },
        ]);
    });

    it('falls back to the business profile', async () => {
        mockHistory.mockResolvedValueOnce([]);
        mockMember.mockResolvedValueOnce({ workspace: { targetAudience: 'Clínicas odontológicas, consultórios', city: 'Campinas', state: 'SP' } });
        expect(await getRadarInterests('u1')).toEqual([{ niche: 'Clínicas odontológicas', city: 'Campinas', state: 'SP', includedType: null }]);
    });
});

describe('getRadar', () => {
    it('lists the newest companies with a contact, full phone in the app', async () => {
        mockHistory.mockResolvedValueOnce([{ textQuery: 'eletrônicos', city: 'Florianópolis', state: 'SC', filters: null }]);
        mockRows.mockResolvedValueOnce([row(1), row(9), row(5, { telefone: null })]);
        const radar = await getRadar('u1', { fresh: true });
        expect(radar.since).toBe('05/09/2026');
        expect(radar.items[0]!.total).toBe(3);
        expect(radar.items[0]!.companies.map((c) => c.name)).toEqual(['Loja 9', 'Loja 1']);
        expect(radar.items[0]!.companies[0]).toMatchObject({ phone: '(48) 3322-1100', porte: 'Microempresa', openedAt: '09/10/2026' });
    });
});

describe('weekly digest', () => {
    it('only runs on Mondays (Brasília)', async () => {
        expect(isRadarDay(MONDAY)).toBe(true);
        expect(isRadarDay(new Date('2026-11-16T02:00:00Z'))).toBe(false); // still Sunday in Brasília
        const r = await runRadarDigest(new Date('2026-11-17T13:00:00Z'), false);
        expect(r.sent).toBe(0);
        expect(mockUsers).not.toHaveBeenCalled();
    });

    it('sends e-mail + push once per week with masked phones', async () => {
        mockUsers.mockResolvedValue([{ id: 'u1', email: 'a@b.com', name: 'Ana', market: 'BR', notifyByEmail: true }]);
        mockHistory.mockResolvedValue([{ textQuery: 'eletrônicos', city: 'Florianópolis', state: 'SC', filters: null }]);
        mockRows.mockResolvedValue([row(1), row(2), row(3)]);

        const r = await runRadarDigest(MONDAY, false);
        expect(r).toEqual({ candidates: 1, sent: 1, pushed: 1 });
        const payload = mockSend.mock.calls[0][2];
        expect(payload.items[0].place).toBe('Florianópolis/SC');
        expect(payload.items[0].companies[0].phone).toBe('(48) 3322-••••');
        expect(mockNotify.mock.calls[0][0]).toMatchObject({ channel: 'radar_weekly', link: '/dashboard#radar' });

        const again = await runRadarDigest(MONDAY, false);
        expect(again.sent).toBe(0);
    });

    it('pushes but does not e-mail users who turned e-mails off', async () => {
        mockUsers.mockResolvedValue([{ id: 'u2', email: 'c@d.com', name: null, market: 'BR', notifyByEmail: false }]);
        mockHistory.mockResolvedValue([{ textQuery: 'eletrônicos', city: 'Florianópolis', state: 'SC', filters: null }]);
        mockRows.mockResolvedValue([row(1), row(2), row(3)]);
        const r = await runRadarDigest(MONDAY, false);
        expect(r.pushed).toBe(1);
        expect(mockSend).not.toHaveBeenCalled();
    });
});
