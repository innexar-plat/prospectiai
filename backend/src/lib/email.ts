/**
 * E-mail sending via Resend or SMTP. Config can come from DB (admin panel) or env fallback.
 * When neither is configured, no e-mail is sent (useful for dev).
 */

import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { decryptEmailSecret } from '@/lib/email-config-encrypt';
import {
  passwordResetTemplate,
  verificationTemplate,
  teamInviteTemplate,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

const SITE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const ENV_FROM = process.env.EMAIL_FROM ?? 'Prospector <onboarding@resend.dev>';

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
  if (fromEmail && fromEmail.trim()) return fromEmail.trim();
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
  const dbResult = await sendWithDbConfig(config, from, to, subject, html);
  if (dbResult) return dbResult;
  const envKey = process.env.RESEND_API_KEY?.trim();
  if (envKey) return sendViaResend(envKey, getFromAddress(undefined), to, subject, html);
  logger.info('Email skipped (no config)', { to, subject });
  return { sent: false };
}

/**
 * Send password reset email with link. Link should point to frontend reset page with token.
 */
export async function sendPasswordResetEmail(to: string, token: string): Promise<SendResult> {
  const resetLink = `${SITE_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  const html = passwordResetTemplate(resetLink);
  return sendEmail(to, 'Redefinir sua senha – ProspectorAI', html);
}

/**
 * Send email verification link (sign-up).
 */
export async function sendVerificationEmail(to: string, token: string): Promise<SendResult> {
  const verifyLink = `${SITE_URL.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
  const html = verificationTemplate(verifyLink);
  return sendEmail(to, 'Confirme seu e-mail – ProspectorAI', html);
}

/**
 * Send team invite email with accept link. User joins workspace only after accepting.
 */
export async function sendTeamInviteEmail(
  to: string,
  inviterName: string,
  workspaceName: string,
  acceptInviteUrl: string
): Promise<SendResult> {
  const html = teamInviteTemplate(inviterName, workspaceName, acceptInviteUrl);
  return sendEmail(to, `Convite para o workspace "${workspaceName}" – ProspectorAI`, html);
}
