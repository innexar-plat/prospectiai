import {
  ctaButton,
  title,
  paragraph,
  muted,
  buildEmail,
  passwordResetTemplate,
  verificationTemplate,
  teamInviteTemplate,
  testEmailTemplate,
  notificationTemplate,
  paymentSuccessTemplate,
  paymentFailureTemplate,
} from '@/lib/email-templates';

describe('email-templates', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('ctaButton', () => {
    it('returns HTML with href and label', () => {
      const out = ctaButton('https://example.com/action', 'Clique aqui');
      expect(out).toContain('https://example.com/action');
      expect(out).toContain('Clique aqui');
      expect(out).toContain('<a href=');
    });
  });

  describe('title', () => {
    it('returns h1 with text', () => {
      const out = title('Título');
      expect(out).toContain('<h1');
      expect(out).toContain('Título');
    });
  });

  describe('paragraph', () => {
    it('returns p with text', () => {
      const out = paragraph('Parágrafo');
      expect(out).toContain('<p');
      expect(out).toContain('Parágrafo');
    });
  });

  describe('muted', () => {
    it('returns muted paragraph', () => {
      const out = muted('Texto menor');
      expect(out).toContain('<p');
      expect(out).toContain('Texto menor');
    });
  });

  describe('buildEmail', () => {
    it('includes title and body only', () => {
      const out = buildEmail({ title: 'T', body: ['P1', 'P2'] });
      expect(out).toContain('T');
      expect(out).toContain('P1');
      expect(out).toContain('P2');
      expect(out).toContain('<!DOCTYPE html>');
    });

    it('includes CTA when ctaHref and ctaLabel provided', () => {
      const out = buildEmail({
        title: 'T',
        body: ['P'],
        ctaHref: 'https://x.com',
        ctaLabel: 'Ir',
      });
      expect(out).toContain('https://x.com');
      expect(out).toContain('Ir');
    });

    it('includes muted when provided', () => {
      const out = buildEmail({
        title: 'T',
        body: ['P'],
        muted: 'Aviso de expiração.',
      });
      expect(out).toContain('Aviso de expiração.');
    });

    it('includes CTA and muted together', () => {
      const out = buildEmail({
        title: 'T',
        body: ['P'],
        ctaHref: '/path',
        ctaLabel: 'OK',
        muted: 'Muted',
      });
      expect(out).toContain('/path');
      expect(out).toContain('OK');
      expect(out).toContain('Muted');
    });
  });

  describe('passwordResetTemplate', () => {
    it('returns reset email with link', () => {
      const out = passwordResetTemplate('https://app.com/reset?token=abc');
      expect(out).toContain('Redefinir sua senha');
      expect(out).toContain('https://app.com/reset?token=abc');
      expect(out).toContain('Redefinir senha');
      expect(out).toContain('expira em 1 hora');
    });
  });

  describe('verificationTemplate', () => {
    it('returns verification email with link', () => {
      const out = verificationTemplate('https://app.com/verify');
      expect(out).toContain('Confirme seu e-mail');
      expect(out).toContain('https://app.com/verify');
      expect(out).toContain('Confirmar e-mail');
      expect(out).toContain('24 horas');
    });
  });

  describe('teamInviteTemplate', () => {
    it('escapes inviter and workspace and includes accept link', () => {
      const out = teamInviteTemplate('João', 'Meu Workspace', 'https://app.com/invite/xyz');
      expect(out).toContain('João');
      expect(out).toContain('Meu Workspace');
      expect(out).toContain('https://app.com/invite/xyz');
      expect(out).toContain('Aceitar convite');
    });

    it('escapes HTML in names', () => {
      const out = teamInviteTemplate('<script>', 'A & B', 'https://x.com');
      expect(out).toContain('&lt;script&gt;');
      expect(out).toContain('A &amp; B');
    });
  });

  describe('testEmailTemplate', () => {
    it('returns test email without CTA or muted', () => {
      const out = testEmailTemplate();
      expect(out).toContain('E-mail de teste');
      expect(out).toContain('painel administrativo');
    });
  });

  describe('notificationTemplate', () => {
    it('with relative linkUrl prepends base URL', () => {
      const out = notificationTemplate('Alerta', 'Mensagem aqui', '/dashboard/lead/1');
      expect(out).toContain('Alerta');
      expect(out).toContain('Mensagem aqui');
      expect(out).toContain('/dashboard/lead/1');
      expect(out).toMatch(/href="https?:\/\/[^"]+\/dashboard\/lead\/1"/);
      expect(out).toContain('Ver mais');
    });

    it('with absolute linkUrl uses as-is', () => {
      const out = notificationTemplate('T', 'Msg', 'https://other.com/path');
      expect(out).toContain('https://other.com/path');
      expect(out).toContain('Ver mais');
    });

    it('with null or undefined linkUrl has no CTA', () => {
      const out1 = notificationTemplate('T', 'Msg', null);
      expect(out1).not.toContain('Ver mais');
      const out2 = notificationTemplate('T', 'Msg', undefined);
      expect(out2).not.toContain('Ver mais');
    });

    it('escapes title and message', () => {
      const out = notificationTemplate('<b>Title</b>', 'Msg with "quotes"', null);
      expect(out).toContain('&lt;b&gt;Title&lt;/b&gt;');
      expect(out).toContain('&quot;quotes&quot;');
    });
  });

  describe('paymentSuccessTemplate', () => {
    it('with relative dashboardUrl prepends base', () => {
      const out = paymentSuccessTemplate('Starter', 100, '/dashboard');
      expect(out).toContain('Bem-vindo');
      expect(out).toContain('Starter');
      expect(out).toContain('100');
      expect(out).toMatch(/href="https?:\/\/[^"]+\/dashboard"/);
      expect(out).toContain('Acessar dashboard');
    });

    it('with dashboardUrl starting with http uses as-is', () => {
      const out = paymentSuccessTemplate('Pro', 500, 'https://custom.com/dash');
      expect(out).toContain('https://custom.com/dash');
    });

    it('with path without leading slash adds slash', () => {
      const out = paymentSuccessTemplate('Basic', 50, 'dashboard');
      expect(out).toMatch(/href="https?:\/\/[^"]+\/dashboard"/);
    });

    it('escapes plan name', () => {
      const out = paymentSuccessTemplate('Plan <script>', 10, '/d');
      expect(out).toContain('&lt;script&gt;');
    });
  });

  describe('paymentFailureTemplate', () => {
    it('with relative url prepends base', () => {
      const out = paymentFailureTemplate('/planos');
      expect(out).toContain('Pagamento não aprovado');
      expect(out).toMatch(/href="https?:\/\/[^"]+\/planos"/);
      expect(out).toContain('Ver planos');
    });

    it('with absolute url uses as-is', () => {
      const out = paymentFailureTemplate('https://pay.com/retry');
      expect(out).toContain('https://pay.com/retry');
    });

    it('with path without leading slash adds slash', () => {
      const out = paymentFailureTemplate('planos');
      expect(out).toMatch(/href="https?:\/\/[^"]+\/planos"/);
    });
  });
});
