/**
 * Tests for email lib. Resend and Prisma are mocked; we verify behaviour (sent/not sent, params).
 * Prisma is mocked so getEmailConfigFromDb() returns null and only env fallback is used in existing tests.
 */
import { sendPasswordResetEmail, sendTeamInviteEmail, sendVerificationEmail, sendEmail } from '@/lib/email';

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
    it('builds subject and body with inviter and workspace name', async () => {
      process.env.RESEND_API_KEY = 're_xxx';
      mockSend.mockResolvedValue({ data: {}, error: null });
      const result = await sendTeamInviteEmail('m@x.com', 'Alice', 'Acme');
      expect(result.sent).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['m@x.com'],
          subject: 'Você foi adicionado ao workspace "Acme" – ProspectorAI',
        })
      );
      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain('Alice');
      expect(html).toContain('Acme');
    });
  });
});
