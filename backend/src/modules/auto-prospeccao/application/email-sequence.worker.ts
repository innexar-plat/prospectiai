import { prisma } from '@/lib/prisma';
import { sendEmail, type SendOptions, type SendResult } from '@/lib/email';
import { brtDayStart, domainAcceptsMail, htmlToText, isBusinessHoursBrt, isRiskyRecipient, perRunQuota, warmupDailyCap } from '@/lib/cold-email-guard';
import { logger } from '@/lib/logger';
import { decryptEmailSecret } from '@/lib/email-config-encrypt';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import type { AutoProspTemplateType } from '@prisma/client';

interface EmailSequenceResult {
  emailsSent: number;
  leadsStarted: number;
  leadsAdvanced: number;
}

const MAX_STEPS = 3;

/** How cold mail leaves: a dedicated pool sender, or the main sender under warm-up rules. */
interface SenderContext {
  mode: 'pool' | 'system';
  replyTo: string | null;
  senderName: string | null;
}

/**
 * Processa a sequência de email automática:
 * 1. Avança leads já em sequência (se intervalo mínimo passou)
 * 2. Inicia sequência para leads HOT/WARM sem emails enviados
 * Tudo dentro da cota do dia (aquecimento do remetente) e só em horário comercial.
 */
export async function runEmailSequenceWorker(
  workspaceId: string,
  runId: string,
  now = new Date(),
): Promise<EmailSequenceResult> {
  let emailsSent = 0;
  let leadsStarted = 0;
  let leadsAdvanced = 0;

  const config = await prisma.autoProspeccaoConfig.findUnique({ where: { workspaceId } });
  const stepIntervalHours = config?.emailStepIntervalHours ?? 48;

  const hasPoolSender = (await prisma.autoProspSenderPool.count({ where: { workspaceId, isActive: true } })) > 0;
  const useSystem = !hasPoolSender && config?.useSystemSender === true;
  if (!hasPoolSender && !useSystem) {
    logger.warn('email-sequence: no sender configured (pool empty, system sender off)', { workspaceId });
    return finishRun(runId, { emailsSent, leadsStarted, leadsAdvanced });
  }
  if (!isBusinessHoursBrt(now)) return finishRun(runId, { emailsSent, leadsStarted, leadsAdvanced });

  const sentToday = await prisma.prospectedLeadEmailEvent.count({
    where: { lead: { workspaceId }, sentAt: { gte: brtDayStart(now) } },
  });
  const dailyCap = useSystem
    ? warmupDailyCap(config?.systemSenderStartedAt ?? null, now, config?.maxEmailsPerDay ?? 120)
    : (config?.maxEmailsPerDay ?? 200);
  let quota = perRunQuota(dailyCap - sentToday, now);
  if (quota <= 0) return finishRun(runId, { emailsSent, leadsStarted, leadsAdvanced });

  const sender: SenderContext = {
    mode: useSystem ? 'system' : 'pool',
    replyTo: config?.replyToEmail?.trim() || null,
    senderName: config?.senderName?.trim() || null,
  };

  // 1. Follow-ups first: a started conversation is worth more than a new cold e-mail.
  const cutoff = new Date(now.getTime() - stepIntervalHours * 60 * 60 * 1000);
  const inProgress = await prisma.prospectedLead.findMany({
    where: { workspaceId, status: 'EMAILING', email: { not: null } },
    include: { emailEvents: { orderBy: { step: 'desc' }, take: 1 } },
    take: 50,
  });

  for (const lead of inProgress) {
    if (!lead.email) continue;
    const lastEvent = lead.emailEvents[0];
    if (!lastEvent) continue;

    const nextStep = lastEvent.step + 1;
    if (nextStep > MAX_STEPS) {
      // Sequência completa — mover para COLD se nunca engajou
      await prisma.prospectedLead.update({
        where: { id: lead.id },
        data: { status: lead.status === 'EMAILING' ? 'COLD' : lead.status, updatedAt: new Date() },
      });
      continue;
    }

    if (quota <= 0) break;
    // Só avança se passou o intervalo mínimo desde o último step
    if (lastEvent.sentAt && lastEvent.sentAt < cutoff) {
      const sent = await sendStep(lead.id, lead.email, lead.razaoSocial, nextStep, workspaceId, !!lastEvent.openedAt, sender);
      if (sent) {
        emailsSent++;
        leadsAdvanced++;
        quota--;
      }
    }
  }

  // 2. Novos leads HOT/WARM, filtrando destinatários de risco antes do 1º e-mail.
  if (quota > 0) {
    const eligibleLeads = await prisma.prospectedLead.findMany({
      where: { workspaceId, status: { in: ['HOT', 'WARM'] }, email: { not: null }, emailEvents: { none: {} } },
      take: 30,
      orderBy: [{ status: 'desc' }, { score: 'desc' }],
    });

    for (const lead of eligibleLeads) {
      if (quota <= 0) break;
      if (!lead.email) continue;
      const verdict = await screenRecipient(workspaceId, lead.email);
      if (verdict !== 'ok') {
        await prisma.prospectedLead.update({
          where: { id: lead.id },
          data: { status: verdict === 'no_mx' ? 'BOUNCED' : 'COLD', updatedAt: new Date() },
        });
        continue;
      }
      const sent = await sendStep(lead.id, lead.email, lead.razaoSocial, 1, workspaceId, false, sender);
      if (sent) {
        emailsSent++;
        leadsStarted++;
        quota--;
        await prisma.prospectedLead.update({
          where: { id: lead.id },
          data: { status: 'EMAILING', updatedAt: new Date() },
        });
      }
    }
  }

  if (useSystem && emailsSent > 0 && !config?.systemSenderStartedAt) {
    await prisma.autoProspeccaoConfig.update({ where: { workspaceId }, data: { systemSenderStartedAt: now } });
  }

  return finishRun(runId, { emailsSent, leadsStarted, leadsAdvanced });
}

