/**
 * US market integration smoke (Vitest) — complements Playwright e2e/us-market.spec.ts when Playwright is unavailable.
 */
import { getSiteUrlForMarket } from '@/lib/site-url';
import { buildAffiliateDashboardUrl, marketFromCurrency } from '@/lib/affiliate';
import { getMarketConfig } from '@/lib/market';
import {
  getVerificationEmailCopy,
  getOAuthWelcomeEmailCopy,
  getTeamInviteEmailCopy,
  getAnalysisReadyNotificationCopy,
  getAffiliateApprovedEmailCopy,
  getAffiliateConversionEmailCopy,
  localeForAffiliateCurrency,
} from '@/lib/i18n/messages';

describe('US market integration (Vitest)', () => {
  it('resolves canonical US and BR site URLs', () => {
    expect(getSiteUrlForMarket('US')).toBe('https://precisionai.innexar.app');
    expect(getSiteUrlForMarket('BR')).toContain('precisionia');
  });

  it('maps USD commissions to US affiliate dashboard host', () => {
    expect(marketFromCurrency('USD')).toBe('US');
    const url = buildAffiliateDashboardUrl('USD');
    expect(url).toMatch(/^https:\/\/precisionai\.innexar\.app\/dashboard\/afiliado/);
  });

  it('uses English copy for US default locale transactional emails', () => {
    const locale = getMarketConfig('US').defaultLocale;
    expect(locale).toBe('en');
    expect(getVerificationEmailCopy(locale).subject).toContain('Confirm your email');
    expect(getOAuthWelcomeEmailCopy(locale).subject).toContain('Welcome');
    expect(getTeamInviteEmailCopy(locale).ctaLabel).toMatch(/Accept|join/i);
    expect(getAnalysisReadyNotificationCopy(locale).emailSubject).toBe('Your analysis is ready');
    expect(getAffiliateApprovedEmailCopy(locale).title).toContain('approved');
    expect(localeForAffiliateCurrency('USD')).toBe('en');
  });

  it('keeps Portuguese copy for BR market defaults', () => {
    const locale = getMarketConfig('BR').defaultLocale;
    expect(getVerificationEmailCopy(locale).subject).toContain('Confirme');
    expect(getAffiliateApprovedEmailCopy(locale).title).toContain('aprovada');
  });

  it('uses Spanish copy when locale is es', () => {
    expect(getVerificationEmailCopy('es').subject).toContain('Confirma tu correo');
    expect(getOAuthWelcomeEmailCopy('es').subject).toContain('Bienvenido');
    expect(getTeamInviteEmailCopy('es').ctaLabel).toBe('Aceptar invitación');
    expect(getAnalysisReadyNotificationCopy('es').emailSubject).toBe('Tu análisis está listo');
    expect(getAffiliateConversionEmailCopy('es').subject).toContain('conversión');
  });
});
