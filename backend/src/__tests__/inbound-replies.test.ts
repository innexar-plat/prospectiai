process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret';
const mockConfigs = jest.fn();
const mockLead = jest.fn();
const mockLeadUpdate = jest.fn().mockResolvedValue({});
const mockSampleFind = jest.fn();
const mockSampleCreate = jest.fn().mockResolvedValue({});
jest.mock('@/lib/prisma', () => ({
    prisma: {
        autoProspeccaoConfig: { findMany: (...a: unknown[]) => mockConfigs(...a) },
        prospectedLead: { findFirst: (...a: unknown[]) => mockLead(...a), update: (...a: unknown[]) => mockLeadUpdate(...a) },
        sampleRequest: { findFirst: (...a: unknown[]) => mockSampleFind(...a), create: (...a: unknown[]) => mockSampleCreate(...a) },
    },
}));
const store = new Set<string>();
jest.mock('@/lib/redis', () => ({
    getRedisClient: () => ({
        set: async (k: string) => (store.has(k) ? null : (store.add(k), 'OK')),
        del: async (k: string) => store.delete(k),
    }),
}));
const mockSend = jest.fn().mockResolvedValue({ sent: true });
jest.mock('@/lib/email', () => ({ sendEmail: (...a: unknown[]) => mockSend(...a) }));
const mockAlert = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/telegram-alert', () => ({ alertInfo: (...a: unknown[]) => mockAlert(...a) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const mockBuildSample = jest.fn();
const mockEngage = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/sample-list', () => ({
    ...jest.requireActual('@/lib/sample-list'),
    buildSample: (...a: unknown[]) => mockBuildSample(...a),
    engageLead: (...a: unknown[]) => mockEngage(...a),
}));

import { guessSampleRequest, handleInboundReply, isAutoReply, type InboundReply } from '@/lib/inbound-replies';

const reply = (over: Partial<InboundReply> = {}): InboundReply => ({
    mailbox: 'comercial@precisionia.com.br', messageId: `<m${Math.random()}@x>`, from: 'joao@padaria.com.br',
    subject: 'Re: Para quem a Padaria Joao vende', text: 'Tenho interesse, pode mandar.', ...over,
});
const precisionLead = { id: 'l1', workspaceId: 'sys-workspace-precisionia', email: 'joao@padaria.com.br', razaoSocial: 'PADARIA JOAO LTDA', nomeFantasia: 'Padaria João', telefone: '33221100', ddd: '13', status: 'EMAILING', municipio: 'SANTOS', uf: 'SP' };
const company = (n: number) => ({ name: `Empresa ${n}`, bairro: 'Centro', porte: 'ME', openedAt: '01/10/2026', phone: null, email: null });

beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    mockConfigs.mockResolvedValue([{ workspaceId: 'sys-workspace-precisionia' }]);
    mockSampleFind.mockResolvedValue(null);
});

describe('isAutoReply', () => {
    it('recognises out-of-office and courtesy auto-answers', () => {
        expect(isAutoReply({ subject: 'Obrigado pelo contato.', from: 'contato@x.com', text: 'oi' })).toBe(true);
        expect(isAutoReply({ subject: 'MEU EMAIL MUDOU l', from: 'a@x.com', text: 'oi' })).toBe(true);
        expect(isAutoReply({ subject: 'Re: oi', from: 'a@x.com', text: 'oi', autoSubmitted: 'auto-replied' })).toBe(true);
        expect(isAutoReply({ subject: 'Re: Sua amostra', from: 'a@x.com', text: '   ' })).toBe(false);
        expect(isAutoReply({ subject: 'Re: Sua amostra', from: 'a@x.com', text: 'Quero saber mais', autoSubmitted: 'no' })).toBe(false);
    });
});

