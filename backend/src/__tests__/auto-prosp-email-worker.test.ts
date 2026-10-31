const mockConfig = jest.fn();
const mockConfigUpdate = jest.fn().mockResolvedValue({});
const mockLeads = jest.fn();
const mockLeadUpdate = jest.fn().mockResolvedValue({});
const mockLeadCount = jest.fn().mockResolvedValue(1);
const mockTemplate = jest.fn().mockResolvedValue({ id: 't1', subject: 'Oi {{razaoSocial}}', bodyHtml: '<html><body><p>Olá {{razaoSocial}}</p></body></html>', bodyText: null });
const mockSenderCount = jest.fn();
const mockSenders = jest.fn();
const mockUnsub = jest.fn();
const mockEventCreate = jest.fn().mockResolvedValue({});
const mockEventCount = jest.fn().mockResolvedValue(0);
jest.mock('@/lib/prisma', () => ({
    prisma: {
        autoProspeccaoConfig: { findUnique: (...a: unknown[]) => mockConfig(...a), update: (...a: unknown[]) => mockConfigUpdate(...a) },
        prospectedLead: { findMany: (...a: unknown[]) => mockLeads(...a), update: (...a: unknown[]) => mockLeadUpdate(...a), count: (...a: unknown[]) => mockLeadCount(...a) },
        autoProspeccaoTemplate: { findFirst: (...a: unknown[]) => mockTemplate(...a) },
        autoProspSenderPool: { count: (...a: unknown[]) => mockSenderCount(...a), findMany: (...a: unknown[]) => mockSenders(...a), update: jest.fn().mockResolvedValue({}) },
        emailUnsubscribe: { findFirst: (...a: unknown[]) => mockUnsub(...a) },
        prospectedLeadEmailEvent: { create: (...a: unknown[]) => mockEventCreate(...a), count: (...a: unknown[]) => mockEventCount(...a) },
        autoProspeccaoRun: { update: jest.fn().mockResolvedValue({}) },
    },
}));
const mockSystemSend = jest.fn().mockResolvedValue({ sent: true });
jest.mock('@/lib/email', () => ({ sendEmail: (...a: unknown[]) => mockSystemSend(...a) }));
const mockResendSend = jest.fn().mockResolvedValue({ error: null });
jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: (...a: unknown[]) => mockResendSend(...a) } })) }));
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('@/lib/email-config-encrypt', () => ({ decryptEmailSecret: () => 'key' }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const mockMx = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/cold-email-guard', () => ({
    ...jest.requireActual('@/lib/cold-email-guard'),
    domainAcceptsMail: (...a: unknown[]) => mockMx(...a),
}));

import { runEmailSequenceWorker, buildOptOutFooter } from '@/modules/auto-prospeccao/application/email-sequence.worker';

// Tuesday 10:00 in Brasília
const NOW = new Date('2026-11-03T13:00:00Z');
const lead = (id: string, email: string) => ({ id, email, razaoSocial: `Empresa ${id}`, status: 'HOT' });
const sender = { id: 's1', provider: 'resend', fromEmail: 'Ana <ana@prospect.precisionia.com.br>', resendApiKeyEncrypted: 'enc', smtpHost: null, smtpPort: null, smtpUser: null, smtpPasswordEncrypted: null, sentToday: 0, dailyLimit: 50 };
const systemConfig = { emailStepIntervalHours: 48, useSystemSender: true, systemSenderStartedAt: null, maxEmailsPerDay: 120, replyToEmail: 'vini@precisionia.com.br', senderName: 'Vinicius | Precision IA' };

beforeEach(() => {
    jest.clearAllMocks();
    mockUnsub.mockResolvedValue(null);
    mockLeadCount.mockResolvedValue(1);
    mockEventCount.mockResolvedValue(0);
    mockMx.mockResolvedValue(true);
});

