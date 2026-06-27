/**
 * Transactional email copy per locale (pt / en / es) and market site URLs.
 */
import type { Locale } from '@/lib/i18n/locale';
import { getSiteUrlForMarket } from '@/lib/site-url';
import {
  getVerificationEmailCopy,
  getOAuthWelcomeEmailCopy,
  getTeamInviteEmailCopy,
  getTeamInviteAccountCreatedCopy,
  getAnalysisReadyNotificationCopy,
  getAffiliateApprovedEmailCopy,
  getAffiliateConversionEmailCopy,
  getAffiliateCommissionPaidEmailCopy,
  getAffiliateCommissionAvailableEmailCopy,
  getEmailShellCopy,
} from '@/lib/i18n/messages';
import {
  verificationTemplate,
  oauthWelcomeTemplate,
  teamInviteTemplate,
  teamInviteAccountCreatedTemplate,
  notificationTemplate,
  affiliateApprovedTemplate,
  affiliateConversionTemplate,
  affiliateCommissionPaidTemplate,
  affiliateCommissionAvailableTemplate,
  buildEmailText,
} from '@/lib/email-templates';
import {
  sendVerificationEmail,
  sendOAuthWelcomeEmail,
  sendTeamInviteEmail,
  sendAffiliateApprovedEmail,
  sendAffiliateConversionEmail,
} from '@/lib/email';

const US_SITE = 'https://precisionai.innexar.app';
const BR_SITE = getSiteUrlForMarket('BR').replace(/\/$/, '');

const LOCALE_MARKERS: Record<Locale, { verification: string; oauth: string; teamInvite: string; analysis: string; affiliate: string }> = {
  pt: {
    verification: 'Confirme seu e-mail',
    oauth: 'Bem-vindo ao Precision IA',
    teamInvite: 'Aceitar convite',
    analysis: 'Sua análise está pronta',
    affiliate: 'conta de afiliado foi aprovada',
  },
  en: {
    verification: 'Confirm your email',
    oauth: 'Welcome to Precision AI',
    teamInvite: 'Accept invite',
    analysis: 'Your analysis is ready',
    affiliate: 'affiliate account was approved',
  },
  es: {
    verification: 'Confirma tu correo',
    oauth: 'Bienvenido a Precision AI',
    teamInvite: 'Aceptar invitación',
    analysis: 'Tu análisis está listo',
    affiliate: 'cuenta de afiliado fue aprobada',
  },
};

