/**
 * E-mail sending via Resend or SMTP. Config can come from DB (admin panel) or env fallback.
 * When neither is configured, no e-mail is sent (useful for dev).
 */

import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { decryptEmailSecret } from '@/lib/email-config-encrypt';
import type { Locale } from '@/lib/i18n/locale';
import {
  getPasswordResetEmailCopy,
  getVerificationEmailCopy,
  getOAuthWelcomeEmailCopy,
  getTeamInviteEmailCopy,
  getTeamInviteAccountCreatedCopy,
  getAffiliateApprovedEmailCopy,
  getAffiliateConversionEmailCopy,
  getAffiliateCommissionPaidEmailCopy,
  getAffiliateCommissionAvailableEmailCopy,
  localeForAffiliateCurrency,
} from '@/lib/i18n/messages';
import {
  passwordResetTemplate,
  verificationTemplate,
  oauthWelcomeTemplate,
  teamInviteTemplate,
  teamInviteAccountCreatedTemplate,
  affiliateApprovedTemplate,
  affiliateConversionTemplate,
  affiliateCommissionPaidTemplate,
  affiliateCommissionAvailableTemplate,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { alertWarning } from '@/lib/telegram-alert';
import { getSiteUrlForMarket } from '@/lib/site-url';
import { getMarketConfig, type Market } from '@/lib/market';

const DEFAULT_SITE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const ENV_FROM = process.env.EMAIL_FROM ?? 'Precision IA <noreply@precisionia.com.br>';

async function getEmailConfigFromDb(): Promise<{
  provider: string;
  resendApiKeyEncrypted: string | null;
  fromEmail: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPasswordEncrypted: string | null;
} | null> {
  try {
    const row = await prisma.emailConfig.findFirst({ orderBy: { updatedAt: 'desc' } });
    return row;
  } catch {
    return null;
  }
}

function getFromAddress(fromEmail: string | null | undefined): string {
  if (fromEmail?.trim()) return fromEmail.trim();
  return ENV_FROM;
}

export interface SendResult {
  sent: boolean;
  error?: string;
}

async function sendViaResend(apiKey: string, from: string, to: string, subject: string, html: string): Promise<SendResult> {
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from, to: [to], subject, html });
    if (error) {
      logger.warn('Resend send failed', { to, subject, error: error.message });
      return { sent: false, error: error.message };
    }
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Email send error (Resend)', { to, subject, error: message });
    return { sent: false, error: message };
  }
}

type SmtpConfig = { smtpHost: string; smtpPort: number; smtpUser: string; smtpPasswordEncrypted: string };

async function sendViaSmtp(config: SmtpConfig, from: string, to: string, subject: string, html: string): Promise<SendResult> {
  try {
    const password = decryptEmailSecret(config.smtpPasswordEncrypted);
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: password },
    });
    await transporter.sendMail({ from, to, subject, html });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Email send error (SMTP)', { to, subject, error: message });
    return { sent: false, error: message };
  }
}

/**
 * Send a raw HTML email. Uses DB config first (Resend or SMTP), then env RESEND_API_KEY.
 * Returns { sent: true } on success, { sent: false, error } on failure. Does not throw.
 */
async function sendWithDbConfig(
  config: Awaited<ReturnType<typeof getEmailConfigFromDb>>,
  from: string,
  to: string,
  subject: string,
  html: string,
): Promise<SendResult | null> {
  if (config?.provider === 'resend' && config.resendApiKeyEncrypted) {
    const key = decryptEmailSecret(config.resendApiKeyEncrypted);
    return sendViaResend(key, from, to, subject, html);
  }
  if (config?.provider === 'smtp' && config.smtpHost && config.smtpPort != null && config.smtpUser && config.smtpPasswordEncrypted) {
    return sendViaSmtp(
      { smtpHost: config.smtpHost, smtpPort: config.smtpPort, smtpUser: config.smtpUser, smtpPasswordEncrypted: config.smtpPasswordEncrypted },
      from, to, subject, html
    );
  }
  return null;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  const config = await getEmailConfigFromDb();
  const from = getFromAddress(config?.fromEmail);
  let result: SendResult;
  let provider = 'none';

  const dbResult = await sendWithDbConfig(config, from, to, subject, html);
  if (dbResult) {
    result = dbResult;
    provider = config?.provider ?? 'db';
  } else {
    const envKey = process.env.RESEND_API_KEY?.trim();
    if (envKey) {
      result = await sendViaResend(envKey, getFromAddress(undefined), to, subject, html);
      provider = 'resend';
    } else {
      logger.info('Email skipped (no config)', { to, subject });
      result = { sent: false };
    }
  }

  // Log to EmailSendLog (fire-and-forget)
  prisma.emailSendLog
    .create({
      data: {
        type: 'TRANSACTIONAL',
        email: to,
        subject,
        status: result.sent ? 'SENT' : 'FAILED',
        provider,
        error: result.error ?? null,
      },
    })
    .catch(() => {});

  // Telegram notification on failure
  if (!result.sent && result.error) {
    alertWarning('Email falhou', `Destinatário: ${to}`, {
      subject,
      provider,
      error: result.error,
    }).catch(() => {});
  }

  return result;
}