describe('guessSampleRequest', () => {
    it('reads the segment and the city from the reply, falling back to the lead city', () => {
        expect(guessSampleRequest('Me manda dentistas em Campinas', { city: 'Santos', uf: 'SP' })).toEqual({ segment: 'dentistas', city: 'Campinas', uf: 'SP' });
        expect(guessSampleRequest('vendo para restaurantes', { city: 'Santos', uf: 'SP' })).toEqual({ segment: 'restaurantes', city: 'Santos', uf: 'SP' });
        expect(guessSampleRequest('tenho interesse', { city: 'Santos', uf: 'SP' })).toBeNull();
    });
});

describe('handleInboundReply', () => {
    it('ignores auto-replies without touching the lead', async () => {
        expect(await handleInboundReply(reply({ subject: 'Resposta automática: férias' }))).toBe('ignored-auto');
        expect(mockLead).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('ignores senders that are not leads', async () => {
        mockLead.mockResolvedValueOnce(null);
        expect(await handleInboundReply(reply())).toBe('ignored-unknown');
        expect(mockAlert).not.toHaveBeenCalled();
    });

    it('stops the sequence, alerts, puts the lead in the CRM and sends the list when a segment is named', async () => {
        mockLead.mockResolvedValue(precisionLead);
        mockBuildSample.mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => company(i)));
        const r = reply({ text: 'Quero ver clínicas de estética em Santos', messageId: '<abc@x>' });
        expect(await handleInboundReply(r)).toBe('answered-sample');
        expect(mockLeadUpdate).toHaveBeenCalledWith({ where: { id: 'l1' }, data: expect.objectContaining({ status: 'ENGAGED' }) });
        expect(mockAlert).toHaveBeenCalled();
        expect(mockEngage).toHaveBeenCalledWith(precisionLead, expect.objectContaining({ source: 'resposta' }), expect.any(Date));
        const [to, subject, html, opts] = mockSend.mock.calls[0];
        expect(to).toBe('joao@padaria.com.br');
        expect(subject).toBe('Re: Para quem a Padaria Joao vende');
        expect(html).toContain('Empresa 19');
        expect(opts.headers['In-Reply-To']).toBe('<abc@x>');
        expect(mockBuildSample.mock.calls[0].slice(0, 3)).toEqual(['clinicas-de-estetica', 'Santos', 'SP']);
    });

    it('sends the personal link once when no segment is named, and the list on a later reply', async () => {
        mockLead.mockResolvedValue(precisionLead);
        expect(await handleInboundReply(reply())).toBe('answered-link');
        expect(mockSend.mock.calls[0][2]).toMatch(/\/amostra\?t=/);
        expect(await handleInboundReply(reply({ text: 'ok obrigado' }))).toBe('already-answered');
        mockBuildSample.mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => company(i)));
        expect(await handleInboundReply(reply({ text: 'padarias em Santos' }))).toBe('answered-sample');
        expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('for a client workspace (Heavy Clean) only stops the sequence and alerts', async () => {
        mockConfigs.mockResolvedValueOnce([{ workspaceId: 'hc-ws-autoprosp' }]);
        mockLead.mockResolvedValueOnce({ ...precisionLead, workspaceId: 'hc-ws-autoprosp' });
        expect(await handleInboundReply(reply({ mailbox: 'comercial@heavyclean.com.br' }))).toBe('stopped');
        expect(mockLeadUpdate).toHaveBeenCalled();
        expect(mockAlert).toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
        expect(mockEngage).not.toHaveBeenCalled();
    });

    it('processes each message only once', async () => {
        mockLead.mockResolvedValue(precisionLead);
        const r = reply({ messageId: '<same@x>' });
        await handleInboundReply(r);
        expect(await handleInboundReply(r)).toBe('duplicate');
    });
});

describe('guessSampleRequest — no false positives', () => {
    it('does not pick a segment from common words', () => {
        expect(guessSampleRequest('no mercado atual está difícil vender', { city: 'Santos', uf: 'SP' })).toBeNull();
        expect(guessSampleRequest('trabalho com marketing digital', { city: 'Santos', uf: 'SP' })).toBeNull();
    });
});
