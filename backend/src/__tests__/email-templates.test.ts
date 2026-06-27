import {
  ctaButton,
  titleHtml,
  paragraph,
  mutedText,
  buildEmail,
  passwordResetTemplate,
  verificationTemplate,
  teamInviteTemplate,
  teamInviteAccountCreatedTemplate,
  testEmailTemplate,
  notificationTemplate,
  paymentSuccessTemplate,
  paymentFailureTemplate,
  affiliateApprovedTemplate,
  affiliateConversionTemplate,
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

  describe('titleHtml', () => {
    it('returns h1 with text', () => {
      const out = titleHtml('Título');
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

  describe('mutedText', () => {
    it('returns muted paragraph', () => {
      const out = mutedText('Texto menor');
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
        ctaHref: '/action',
        ctaLabel: 'Ir',
      });
      expect(out).toContain('/action');
      expect(out).toContain('Ir');
    });

    it('includes footerNote when provided', () => {
      const out = buildEmail({
        title: 'T',
        body: ['P'],
        footerNote: 'Aviso de expiração.',
      });
      expect(out).toContain('Aviso de expiração.');
    });

    it('includes CTA and footerNote together', () => {
      const out = buildEmail({
        title: 'T',
        body: ['P'],
        ctaHref: '/path',
        ctaLabel: 'OK',
        footerNote: 'Muted',
      });
      expect(out).toContain('/path');
      expect(out).toContain('OK');
      expect(out).toContain('Muted');
    });
  });

  describe('passwordResetTemplate', () => {
    it('returns reset email with link', () => {
      const out = passwordResetTemplate('/reset?token=abc');
      expect(out).toContain('Redefinir senha');
      expect(out).toContain('/reset?token=abc');
      expect(out).toContain('Redefinir senha');
      expect(out).toContain('expira em 1 hora');
    });
  });

  describe('verificationTemplate', () => {
    it('returns verification email with link', () => {
      const out = verificationTemplate('/verify');
      expect(out).toContain('Confirme seu e-mail');
      expect(out).toContain('/verify');
      expect(out).toContain('Confirmar e-mail');
      expect(out).toContain('24 horas');
    });
  });

  describe('teamInviteTemplate', () => {
    it('escapes inviter and workspace and includes accept link', () => {
      const out = teamInviteTemplate('João', 'Meu Workspace', '/invite/xyz');
      expect(out).toContain('João');
      expect(out).toContain('Meu Workspace');
      expect(out).toContain('/invite/xyz');
      expect(out).toContain('Aceitar convite');
    });

    it('escapes HTML in names', () => {
      const out = teamInviteTemplate('<script>', 'A & B', '/invite');
      expect(out).toContain('&lt;script&gt;');
      expect(out).toContain('A &amp; B');
    });
  });

  describe('teamInviteAccountCreatedTemplate', () => {
    it('returns email with set-password link and escaped names', () => {
      const out = teamInviteAccountCreatedTemplate('Admin', 'Meu Workspace', '/reset-password?token=x');
      expect(out).toContain('Sua conta foi criada');
      expect(out).toContain('Meu Workspace');
      expect(out).toContain('Admin');
      expect(out).toContain('/reset-password?token=x');
      expect(out).toContain('Definir minha senha');
      expect(out).toContain('expira em 7 dias');
    });

    it('escapes HTML in inviter and workspace', () => {
      const out = teamInviteAccountCreatedTemplate('<b>X</b>', 'A & B', '/reset-password');
      expect(out).toContain('&lt;b&gt;X&lt;&#47;b&gt;');
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
      expect(out).toMatch(/href="(https?:\/\/[^"]+\/)?\/?dashboard\/lead\/1"/);
      expect(out).toContain('Ver mais');
    });

    it('with absolute linkUrl uses as-is', () => {
      const out = notificationTemplate('T', 'Msg', '/other/path');
      expect(out).toContain('/other/path');
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
      expect(out).toContain('&lt;b&gt;Title&lt;&#47;b&gt;');
      expect(out).toContain('&quot;quotes&quot;');
    });
  });

  describe('paymentSuccessTemplate', () => {
    it('with relative dashboardUrl prepends base', () => {
      const out = paymentSuccessTemplate('Starter', 100, '/dashboard');
      expect(out).toContain('Bem-vindo');
      expect(out).toContain('Starter');
      expect(out).toContain('100');
      expect(out).toMatch(/href="(https?:\/\/[^"]+\/)?\/?dashboard"/);
      expect(out).toContain('Fazer minha primeira busca');
    });

    it('with dashboardUrl starting with http uses as-is', () => {
      const out = paymentSuccessTemplate('Pro', 500, '/dash');
      expect(out).toContain('/dash');
    });

    it('with path without leading slash adds slash', () => {
      const out = paymentSuccessTemplate('Basic', 50, 'dashboard');
      expect(out).toMatch(/href="(https?:\/\/[^"]+\/)?\/?dashboard"/);
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
      expect(out).toMatch(/href="(https?:\/\/[^"]+\/)?\/?planos"/);
      expect(out).toContain('Atualizar forma de pagamento');
    });

    it('with absolute url uses as-is', () => {
      const out = paymentFailureTemplate('/retry');
      expect(out).toContain('/retry');
    });

    it('with path without leading slash falls back to dashboard', () => {
      const out = paymentFailureTemplate('planos');
      expect(out).toMatch(/href="(https?:\/\/[^"]+)?\/dashboard"/);
    });
  });

  describe('affiliateApprovedTemplate', () => {
    it('returns email with affiliate code and login link', () => {
      const out = affiliateApprovedTemplate('AFF123', '/login');
      expect(out).toContain('Sua conta de afiliado foi aprovada');
      expect(out).toContain('AFF123');
      expect(out).toContain('/login');
      expect(out).toContain('Acessar painel do afiliado');
      expect(out).toContain('/r/AFF123');
    });

    it('with relative loginUrl prepends base', () => {
      const out = affiliateApprovedTemplate('CODE', '/login');
      expect(out).toMatch(/href="(https?:\/\/[^"]+)?\/login"/);
    });

    it('escapes affiliate code', () => {
      const out = affiliateApprovedTemplate('<code>', '/x');
      expect(out).toContain('&lt;code&gt;');
    });


    it('renders English copy when locale is en', () => {
      const out = affiliateApprovedTemplate('AFF123', '/login', undefined, 'https://precisionai.innexar.app', 'en');
      expect(out).toContain('Your affiliate account was approved');
      expect(out).toContain('Open affiliate dashboard');
      expect(out).toContain('https://precisionai.innexar.app/r/AFF123');
    });

    it('uses US siteUrl for affiliate link when provided', () => {
      const out = affiliateApprovedTemplate('AFF123', '/login', undefined, 'https://precisionai.innexar.app');
      expect(out).toContain('https://precisionai.innexar.app/r/AFF123');
    });
  });

  describe('affiliateConversionTemplate', () => {
    it('returns email with conversion summary and dashboard link', () => {
      const out = affiliateConversionTemplate('Cliente X assinou o plano Pro.', 'R$ 50,00', '/affiliate');
      expect(out).toContain('comissão gerada');
      expect(out).toContain('Cliente X assinou o plano Pro.');
      expect(out).toContain('/affiliate');
      expect(out).toContain('Ver painel');
    });

    it('with relative dashboardUrl prepends base', () => {
      const out = affiliateConversionTemplate('Summary', 'R$ 10', '/dashboard/affiliate');
      expect(out).toMatch(/href="(https?:\/\/[^"]+)?\/dashboard\/affiliate"/);
    });

    it('escapes conversion summary', () => {
      const out = affiliateConversionTemplate('<script>alert(1)</script>', 'R$ 0', '/d');
      expect(out).toContain('&lt;script&gt;alert(1)&lt;&#47;script&gt;');
    });

    it('preserves absolute US dashboard URL when siteUrl differs from env default', () => {
      const usDashboard = 'https://precisionai.innexar.app/dashboard/afiliado';
      const out = affiliateConversionTemplate('Summary', 'R$ 10', usDashboard, undefined, 'https://precisionai.innexar.app');
      expect(out).toContain(usDashboard);
      expect(out).not.toContain('URL externa bloqueada');
    });
  });
});
