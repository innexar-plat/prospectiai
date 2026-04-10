import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { sendEmail } from '@/lib/email';
import { promotionEmailTemplate, featureAnnouncementTemplate, reengagementTemplate } from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateCampaignInput,
  UpdateCampaignInput,
  TemplateBody,
  CampaignStats,
} from '../domain/types';

const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 1200;

// ── Templates ──────────────────────────────────────────────────

export async function listTemplates(params: {
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const { type, status, limit = 20, offset = 0 } = params;
  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.emailTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      include: { _count: { select: { campaigns: true } } },
    }),
    prisma.emailTemplate.count({ where }),
  ]);

  return { items, total, limit, offset };
}

export async function getTemplate(id: string) {
  return prisma.emailTemplate.findUnique({
    where: { id },
    include: { _count: { select: { campaigns: true } } },
  });
}

export async function createTemplate(input: CreateTemplateInput, createdBy?: string) {
  return prisma.emailTemplate.create({
    data: {
      name: input.name,
      slug: input.slug,
      type: input.type,
      status: input.status ?? 'DRAFT',
      subject: input.subject,
      preheader: input.preheader ?? null,
      body: input.body as Prisma.InputJsonValue,
      ctaLabel: input.ctaLabel ?? null,
      ctaUrl: input.ctaUrl ?? null,
      accentColor: input.accentColor ?? null,
      createdBy,
    },
  });
}

export async function updateTemplate(id: string, input: UpdateTemplateInput) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.slug !== undefined) data.slug = input.slug;
  if (input.type !== undefined) data.type = input.type;
  if (input.status !== undefined) data.status = input.status;
  if (input.subject !== undefined) data.subject = input.subject;
  if (input.preheader !== undefined) data.preheader = input.preheader;
  if (input.body !== undefined) data.body = input.body as Prisma.InputJsonValue;
  if (input.ctaLabel !== undefined) data.ctaLabel = input.ctaLabel;
  if (input.ctaUrl !== undefined) data.ctaUrl = input.ctaUrl;
  if (input.accentColor !== undefined) data.accentColor = input.accentColor;

  return prisma.emailTemplate.update({ where: { id }, data });
}

export async function deleteTemplate(id: string) {
  const campaignCount = await prisma.emailCampaign.count({ where: { templateId: id } });
  if (campaignCount > 0) {
    throw new Error('Cannot delete template with associated campaigns');
  }
  return prisma.emailTemplate.delete({ where: { id } });
}

export function renderTemplatePreview(template: {
  type: string;
  subject: string;
  body: unknown;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  accentColor?: string | null;
  preheader?: string | null;
}, userName?: string): string {
  const body = template.body as TemplateBody;

  // Replace template variables like {{firstName}} in text content
  const firstName = userName?.split(/\s/)[0] ?? '';
  const replaceVars = (text: string) =>
    text
      .replace(/\{\{firstName\}\}/gi, firstName)
      .replace(/\{\{name\}\}/gi, userName ?? '')
      .replace(/\{\{appName\}\}/gi, 'PrecisionAI');
  const replaceArrayVars = (arr: string[]) => arr.map(replaceVars);

  const paragraphs = replaceArrayVars(body.paragraphs ?? []);
  const benefits = body.benefits ? replaceArrayVars(body.benefits) : undefined;
  const subtitle = body.subtitle ? replaceVars(body.subtitle) : undefined;
  const subject = replaceVars(template.subject);

  if (template.type === 'PROMOTION' || template.type === 'CUSTOM') {
    return promotionEmailTemplate({
      subject,
      badge: body.badge,
      badgeColor: body.badgeColor,
      title: subject,
      subtitle,
      bodyParagraphs: paragraphs,
      ctaLabel: template.ctaLabel ?? 'Saiba mais',
      ctaUrl: template.ctaUrl ?? '#',
      accentColor: template.accentColor ?? undefined,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      benefits,
      legalNote: body.legalNote,
    }, userName);
  }

  if (template.type === 'FEATURE_ANNOUNCEMENT') {
    return featureAnnouncementTemplate({
      featureName: subject,
      tagline: subtitle ?? '',
      description: paragraphs,
      ctaLabel: template.ctaLabel ?? 'Experimentar',
      ctaUrl: template.ctaUrl ?? '#',
      benefits,
      badge: body.badge,
    }, userName);
  }

  if (template.type === 'REENGAGEMENT') {
    return reengagementTemplate({
      inactiveDays: 30,
      highlight: paragraphs[0] ?? '',
      incentive: subtitle,
      ctaLabel: template.ctaLabel ?? 'Voltar agora',
      ctaUrl: template.ctaUrl ?? '#',
    }, userName);
  }

  // Fallback to promotion template for any other type
  return promotionEmailTemplate({
    subject,
    title: subject,
    bodyParagraphs: paragraphs,
    ctaLabel: template.ctaLabel ?? 'Saiba mais',
    ctaUrl: template.ctaUrl ?? '#',
    accentColor: template.accentColor ?? undefined,
    benefits,
  }, userName);
}

// ── Campaigns ──────────────────────────────────────────────────

