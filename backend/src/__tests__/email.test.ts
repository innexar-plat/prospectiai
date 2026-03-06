/**
 * Tests for email lib. Resend and Prisma are mocked; we verify behaviour (sent/not sent, params).
 * Prisma is mocked so getEmailConfigFromDb() returns null and only env fallback is used in existing tests.
 */
import {
  sendPasswordResetEmail,
  sendTeamInviteEmail,
  sendTeamInviteAccountCreatedEmail,
  sendVerificationEmail,
  sendEmail,
  sendAffiliateApprovedEmail,
  sendAffiliateConversionEmail,
  sendAffiliateCommissionPaidEmail,
  sendAffiliateCommissionAvailableEmail,
} from '@/lib/email';

const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    emailConfig: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@/lib/email-config-encrypt', () => ({
  decryptEmailSecret: jest.fn((hex: string) => `decrypted-${hex}`),
}));

const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

const prisma = require('@/lib/prisma').prisma;

describe('email lib', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    prisma.emailConfig.findFirst.mockResolvedValue(null);
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('sendEmail', () => {
    it('returns sent: false when RESEND_API_KEY is not set', async () => {
      delete process.env.RESEND_API_KEY;
      const mod = await import('@/lib/email');
      const result = await mod.sendEmail('a@b.com', 'Hi', '<p>Hi</p>');
      expect(result.sent).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
      expect(prisma.emailConfig.findFirst).toHaveBeenCalled();
    });

    it('returns sent: true when Resend succeeds', async () => {
      process.env.RESEND_API_KEY = 're_xxx';
      mockSend.mockResolvedValue({ data: { id: '1' }, error: null });
      const mod = await import('@/lib/email');
      const result = await mod.sendEmail('a@b.com', 'Hi', '<p>Hi</p>');
      expect(result.sent).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: ['a@b.com'], subject: 'Hi', html: '<p>Hi</p>' }));
      expect(prisma.emailConfig.findFirst).toHaveBeenCalled();
    });

    it('returns sent: false when Resend returns error', async () => {
      process.env.RESEND_API_KEY = 're_xxx';
      mockSend.mockResolvedValue({ data: null, error: { message: 'Rate limited' } });
      const mod = await import('@/lib/email');
      const result = await mod.sendEmail('a@b.com', 'Hi', '<p>Hi</p>');
      expect(result.sent).toBe(false);
      expect(result.error).toBe('Rate limited');
      expect(prisma.emailConfig.findFirst).toHaveBeenCalled();
    });

    it('uses Resend from DB config when provider is resend and key is set', async () => {
      prisma.emailConfig.findFirst.mockResolvedValue({
        provider: 'resend',
        resendApiKeyEncrypted: 'enc-hex',
        fromEmail: 'From <noreply@test.com>',
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        smtpPasswordEncrypted: null,
      });
      mockSend.mockResolvedValue({ data: { id: '1' }, error: null });
      const mod = await import('@/lib/email');
      const result = await mod.sendEmail('a@b.com', 'Hi', '<p>Hi</p>');
      expect(result.sent).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'From <noreply@test.com>',
          to: ['a@b.com'],
          subject: 'Hi',
          html: '<p>Hi</p>',
        })
      );
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('uses SMTP from DB config when provider is smtp and credentials set', async () => {
      prisma.emailConfig.findFirst.mockResolvedValue({
        provider: 'smtp',
        resendApiKeyEncrypted: null,
        fromEmail: 'SMTP <mail@test.com>',
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUser: 'user',
        smtpPasswordEncrypted: 'enc-pass',
      });
      const mod = await import('@/lib/email');
      const result = await mod.sendEmail('b@c.com', 'Subject', '<p>Body</p>');
      expect(result.sent).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'SMTP <mail@test.com>',
          to: 'b@c.com',
          subject: 'Subject',
          html: '<p>Body</p>',
        })
      );
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('builds reset link and sends email when key set', async () => {
      process.env.RESEND_API_KEY = 're_xxx';
      mockSend.mockResolvedValue({ data: {}, error: null });
      const result = await sendPasswordResetEmail('u@x.com', 'abc123');
      expect(result.sent).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['u@x.com'],
          subject: 'Redefinir sua senha – ProspectorAI',
        })
      );
      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('/reset-password?token=abc123');
    });
  });

  describe('sendVerificationEmail', () => {
    it('sends email with verify link when key set', async () => {
      process.env.RESEND_API_KEY = 're_xxx';
      mockSend.mockResolvedValue({ data: {}, error: null });
      const result = await sendVerificationEmail('u@x.com', 'verify-tok');
      expect(result.sent).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['u@x.com'],
          subject: 'Confirme seu e-mail – ProspectorAI',
        })
      );
      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('verify-email?token=verify-tok');
    });
  });

  describe('sendTeamInviteEmail', () => {
    it('builds subject and body with inviter, workspace name and accept URL', async () => {
      process.env.RESEND_API_KEY = 're_xxx';
      mockSend.mockResolvedValue({ data: {}, error: null });
      const acceptUrl = 'https://app.example.com/accept-invite?token=abc';
      const result = await sendTeamInviteEmail('m@x.com', 'Alice', 'Acme', acceptUrl);
      expect(result.sent).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['m@x.com'],
          subject: 'Convite para o workspace "Acme" – ProspectorAI',
        })
      );
      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('Alice');
      expect(html).toContain('Acme');
      expect(html).toContain(acceptUrl);
    });
  });

  describe('sendTeamInviteAccountCreatedEmail', () => {
    it('sends email with set-password subject and body', async () => {
      process.env.RESEND_API_KEY = 're_xxx';
      mockSend.mockResolvedValue({ data: {}, error: null });
      const result = await sendTeamInviteAccountCreatedEmail(
        'u@x.com',
        'Admin',
        'Workspace X',
        'https://app.com/reset-password?token=tok',
      );
      expect(result.sent).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['u@x.com'],
          subject: 'Defina sua senha – Workspace X – ProspectorAI',
        })
      );
      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('Admin');
      expect(html).toContain('Workspace X');
      expect(html).toContain('https://app.com/reset-password?token=tok');
    });
  });

  describe('sendAffiliateApprovedEmail', () => {
    it('sends email with affiliate code and login URL', async () => {
      process.env.RESEND_API_KEY = 're_xxx';
      mockSend.mockResolvedValue({ data: {}, error: null });
      const result = await sendAffiliateApprovedEmail('a@b.com', 'AFF01', 'https://app.com/login');
      expect(result.sent).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['a@b.com'],
          subject: 'Sua conta de afiliado foi aprovada – ProspectorAI',
        })
      );
      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('AFF01');
      expect(html).toContain('https://app.com/login');
    });
  });

  describe('sendAffiliateConversionEmail', () => {
    it('sends email with conversion summary and dashboard URL', async () => {
      process.env.RESEND_API_KEY = 're_xxx';
      mockSend.mockResolvedValue({ data: {}, error: null });
      const result = await sendAffiliateConversionEmail('a@b.com', 'Cliente X assinou Pro.', 'https://app.com/affiliate');
      expect(result.sent).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['a@b.com'],
          subject: 'Nova conversão no programa de afiliados – ProspectorAI',
        })
      );
      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('Cliente X assinou Pro.');
      expect(html).toContain('https://app.com/affiliate');
    });
  });

  describe('sendAffiliateCommissionPaidEmail', () => {
    it('sends email with amount and payout info', async () => {
      process.env.RESEND_API_KEY = 're_xxx';
      mockSend.mockResolvedValue({ data: {}, error: null });
      const result = await sendAffiliateCommissionPaidEmail('a@b.com', 'R$ 100,00', 'PIX 123');
      expect(result.sent).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['a@b.com'],
          subject: 'Comissão paga – ProspectorAI',
        })
      );
      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('R$ 100,00');
      expect(html).toContain('PIX 123');
    });
  });

  describe('sendAffiliateCommissionAvailableEmail', () => {
    it('sends email with dashboard URL', async () => {
      process.env.RESEND_API_KEY = 're_xxx';
      mockSend.mockResolvedValue({ data: {}, error: null });
      const result = await sendAffiliateCommissionAvailableEmail('a@b.com', 'https://app.com/affiliate/dashboard');
      expect(result.sent).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['a@b.com'],
          subject: 'Comissão disponível para saque – ProspectorAI',
        })
      );
      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('https://app.com/affiliate/dashboard');
    });
  });

  describe('getEmailConfigFromDb error fallback', () => {
    it('falls back to env when findFirst throws', async () => {
      prisma.emailConfig.findFirst.mockRejectedValue(new Error('DB unavailable'));
      process.env.RESEND_API_KEY = 're_xxx';
      mockSend.mockResolvedValue({ data: {}, error: null });
      const mod = await import('@/lib/email');
      const result = await mod.sendEmail('a@b.com', 'Hi', '<p>Hi</p>');
      expect(result.sent).toBe(true);
      expect(mockSend).toHaveBeenCalled();
    });
  });
});
