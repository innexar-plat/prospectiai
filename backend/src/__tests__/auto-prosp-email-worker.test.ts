const mockConfig = jest.fn().mockResolvedValue({ emailStepIntervalHours: 48 });
const mockLeads = jest.fn();
const mockLeadUpdate = jest.fn().mockResolvedValue({});
const mockTemplate = jest.fn().mockResolvedValue({ id: 't1', subject: 'Oi {{razaoSocial}}', bodyHtml: '<html><body><p>Olá {{razaoSocial}}</p></body></html>' });
const mockSenders = jest.fn();
const mockSenderUpdate = jest.fn().mockResolvedValue({});
const mockUnsub = jest.fn();
const mockEventCreate = jest.fn().mockResolvedValue({});
jest.mock('@/lib/prisma', () => ({
    prisma: {
        autoProspeccaoConfig: { findUnique: (...a: unknown[]) => mockConfig(...a) },
        prospectedLead: { findMany: (...a: unknown[]) => mockLeads(...a), update: (...a: unknown[]) => mockLeadUpdate(...a) },
        autoProspeccaoTemplate: { findFirst: (...a: unknown[]) => mockTemplate(...a) },
        autoProspSenderPool: { findMany: (...a: unknown[]) => mockSenders(...a), update: (...a: unknown[]) => mockSenderUpdate(...a) },
        emailUnsubscribe: { findFirst: (...a: unknown[]) => mockUnsub(...a) },
        prospectedLeadEmailEvent: { create: (...a: unknown[]) => mockEventCreate(...a) },
        autoProspeccaoRun: { update: jest.fn().mockResolvedValue({}) },
    },
}));
const mockResendSend = jest.fn().mockResolvedValue({ error: null });
jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: (...a: unknown[]) => mockResendSend(...a) } })) }));
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('@/lib/email-config-encrypt', () => ({ decryptEmailSecret: () => 'key' }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { runEmailSequenceWorker, buildOptOutFooter } from '@/modules/auto-prospeccao/application/email-sequence.worker';

const lead = { id: 'l1', email: 'contato@empresa.com.br', razaoSocial: 'Empresa X', status: 'HOT' };
const sender = { id: 's1', provider: 'resend', fromEmail: 'Ana <ana@prospect.precisionia.com.br>', resendApiKeyEncrypted: 'enc', smtpHost: null, smtpPort: null, smtpUser: null, smtpPasswordEncrypted: null, sentToday: 0, dailyLimit: 50 };

beforeEach(() => {
    jest.clearAllMocks();
    mockLeads.mockResolvedValueOnce([lead]).mockResolvedValueOnce([]);
    mockUnsub.mockResolvedValue(null);
});

describe('auto-prospecting e-mail worker', () => {
    it('never falls back to the system sender when the pool is empty', async () => {
        mockSenders.mockResolvedValueOnce([]);
        const r = await runEmailSequenceWorker('w1', 'run1');
        expect(r.emailsSent).toBe(0);
        expect(mockResendSend).not.toHaveBeenCalled();
        expect(mockEventCreate).not.toHaveBeenCalled();
    });

    it('sends through the dedicated sender with a one-click opt-out link', async () => {
        mockSenders.mockResolvedValueOnce([sender]);
        const r = await runEmailSequenceWorker('w1', 'run1');
        expect(r.emailsSent).toBe(1);
        const html = mockResendSend.mock.calls[0][0].html as string;
        expect(html).toMatch(/\/api\/track\/email\/optout\/[0-9a-f-]{36}/);
        expect(html).toContain('Não quero receber mais e-mails');
        expect(mockResendSend.mock.calls[0][0].subject).toBe('Oi Empresa X');
    });

    it('skips and marks opted-out addresses', async () => {
        mockUnsub.mockResolvedValueOnce({ id: 'u' });
        mockSenders.mockResolvedValueOnce([sender]);
        await runEmailSequenceWorker('w1', 'run1');
        expect(mockResendSend).not.toHaveBeenCalled();
        expect(mockLeadUpdate).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { status: 'OPTED_OUT' } });
    });
});

describe('buildOptOutFooter', () => {
    it('explains the source of the address', () => {
        expect(buildOptOutFooter('https://x/o/1')).toContain('Receita Federal');
    });
});