describe('auto-prospecting e-mail worker', () => {
    it('sends nothing when there is no pool sender and the system sender is off', async () => {
        mockConfig.mockResolvedValueOnce({ emailStepIntervalHours: 48, useSystemSender: false });
        mockSenderCount.mockResolvedValueOnce(0);
        const r = await runEmailSequenceWorker('w1', 'run1', NOW);
        expect(r.emailsSent).toBe(0);
        expect(mockSystemSend).not.toHaveBeenCalled();
        expect(mockLeads).not.toHaveBeenCalled();
    });

    it('system sender: warm-up quota per run, reply-to, sender name, text part and one-click unsubscribe', async () => {
        mockConfig.mockResolvedValueOnce(systemConfig);
        mockSenderCount.mockResolvedValueOnce(0);
        mockLeads.mockResolvedValueOnce([]).mockResolvedValueOnce([lead('a', 'joao@padaria.com.br'), lead('b', 'maria@clinica.com.br')]);

        const r = await runEmailSequenceWorker('w1', 'run1', NOW);

        // 15/day on the first week spread over 16 runs left today → 1 this run
        expect(r.emailsSent).toBe(1);
        const [to, subject, html, opts] = mockSystemSend.mock.calls[0];
        expect(to).toBe('joao@padaria.com.br');
        expect(subject).toBe('Oi Empresa a');
        expect(html).toContain('Não quero receber mais e-mails');
        expect(opts.replyTo).toBe('vini@precisionia.com.br');
        expect(opts.fromName).toBe('Vinicius | Precision IA');
        expect(opts.text).toContain('Olá Empresa a');
        expect(opts.headers['List-Unsubscribe']).toMatch(/^<https?:\/\/.+\/api\/track\/email\/optout\/[0-9a-f-]{36}>$/);
        expect(opts.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
        expect(mockConfigUpdate).toHaveBeenCalledWith({ where: { workspaceId: 'w1' }, data: { systemSenderStartedAt: NOW } });
    });

    it('skips accountant/fiscal, shared and dead-domain addresses before the first e-mail', async () => {
        mockConfig.mockResolvedValueOnce({ ...systemConfig, systemSenderStartedAt: new Date('2026-09-01T00:00:00Z') });
        mockSenderCount.mockResolvedValueOnce(0);
        mockLeads.mockResolvedValueOnce([]).mockResolvedValueOnce([
            lead('a', 'contabilidade@escritorio.com.br'),
            lead('b', 'socio@empresa.com.br'),
            lead('c', 'dono@dominiomorto.com.br'),
        ]);
        mockLeadCount.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
        mockMx.mockResolvedValueOnce(false);

        const r = await runEmailSequenceWorker('w1', 'run1', NOW);

        expect(r.emailsSent).toBe(0);
        expect(mockLeadUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a' }, data: expect.objectContaining({ status: 'COLD' }) }));
        expect(mockLeadUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'b' }, data: expect.objectContaining({ status: 'COLD' }) }));
        expect(mockLeadUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c' }, data: expect.objectContaining({ status: 'BOUNCED' }) }));
    });

    it('waits at least 24 h between steps even when configured lower', async () => {
        mockConfig.mockResolvedValueOnce({ ...systemConfig, emailStepIntervalHours: 1, systemSenderStartedAt: new Date('2026-09-01T00:00:00Z') });
        mockSenderCount.mockResolvedValueOnce(0);
        mockLeads
            .mockResolvedValueOnce([{ ...lead('a', 'joao@padaria.com.br'), status: 'EMAILING', emailEvents: [{ step: 1, sentAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000), openedAt: null }] }])
            .mockResolvedValueOnce([]);
        const r = await runEmailSequenceWorker('w1', 'run1', NOW);
        expect(r.leadsAdvanced).toBe(0);
        expect(mockSystemSend).not.toHaveBeenCalled();
    });

    it('does not send outside business hours', async () => {
        mockConfig.mockResolvedValueOnce(systemConfig);
        mockSenderCount.mockResolvedValueOnce(0);
        const r = await runEmailSequenceWorker('w1', 'run1', new Date('2026-11-07T14:00:00Z'));
        expect(r.emailsSent).toBe(0);
        expect(mockLeads).not.toHaveBeenCalled();
    });

    it('pool sender: sends through the dedicated sender with headers', async () => {
        mockConfig.mockResolvedValueOnce({ emailStepIntervalHours: 48, maxEmailsPerDay: 200 });
        mockSenderCount.mockResolvedValueOnce(1);
        mockSenders.mockResolvedValueOnce([sender]);
        mockLeads.mockResolvedValueOnce([]).mockResolvedValueOnce([lead('a', 'joao@padaria.com.br')]);
        const r = await runEmailSequenceWorker('w1', 'run1', NOW);
        expect(r.emailsSent).toBe(1);
        expect(mockSystemSend).not.toHaveBeenCalled();
        expect(mockResendSend.mock.calls[0][0].headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    });

    it('skips and marks opted-out addresses', async () => {
        mockConfig.mockResolvedValueOnce(systemConfig);
        mockSenderCount.mockResolvedValueOnce(0);
        mockLeads.mockResolvedValueOnce([]).mockResolvedValueOnce([lead('a', 'joao@padaria.com.br')]);
        mockUnsub.mockResolvedValueOnce({ id: 'u' });
        await runEmailSequenceWorker('w1', 'run1', NOW);
        expect(mockSystemSend).not.toHaveBeenCalled();
        expect(mockLeadUpdate).toHaveBeenCalledWith({ where: { id: 'a' }, data: { status: 'OPTED_OUT' } });
    });
});

describe('buildOptOutFooter', () => {
    it('explains the source of the address', () => {
        expect(buildOptOutFooter('https://x/o/1')).toContain('Receita Federal');
    });
});

describe('displayCompanyName', () => {
    it('reads like a person wrote it', () => {
        const { displayCompanyName } = jest.requireActual('@/modules/auto-prospeccao/application/email-sequence.worker');
        expect(displayCompanyName('GOLDSZTEIN HOLDING DE PARTICIPACOES LTDA')).toBe('Goldsztein Holding de Participacoes');
        expect(displayCompanyName('BRASIL SUSTENTAVEL AGROPECUARIA S.A.')).toBe('Brasil Sustentavel Agropecuaria');
        expect(displayCompanyName('360NETWORKS DO BRASIL LTDA', 'NETUNO')).toBe('Netuno');
        expect(displayCompanyName('SD&G ADMINISTRACAO E PARTICIPACOES LTDA.')).toBe('Sd&g Administracao e Participacoes');
        expect(displayCompanyName('X', 'Padaria do João')).toBe('Padaria do João');
        expect(displayCompanyName('AUPOL TI CONSULTORIA LTDA ME')).toBe('Aupol TI Consultoria');
    });
});