export async function listCampaigns(params: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const { status, limit = 20, offset = 0 } = params;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.emailCampaign.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        template: { select: { id: true, name: true, slug: true, type: true, subject: true } },
      },
    }),
    prisma.emailCampaign.count({ where }),
  ]);

  return { items, total, limit, offset };
}

export async function getCampaign(id: string) {
  return prisma.emailCampaign.findUnique({
    where: { id },
    include: {
      template: true,
      _count: { select: { recipients: true } },
    },
  });
}

export async function createCampaign(input: CreateCampaignInput, createdBy?: string) {
  const template = await prisma.emailTemplate.findUnique({ where: { id: input.templateId } });
  if (!template) throw new Error('Template not found');

  return prisma.emailCampaign.create({
    data: {
      name: input.name,
      templateId: input.templateId,
      audience: input.audience,
      audienceFilter: input.audienceFilter as Prisma.InputJsonValue ?? undefined,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      createdBy,
    },
    include: {
      template: { select: { id: true, name: true, slug: true, type: true, subject: true } },
    },
  });
}

export async function updateCampaign(id: string, input: UpdateCampaignInput) {
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
    throw new Error('Can only edit campaigns in DRAFT or SCHEDULED status');
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.templateId !== undefined) data.templateId = input.templateId;
  if (input.audience !== undefined) data.audience = input.audience;
  if (input.audienceFilter !== undefined) data.audienceFilter = input.audienceFilter as Prisma.InputJsonValue;
  if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;

  return prisma.emailCampaign.update({
    where: { id },
    data,
    include: {
      template: { select: { id: true, name: true, slug: true, type: true, subject: true } },
    },
  });
}

export async function deleteCampaign(id: string) {
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'SENDING') {
    throw new Error('Cannot delete a campaign that is currently sending');
  }
  return prisma.emailCampaign.delete({ where: { id } });
}

export async function cancelCampaign(id: string) {
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'SCHEDULED' && campaign.status !== 'SENDING') {
    throw new Error('Can only cancel SCHEDULED or SENDING campaigns');
  }
  return prisma.emailCampaign.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
}

// ── Audience Resolution ────────────────────────────────────────

export async function resolveAudience(audience: string, audienceFilter?: Record<string, unknown> | null): Promise<number> {
  const where = buildAudienceWhere(audience, audienceFilter);
  return prisma.user.count({ where });
}

function buildAudienceWhere(audience: string, filter?: Record<string, unknown> | null): Record<string, unknown> {
  const where: Record<string, unknown> = {
    email: { not: null },
    disabledAt: null,
  };

  // Exclude users who unsubscribed from marketing or all emails
  // This will be checked per-recipient during sending

  switch (audience) {
    case 'FREE': {
      where.workspaces = {
        some: { workspace: { plan: 'FREE' } },
      };
      break;
    }
    case 'PAID': {
      where.workspaces = {
        some: {
          workspace: { plan: { in: ['BASIC', 'PRO', 'BUSINESS', 'SCALE'] } },
        },
      };
      break;
    }
    case 'TRIAL': {
      // Users with free plan, created in last 14 days
      where.workspaces = {
        some: { workspace: { plan: 'FREE' } },
      };
      where.createdAt = { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) };
      break;
    }
    case 'INACTIVE': {
      const days = (filter as Record<string, number> | null)?.inactiveDays ?? 30;
      where.updatedAt = { lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
      break;
    }
    case 'CHURNED': {
      where.disabledAt = { not: null };
      // Override the disabled check for churned users
      delete where.disabledAt;
      where.workspaces = {
        some: { workspace: { plan: 'FREE' } },
      };
      // Users who previously had a paid plan (simplification)
      break;
    }
    case 'CUSTOM': {
      if (filter) {
        const f = filter as { plans?: string[]; inactiveDays?: number; minDaysSinceSignup?: number; maxDaysSinceSignup?: number };
        if (f.plans?.length) {
          where.workspaces = { some: { workspace: { plan: { in: f.plans } } } };
        }
        if (f.minDaysSinceSignup != null) {
          where.createdAt = {
            ...(where.createdAt as Record<string, Date> ?? {}),
            lte: new Date(Date.now() - f.minDaysSinceSignup * 24 * 60 * 60 * 1000),
          };
        }
        if (f.maxDaysSinceSignup != null) {
          where.createdAt = {
            ...(where.createdAt as Record<string, Date> ?? {}),
            gte: new Date(Date.now() - f.maxDaysSinceSignup * 24 * 60 * 60 * 1000),
          };
        }
      }
      break;
    }
    // 'ALL' — no extra filter
  }

  return where;
}

// ── Campaign Send ──────────────────────────────────────────────

