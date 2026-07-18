import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import type { SendResult } from '@/lib/email';
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

/**
 * Processa a sequência de email automática:
 * 1. Inicia sequência para leads HOT/WARM sem emails enviados
 * 2. Avança leads já em sequência (se intervalo mínimo passou)
 */
export async function runEmailSequenceWorker(
  workspaceId: string,
  runId: string,
): Promise<EmailSequenceResult> {
  let emailsSent = 0;
  let leadsStarted = 0;
  let leadsAdvanced = 0;

  // Lê intervalo configurado (padrão 48h se não definido)
  const config = await prisma.autoProspeccaoConfig.findUnique({ where: { workspaceId } });
  const stepIntervalHours = config?.emailStepIntervalHours ?? 48;

  // 1. Iniciar sequência para leads HOT/WARM sem step 1 enviado
  const eligibleLeads = await prisma.prospectedLead.findMany({
    where: {
      workspaceId,
      status: { in: ['HOT', 'WARM'] },
      email: { not: null },
      emailEvents: { none: {} },
    },
    take: 30,
    orderBy: [{ status: 'desc' }, { score: 'desc' }],
  });

  for (const lead of eligibleLeads) {
    if (!lead.email) continue;
    const sent = await sendStep(lead.id, lead.email, lead.razaoSocial, 1, workspaceId);
    if (sent) {
      emailsSent++;
      leadsStarted++;
      await prisma.prospectedLead.update({
        where: { id: lead.id },
        data: { status: 'EMAILING', updatedAt: new Date() },
      });
    }
  }

  // 2. Avançar leads em sequência (step 2 e 3)
  const cutoff = new Date(Date.now() - stepIntervalHours * 60 * 60 * 1000);
  const inProgress = await prisma.prospectedLead.findMany({
    where: {
      workspaceId,
      status: 'EMAILING',
      email: { not: null },
    },
    include: {
      emailEvents: { orderBy: { step: 'desc' }, take: 1 },
    },
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
        data: {
          status: lead.status === 'EMAILING' ? 'COLD' : lead.status,
          updatedAt: new Date(),
        },
      });
      continue;
    }

    // Só avança se passou o intervalo mínimo desde o último step
    if (lastEvent.sentAt && lastEvent.sentAt < cutoff) {
      const opened = !!lastEvent.openedAt;
      const sent = await sendStep(lead.id, lead.email, lead.razaoSocial, nextStep, workspaceId, opened);
      if (sent) {
        emailsSent++;
        leadsAdvanced++;
      }
    }
  }

  // Atualizar métricas do run
  await prisma.autoProspeccaoRun.update({
    where: { id: runId },
    data: { emailsQueued: emailsSent },
  });

  return { emailsSent, leadsStarted, leadsAdvanced };
}

const BASE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://precisionia.com.br';

// ---------------------------------------------------------------------------
// Sender pool helpers (round-robin with daily limit)
// ---------------------------------------------------------------------------

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
): Promise<SendResult> {
  try {
    let result: SendResult;

    if (provider === 'resend') {
      if (!resendApiKeyEncrypted) return { sent: false, error: 'Resend API key not configured' };
      const apiKey = decryptEmailSecret(resendApiKeyEncrypted);
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({ from: fromEmail, to: [to], subject, html });
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
      await transporter.sendMail({ from: fromEmail, to, subject, html });
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
): Promise<boolean> {
  try {
    const template = await resolveTemplate(step, workspaceId, previousStepOpened);
    const subject = interpolate(template.subject, { razaoSocial });
    let bodyHtml = interpolate(template.bodyHtml, { razaoSocial });

    // Generate event ID upfront so we can embed the tracking pixel
    const eventId = crypto.randomUUID();
    const pixelUrl = `${BASE_URL}/api/track/email/open/${eventId}`;
    const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0" />`;

    // Inject pixel just before </body> (or append if no </body>)
    if (bodyHtml.includes('</body>')) {
      bodyHtml = bodyHtml.replace('</body>', `${trackingPixel}</body>`);
    } else {
      bodyHtml = bodyHtml + trackingPixel;
    }

    // Try sender pool first (round-robin), then fall back to system email config
    const poolSender = await pickSender(workspaceId);
    let result: SendResult;

    if (poolSender) {
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
      );
    } else {
      result = await sendEmail(toEmail, subject, bodyHtml);
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
    select: { id: true, subject: true, bodyHtml: true },
  });

  if (workspaceTemplate) return workspaceTemplate;

  // Fallback para template do sistema
  const systemTemplate = await prisma.autoProspeccaoTemplate.findFirst({
    where: { type: type as AutoProspTemplateType, isSystem: true },
    select: { id: true, subject: true, bodyHtml: true },
  });

  if (systemTemplate) return systemTemplate;

  // Fallback hardcoded mínimo
  return getDefaultTemplate(step);
}

function getDefaultTemplate(step: number): { id: string; subject: string; bodyHtml: string } {
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