async function finishRun(runId: string, result: EmailSequenceResult): Promise<EmailSequenceResult> {
  await prisma.autoProspeccaoRun.update({
    where: { id: runId },
    data: { emailsQueued: result.emailsSent },
  });
  return result;
}

/** Accountant/fiscal/role addresses, addresses shared by several companies and dead domains are skipped. */
async function screenRecipient(workspaceId: string, email: string): Promise<'ok' | 'risky' | 'shared' | 'no_mx'> {
  if (isRiskyRecipient(email)) return 'risky';
  const sameAddress = await prisma.prospectedLead.count({
    where: { workspaceId, email: { equals: email, mode: 'insensitive' } },
  });
  if (sameAddress > 1) return 'shared';
  if (!(await domainAcceptsMail(email))) return 'no_mx';
  return 'ok';
}

const BASE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://precisionia.com.br';

// ---------------------------------------------------------------------------
// Sender pool helpers (round-robin with daily limit)
// ---------------------------------------------------------------------------

export function buildOptOutFooter(url: string): string {
  return `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center;">`
    + `Recebeu este e-mail porque sua empresa tem cadastro público na Receita Federal. `
    + `<a href="${url}" style="color:#6b7280;text-decoration:underline;">Não quero receber mais e-mails</a>.</p>`;
}

async function pickSender(workspaceId: string) {
  // Fetch all active senders ordered by least recently used, then filter by daily limit
  // (typically very few senders per workspace, so in-memory filter is fine)
  const senders = await prisma.autoProspSenderPool.findMany({
    where: { workspaceId, isActive: true },
    orderBy: [{ lastUsedAt: 'asc' }],
  });
  return senders.find((s) => s.sentToday < s.dailyLimit) ?? null;
}

