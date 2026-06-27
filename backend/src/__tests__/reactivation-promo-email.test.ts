import {
  buildReactivationPromoEmailHtml,
  getReactivationPromoEmailSubject,
} from '@/lib/reactivation-promo-email';
import { getReactivationPromoCheckoutUrl } from '@/lib/i18n/messages';

describe('reactivation-promo-email', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns compelling PT subject without spam patterns', () => {
    const subject = getReactivationPromoEmailSubject();
    expect(subject).toContain('PrecisionAI');
    expect(subject).toContain('R$ 59');
    expect(subject).not.toMatch(/!!!|URGENTE|CLIQUE AQUI/i);
  });

  it('generates responsive HTML with brand color and logo', () => {
    const html = buildReactivationPromoEmailHtml();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('#1047da');
    expect(html).toContain('precision-logo.png');
    expect(html).toContain('role="presentation"');
    expect(html).toContain('max-width:600px');
  });

  it('includes all required benefits and promo pricing', () => {
    const html = buildReactivationPromoEmailHtml({ userName: 'Maria' });
    expect(html).toContain('Olá, <strong');
    expect(html).toContain('Maria');
    expect(html).toContain('R$ 99');
    expect(html).toContain('R$ 59');
    expect(html).toContain('6 meses');
    expect(html).toContain('Busca inteligente de leads');
    expect(html).toContain('Análise IA por lead');
    expect(html).toContain('Concorrência, Market Intel');
    expect(html).toContain('HubSpot, RD Station e Agendor');
    expect(html).toContain('Créditos mensais');
    expect(html).toContain('suporte dedicado');
  });

  it('includes CTA to checkout with reactivation promo', () => {
    const checkoutUrl = getReactivationPromoCheckoutUrl('https://precisionia.com.br');
    const html = buildReactivationPromoEmailHtml({ checkoutUrl });
    expect(html).toContain('checkout?promo=reactivation');
    expect(html).toContain('Assinar Starter com desconto');
  });

  it('escapes HTML in user name', () => {
    const html = buildReactivationPromoEmailHtml({ userName: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes preheader and legal footer', () => {
    const html = buildReactivationPromoEmailHtml();
    expect(html).toContain('mso-hide:all');
    expect(html).toContain('Descadastrar e-mails');
    expect(html).toContain('LGPD');
    expect(html).toContain('Após o período promocional');
  });
});