export async function sendCampaign(campaignId: string) {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  });

  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
    throw new Error('Campaign is not in a sendable state');
  }

  // Mark as sending
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { status: 'SENDING' },
  });

  try {
    // Resolve audience
    const where = buildAudienceWhere(
      campaign.audience,
      campaign.audienceFilter as Record<string, unknown> | null,
    );
    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true },
    });

    // Get unsubscribed emails
    const unsubscribedEmails = new Set(
      (await prisma.emailUnsubscribe.findMany({
        where: {
          email: { in: users.map(u => u.email!).filter(Boolean) },
          category: { in: ['ALL', 'MARKETING', 'PROMOTIONS'] },
        },
        select: { email: true },
      })).map(u => u.email),
    );

    // Filter out unsubscribed
    const eligibleUsers = users.filter(u => u.email && !unsubscribedEmails.has(u.email));

    // Create recipient records
    if (eligibleUsers.length > 0) {
      await prisma.emailCampaignRecipient.createMany({
        data: eligibleUsers.map(u => ({
          campaignId,
          userId: u.id,
          email: u.email!,
          status: 'PENDING' as const,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { totalRecipients: eligibleUsers.length },
    });

    // Send in batches
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
      // Check if campaign was cancelled
      const current = await prisma.emailCampaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
      });
      if (current?.status === 'CANCELLED') break;

      const batch = eligibleUsers.slice(i, i + BATCH_SIZE);

      // Send sequentially within batch to respect rate limits
      for (const user of batch) {
        try {
          const html = renderTemplatePreview(campaign.template, user.name ?? undefined);
          // Replace variables in subject line too
          const firstName = user.name?.split(/\s/)[0] ?? '';
          const subject = campaign.template.subject
            .replace(/\{\{firstName\}\}/gi, firstName)
            .replace(/\{\{name\}\}/gi, user.name ?? '');
          const result = await sendEmail(user.email!, subject, html);

          if (result.sent) {
            totalSent++;
            await prisma.emailCampaignRecipient.updateMany({
              where: { campaignId, userId: user.id },
              data: { status: 'SENT', sentAt: new Date() },
            });
          } else {
            totalFailed++;
            await prisma.emailCampaignRecipient.updateMany({
              where: { campaignId, userId: user.id },
              data: { status: 'FAILED', error: result.error },
            });
          }

          // Log
          await prisma.emailSendLog.create({
            data: {
              type: 'CAMPAIGN',
              campaignId,
              userId: user.id,
              email: user.email!,
              subject: campaign.template.subject,
              status: result.sent ? 'SENT' : 'FAILED',
              error: result.error,
            },
          });

          // Small delay between each email (250ms = max ~4/sec, under Resend's 5/sec limit)
          await new Promise(resolve => setTimeout(resolve, 250));
        } catch (err) {
          totalFailed++;
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          await prisma.emailCampaignRecipient.updateMany({
            where: { campaignId, userId: user.id },
            data: { status: 'FAILED', error: errorMsg },
          });
          logger.error('Campaign send error', { campaignId, userId: user.id, error: errorMsg });
        }
      }

      // Update totals after each batch
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { totalSent, totalFailed },
      });

      // Delay between batches (respect rate limits)
      if (i + BATCH_SIZE < eligibleUsers.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Mark as sent
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'SENT', sentAt: new Date(), totalSent, totalFailed },
    });

    logger.info('Campaign sent', { campaignId, totalSent, totalFailed });
    return { totalSent, totalFailed, totalRecipients: eligibleUsers.length };
  } catch (err) {
    logger.error('Campaign send failed', { campaignId, error: err instanceof Error ? err.message : 'Unknown' });
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'SENT', sentAt: new Date() },
    });
    throw err;
  }
}

// ── Campaign Recipients ────────────────────────────────────────

export async function getCampaignRecipients(campaignId: string, params: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const { status, limit = 50, offset = 0 } = params;
  const where: Record<string, unknown> = { campaignId };
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.emailCampaignRecipient.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.emailCampaignRecipient.count({ where }),
  ]);

  return { items, total, limit, offset };
}

// ── Stats ──────────────────────────────────────────────────────

export async function getEmailMarketingStats(): Promise<CampaignStats> {
  const [totalTemplates, activeTemplates, totalCampaigns, sentLogs, failedLogs, recentCampaigns] = await Promise.all([
    prisma.emailTemplate.count(),
    prisma.emailTemplate.count({ where: { status: 'ACTIVE' } }),
    prisma.emailCampaign.count(),
    prisma.emailSendLog.count({ where: { type: 'CAMPAIGN', status: 'SENT' } }),
    prisma.emailSendLog.count({ where: { type: 'CAMPAIGN', status: 'FAILED' } }),
    prisma.emailCampaign.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  return { totalTemplates, activeTemplates, totalCampaigns, totalSent: sentLogs, totalFailed: failedLogs, recentCampaigns };
}

// ── Weekly Report Config ───────────────────────────────────────

export async function getWeeklyReportConfig() {
  const config = await prisma.weeklyReportConfig.findFirst();
  if (!config) {
    return prisma.weeklyReportConfig.create({
      data: { enabled: false, sendDay: 1, sendHour: 9 },
    });
  }
  return config;
}

export async function updateWeeklyReportConfig(data: Record<string, unknown>) {
  const existing = await prisma.weeklyReportConfig.findFirst();
  if (existing) {
    return prisma.weeklyReportConfig.update({ where: { id: existing.id }, data });
  }
  return prisma.weeklyReportConfig.create({ data: data as { enabled: boolean; sendDay: number; sendHour: number } });
}