async function sendViaPoolSender(
  senderId: string,
  provider: string,
  fromEmail: string,
  resendApiKeyEncrypted: string | null,
  smtpHost: string | null,
  smtpPort: number | null,
  smtpUser: string | null,
  smtpPasswordEncrypted: string | null,
  to: string,
  subject: string,
  html: string,
  opts: SendOptions = {},
): Promise<SendResult> {
  try {
    let result: SendResult;

    if (provider === 'resend') {
      if (!resendApiKeyEncrypted) return { sent: false, error: 'Resend API key not configured' };
      const apiKey = decryptEmailSecret(resendApiKeyEncrypted);
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: fromEmail, to: [to], subject, html,
        ...(opts.text ? { text: opts.text } : {}),
        ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
        ...(opts.headers ? { headers: opts.headers } : {}),
      });
      result = error ? { sent: false, error: error.message } : { sent: true };
    } else {
      if (!smtpHost || smtpPort == null || !smtpUser || !smtpPasswordEncrypted) {
        return { sent: false, error: 'SMTP credentials incomplete' };
      }
      const password = decryptEmailSecret(smtpPasswordEncrypted);
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: password },
      });
      await transporter.sendMail({ from: fromEmail, to, subject, html, text: opts.text, replyTo: opts.replyTo, headers: opts.headers });
      result = { sent: true };
    }

    if (result.sent) {
      await prisma.autoProspSenderPool.update({
        where: { id: senderId },
        data: { sentToday: { increment: 1 }, lastUsedAt: new Date() },
      });
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('email-sequence: pool sender error', { senderId, to, error: message });
    return { sent: false, error: message };
  }
}