/**
 * Send password reset email with link. Link should point to frontend reset page with token.
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string,
  locale: Locale = 'pt',
  siteUrl?: string,
): Promise<SendResult> {
  const base = (siteUrl ?? DEFAULT_SITE_URL).replace(/\/$/, '');
  const resetLink = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  const copy = getPasswordResetEmailCopy(locale);
  const html = passwordResetTemplate(resetLink, undefined, locale, base);
  return sendEmail(to, copy.subject, html);
}

/**
 * Send email verification link (sign-up).
 */
export async function sendVerificationEmail(
  to: string,
  token: string,
  locale: Locale = 'pt',
  siteUrl?: string,
): Promise<SendResult> {
  const base = (siteUrl ?? DEFAULT_SITE_URL).replace(/\/$/, '');
  const verifyLink = `${base}/verify-email?token=${encodeURIComponent(token)}`;
  const copy = getVerificationEmailCopy(locale);
  const html = verificationTemplate(verifyLink, undefined, locale, base);
  return sendEmail(to, copy.subject, html);
}

/**
 * Send team invite email with accept link. User joins workspace only after accepting.
 */
export async function sendTeamInviteEmail(
  to: string,
  inviterName: string,
  workspaceName: string,
  acceptInviteUrl: string,
  locale: Locale = 'pt',
  siteUrl?: string,
): Promise<SendResult> {
  const copy = getTeamInviteEmailCopy(locale);
  const base = siteUrl?.replace(/\/$/, '');
  const html = teamInviteTemplate(inviterName, workspaceName, acceptInviteUrl, undefined, locale, base);
  return sendEmail(to, copy.subject(workspaceName), html);
}

/**
 * Send email when account was created by team invite; user must set password via link.
 */
export async function sendTeamInviteAccountCreatedEmail(
  to: string,
  inviterName: string,
  workspaceName: string,
  setPasswordUrl: string,
  locale: Locale = 'pt',
  siteUrl?: string,
): Promise<SendResult> {
  const copy = getTeamInviteAccountCreatedCopy(locale);
  const base = siteUrl?.replace(/\/$/, '');
  const html = teamInviteAccountCreatedTemplate(inviterName, workspaceName, setPasswordUrl, undefined, locale, base);
  return sendEmail(to, copy.subject(workspaceName), html);
}

export async function sendAffiliateApprovedEmail(
  to: string,
  code: string,
  loginUrl: string,
  market: Market = 'BR',
): Promise<SendResult> {
  const locale = getMarketConfig(market).defaultLocale;
  const siteUrl = getSiteUrlForMarket(market).replace(/\/$/, '');
  const copy = getAffiliateApprovedEmailCopy(locale);
  const html = affiliateApprovedTemplate(code, loginUrl, undefined, siteUrl, locale);
  return sendEmail(to, copy.subject, html);
}

export async function sendAffiliateConversionEmail(
  to: string,
  summary: string,
  dashboardUrl: string,
  currency = 'BRL',
): Promise<SendResult> {
  const market = currency.toUpperCase() === 'USD' ? 'US' : 'BR';
  const locale = localeForAffiliateCurrency(currency);
  const siteUrl = getSiteUrlForMarket(market).replace(/\/$/, '');
  const copy = getAffiliateConversionEmailCopy(locale);
  const html = affiliateConversionTemplate(summary, '', dashboardUrl, undefined, siteUrl, locale);
  return sendEmail(to, copy.subject, html);
}

export async function sendAffiliateCommissionPaidEmail(
  to: string,
  amountFormatted: string,
  payoutInfo: string,
  currency = 'BRL',
): Promise<SendResult> {
  const market = currency.toUpperCase() === 'USD' ? 'US' : 'BR';
  const locale = localeForAffiliateCurrency(currency);
  const siteUrl = getSiteUrlForMarket(market).replace(/\/$/, '');
  const copy = getAffiliateCommissionPaidEmailCopy(locale);
  const html = affiliateCommissionPaidTemplate(amountFormatted, payoutInfo, undefined, locale, siteUrl);
  return sendEmail(to, copy.subject, html);
}

/**
 * Notifica o afiliado que uma ou mais comissões estão disponíveis para saque (após aprovação pelo cron).
 */
export async function sendAffiliateCommissionAvailableEmail(
  to: string,
  dashboardUrl: string,
  currency = 'BRL',
): Promise<SendResult> {
  const market = currency.toUpperCase() === 'USD' ? 'US' : 'BR';
  const locale = localeForAffiliateCurrency(currency);
  const siteUrl = getSiteUrlForMarket(market).replace(/\/$/, '');
  const copy = getAffiliateCommissionAvailableEmailCopy(locale);
  const html = affiliateCommissionAvailableTemplate('', dashboardUrl, undefined, siteUrl, locale);
  return sendEmail(to, copy.subject, html);
}

/**
 * Optional transactional welcome for OAuth sign-up/login (non-verification).
 */
export async function sendOAuthWelcomeEmail(
  to: string,
  name: string | null | undefined,
  provider: string,
  market: Market = 'BR',
): Promise<SendResult> {
  const locale = getMarketConfig(market).defaultLocale;
  const copy = getOAuthWelcomeEmailCopy(locale);
  const firstName = (name ?? '').trim().split(' ')[0] || copy.defaultName;
  const siteUrl = getSiteUrlForMarket(market).replace(/\/$/, '');
  const dashboardUrl = `${siteUrl}/dashboard`;
  const html = oauthWelcomeTemplate(firstName, provider, dashboardUrl, locale, siteUrl);
  return sendEmail(to, copy.subject, html);
}