describe('transactional email i18n', () => {
  describe('messages.ts copy getters', () => {
    it.each(['pt', 'en', 'es'] as Locale[])('returns localized subjects for %s', (locale) => {
      const markers = LOCALE_MARKERS[locale];
      expect(getVerificationEmailCopy(locale).subject).toContain(markers.verification.split(' ')[0]);
      expect(getOAuthWelcomeEmailCopy(locale).subject).toContain(markers.oauth.split(' ')[0]);
      expect(getTeamInviteEmailCopy(locale).subject('Acme')).toContain('Acme');
      expect(getAnalysisReadyNotificationCopy(locale).emailSubject).toBe(markers.analysis);
      expect(getAffiliateApprovedEmailCopy(locale).title).toBeTruthy();
      expect(getAffiliateConversionEmailCopy(locale).ctaLabel).toBeTruthy();
      expect(getAffiliateCommissionPaidEmailCopy(locale).subject).toBeTruthy();
      expect(getAffiliateCommissionAvailableEmailCopy(locale).ctaLabel).toBeTruthy();
      expect(getEmailShellCopy(locale).htmlLang).toBeTruthy();
    });
  });

  describe('email-templates HTML per locale', () => {
    it.each([
      ['pt', BR_SITE],
      ['en', US_SITE],
      ['es', BR_SITE],
    ] as const)('verificationTemplate (%s) uses market site URL', (locale, siteUrl) => {
      const html = verificationTemplate('/verify?token=t', 'User', locale, siteUrl);
      expect(html).toContain(LOCALE_MARKERS[locale].verification);
      expect(html).toContain(`${siteUrl}/verify?token=t`);
      expect(html).toContain(`lang="${getEmailShellCopy(locale).htmlLang}"`);
    });

    it.each(['pt', 'en', 'es'] as Locale[])('oauthWelcomeTemplate (%s)', (locale) => {
      const siteUrl = locale === 'en' ? US_SITE : BR_SITE;
      const html = oauthWelcomeTemplate('Maria', 'Google', `${siteUrl}/dashboard`, locale, siteUrl);
      expect(html).toContain(LOCALE_MARKERS[locale].oauth);
      expect(html).toContain('Google');
      expect(html).toContain(`${siteUrl}/dashboard`);
    });

    it.each(['pt', 'en', 'es'] as Locale[])('teamInviteTemplate (%s)', (locale) => {
      const html = teamInviteTemplate('Alice', 'Team WS', '/accept-invite?token=x', undefined, locale, BR_SITE);
      expect(html).toContain(LOCALE_MARKERS[locale].teamInvite);
      expect(html).toContain('Alice');
      expect(html).toContain('Team WS');
    });

    it.each(['pt', 'en', 'es'] as Locale[])('teamInviteAccountCreatedTemplate (%s)', (locale) => {
      const html = teamInviteAccountCreatedTemplate('Admin', 'WS', '/reset?token=t', undefined, locale, BR_SITE);
      const copy = getTeamInviteAccountCreatedCopy(locale);
      expect(html).toContain(copy.ctaLabel);
    });

    it.each(['pt', 'en', 'es'] as Locale[])('notificationTemplate for analysis ready (%s)', (locale) => {
      const copy = getAnalysisReadyNotificationCopy(locale);
      const siteUrl = locale === 'en' ? US_SITE : BR_SITE;
      const html = notificationTemplate(copy.title, copy.message, '/dashboard/lead/p1', undefined, locale, siteUrl);
      expect(html).toContain(copy.title);
      expect(html).toContain(copy.message);
      expect(html).toContain(copy.ctaLabel);
    });

    it.each(['pt', 'en', 'es'] as Locale[])('affiliateApprovedTemplate (%s)', (locale) => {
      const siteUrl = locale === 'en' ? US_SITE : BR_SITE;
      const copy = getAffiliateApprovedEmailCopy(locale);
      const html = affiliateApprovedTemplate('CODE1', '/dashboard/afiliado', 'Affiliate', siteUrl, locale);
      expect(html).toContain(copy.title.replace(/[¡!]/g, ''));
      expect(html).toContain(`${siteUrl}/r/CODE1`);
    });

    it.each(['pt', 'en', 'es'] as Locale[])('affiliateConversionTemplate (%s)', (locale) => {
      const copy = getAffiliateConversionEmailCopy(locale);
      const html = affiliateConversionTemplate(copy.firstPaymentSummary, '$10', '/dashboard/afiliado', undefined, BR_SITE, locale);
      expect(html).toContain(copy.title);
      expect(html).toContain(copy.ctaLabel);
    });

    it.each(['pt', 'en', 'es'] as Locale[])('affiliateCommissionPaidTemplate (%s)', (locale) => {
      const copy = getAffiliateCommissionPaidEmailCopy(locale);
      const html = affiliateCommissionPaidTemplate('R$ 50', 'PIX', undefined, locale, BR_SITE);
      expect(html).toContain(copy.title);
    });

    it.each(['pt', 'en', 'es'] as Locale[])('affiliateCommissionAvailableTemplate (%s)', (locale) => {
      const copy = getAffiliateCommissionAvailableEmailCopy(locale);
      const html = affiliateCommissionAvailableTemplate('R$ 100', '/dashboard/afiliado', undefined, BR_SITE, locale);
      expect(html).toContain(copy.title);
      expect(html).toContain(copy.ctaLabel);
    });

    it('buildEmailText uses shell copy per locale', () => {
      const enText = buildEmailText({
        title: 'Title',
        body: ['Body'],
        userName: 'John',
        locale: 'en',
        siteUrl: US_SITE,
      });
      expect(enText).toContain('Hello');
      expect(enText).toContain('Unsubscribe');

      const esText = buildEmailText({
        title: 'Título',
        body: ['Cuerpo'],
        userName: 'María',
        locale: 'es',
        siteUrl: BR_SITE,
      });
      expect(esText).toContain('Hola');
      expect(esText).toContain('Cancelar suscripción');
    });
  });
});

const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    emailConfig: { findFirst: jest.fn().mockResolvedValue(null) },
    emailSendLog: { create: jest.fn().mockResolvedValue({ id: 'log1' }) },
  },
}));

describe('email lib localized subjects', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, RESEND_API_KEY: 're_test' };
    mockSend.mockResolvedValue({ data: {}, error: null });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it.each([
    ['en', 'US', 'Confirm your email', US_SITE],
    ['pt', 'BR', 'Confirme seu e-mail', BR_SITE],
    ['es', 'BR', 'Confirma tu correo', BR_SITE],
  ] as const)('sendVerificationEmail uses %s copy and site URL', async (locale, _market, subjectFragment, siteUrl) => {
    await sendVerificationEmail('u@x.com', 'tok', locale, siteUrl);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining(subjectFragment),
      }),
    );
    const html = String(mockSend.mock.calls[0][0].html);
    expect(html).toContain(`${siteUrl}/verify-email?token=tok`);
  });

  it('sendOAuthWelcomeEmail uses English for US market', async () => {
    await sendOAuthWelcomeEmail('u@x.com', 'John', 'google', 'US');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Welcome to Precision AI' }),
    );
    const html = String(mockSend.mock.calls[0][0].html);
    expect(html).toContain(`${US_SITE}/dashboard`);
  });

  it('sendTeamInviteEmail uses Spanish copy when locale is es', async () => {
    await sendTeamInviteEmail('m@x.com', 'Ana', 'Equipo', `${BR_SITE}/accept`, 'es', BR_SITE);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Invitación') }),
    );
    const html = String(mockSend.mock.calls[0][0].html);
    expect(html).toContain('Aceptar invitación');
  });

  it('sendAffiliateApprovedEmail uses US site for US market', async () => {
    await sendAffiliateApprovedEmail('a@b.com', 'AFF99', `${US_SITE}/dashboard/afiliado`, 'US');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('approved') }),
    );
    const html = String(mockSend.mock.calls[0][0].html);
    expect(html).toContain(`${US_SITE}/r/AFF99`);
  });

  it('sendAffiliateConversionEmail uses English for USD', async () => {
    await sendAffiliateConversionEmail('a@b.com', 'First payment', `${US_SITE}/dashboard/afiliado`, 'USD');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('conversion') }),
    );
  });
});