async function sendStep(
  leadId: string,
  toEmail: string,
  razaoSocial: string,
  step: number,
  workspaceId: string,
  previousStepOpened = false,
  sender: SenderContext = { mode: 'pool', replyTo: null, senderName: null },
): Promise<boolean> {
  try {
    const template = await resolveTemplate(step, workspaceId, previousStepOpened);
    const subject = interpolate(template.subject, { razaoSocial });
    let bodyHtml = interpolate(template.bodyHtml, { razaoSocial });

    // Generate event ID upfront so we can embed the tracking pixel
    const eventId = crypto.randomUUID();
    const pixelUrl = `${BASE_URL}/api/track/email/open/${eventId}`;
    const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0" />`;

    // Cold outreach must always carry a one-click opt-out (LGPD / anti-spam) — appended here so
    // no template can ship without it.
    const optOutUrl = `${BASE_URL}/api/track/email/optout/${eventId}`;
    const optOut = buildOptOutFooter(optOutUrl);

    // Inject opt-out + pixel just before </body> (or append if no </body>)
    if (bodyHtml.includes('</body>')) {
      bodyHtml = bodyHtml.replace('</body>', `${optOut}${trackingPixel}</body>`);
    } else {
      bodyHtml = bodyHtml + optOut + trackingPixel;
    }

    const suppressed = await prisma.emailUnsubscribe.findFirst({
      where: { email: toEmail.toLowerCase(), category: { in: ['ALL', 'MARKETING'] } },
      select: { id: true },
    });
    if (suppressed) {
      await prisma.prospectedLead.update({ where: { id: leadId }, data: { status: 'OPTED_OUT' } });
      return false;
    }

    // Multipart (HTML + text), a real Reply-To and one-click List-Unsubscribe (Gmail/Yahoo
    // bulk-sender rules): these weigh more on spam filters than the copy itself.
    const plain = template.bodyText ? interpolate(template.bodyText, { razaoSocial }) : htmlToText(bodyHtml);
    const sendOpts: SendOptions = {
      text: `${plain}\n\n--\nNão quer receber mais e-mails? ${optOutUrl}`,
      ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
      ...(sender.senderName ? { fromName: sender.senderName } : {}),
      headers: {
        'List-Unsubscribe': `<${optOutUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    };

    let result: SendResult;
    if (sender.mode === 'system') {
      result = await sendEmail(toEmail, subject, bodyHtml, sendOpts);
    } else {
      const poolSender = await pickSender(workspaceId);
      if (!poolSender) {
        logger.warn('email-sequence: pool senders at daily limit', { workspaceId, leadId });
        return false;
      }
      result = await sendViaPoolSender(
      poolSender.id,
      poolSender.provider,
      poolSender.fromEmail,
      poolSender.resendApiKeyEncrypted,
      poolSender.smtpHost,
      poolSender.smtpPort,
      poolSender.smtpUser,
      poolSender.smtpPasswordEncrypted,
      toEmail,
      subject,
      bodyHtml,
      sendOpts,
    );
    }

    if (!result.sent) {
      logger.warn('email-sequence: send failed', { leadId, step, error: result.error });
      return false;
    }

    await prisma.prospectedLeadEmailEvent.create({
      data: {
        id: eventId,
        leadId,
        step,
        subject,
        templateId: template.id,
        sentAt: new Date(),
      },
    });

    return true;
  } catch (err) {
    logger.error('email-sequence: send error', {
      leadId,
      step,
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return false;
  }
}

async function resolveTemplate(step: number, workspaceId: string, previousOpened = false) {
  // For step 2: use HOT_FOLLOW_OPENED if step 1 was opened, otherwise HOT_FOLLOW_NO_OPEN
  const typeMap: Record<number, string> = {
    1: 'HOT_COLD_INTRO',
    2: previousOpened ? 'HOT_FOLLOW_OPENED' : 'HOT_FOLLOW_NO_OPEN',
    3: 'HOT_LAST_ATTEMPT',
  };
  const type = typeMap[step] ?? 'HOT_COLD_INTRO';

  const workspaceTemplate = await prisma.autoProspeccaoTemplate.findFirst({
    where: { workspaceId, type: type as AutoProspTemplateType, isSystem: false },
    select: { id: true, subject: true, bodyHtml: true, bodyText: true },
  });

  if (workspaceTemplate) return workspaceTemplate;

  // Fallback para template do sistema
  const systemTemplate = await prisma.autoProspeccaoTemplate.findFirst({
    where: { type: type as AutoProspTemplateType, isSystem: true },
    select: { id: true, subject: true, bodyHtml: true, bodyText: true },
  });

  if (systemTemplate) return systemTemplate;

  // Fallback hardcoded mínimo
  return getDefaultTemplate(step);
}

function getDefaultTemplate(step: number): { id: string; subject: string; bodyHtml: string; bodyText?: string | null } {
  const templates: Record<number, { id: string; subject: string; bodyHtml: string }> = {
    1: {
      id: 'default_step1',
      subject: 'Oportunidade para {{razaoSocial}}',
      bodyHtml: `<p>Olá, {{razaoSocial}}!</p>
<p>Identificamos que sua empresa pode se beneficiar da nossa solução de prospecção inteligente.</p>
<p>Podemos agendar uma conversa rápida?</p>
<p>Atenciosamente,<br>Equipe Precision IA</p>`,
    },
    2: {
      id: 'default_step2',
      subject: 'Re: Oportunidade para {{razaoSocial}}',
      bodyHtml: `<p>Olá, {{razaoSocial}}!</p>
<p>Gostaria de saber se teve a oportunidade de ver nossa mensagem anterior.</p>
<p>Estamos à disposição para uma demonstração sem compromisso.</p>
<p>Atenciosamente,<br>Equipe Precision IA</p>`,
    },
    3: {
      id: 'default_step3',
      subject: 'Último contato — {{razaoSocial}}',
      bodyHtml: `<p>Olá, {{razaoSocial}}!</p>
<p>Esta é nossa última mensagem. Se tiver interesse no futuro, entre em contato conosco.</p>
<p>Atenciosamente,<br>Equipe Precision IA</p>`,
    },
  };
  return (templates[step] ?? templates[1])!;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/** Admin preview: the exact subject/HTML a step would send, with the mandatory opt-out footer. */
export async function buildStepPreview(workspaceId: string, step: number, razaoSocial: string): Promise<{ subject: string; html: string; templateId: string }> {
  const template = await resolveTemplate(step, workspaceId, false);
  const html = interpolate(template.bodyHtml, { razaoSocial });
  const footer = buildOptOutFooter(`${BASE_URL}/api/track/email/optout/preview`);
  return {
    templateId: template.id,
    subject: interpolate(template.subject, { razaoSocial }),
    html: html.includes('</body>') ? html.replace('</body>', `${footer}</body>`) : html + footer,
  };
}

