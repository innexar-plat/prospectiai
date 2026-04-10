import { z } from 'zod';

// ── Template Types ─────────────────────────────────────────────

export const EmailTemplateType = {
  PROMOTION: 'PROMOTION',
  WEEKLY_REPORT: 'WEEKLY_REPORT',
  FEATURE_ANNOUNCEMENT: 'FEATURE_ANNOUNCEMENT',
  REENGAGEMENT: 'REENGAGEMENT',
  CUSTOM: 'CUSTOM',
} as const;

export const EmailTemplateStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export const emailTemplateBodySchema = z.object({
  paragraphs: z.array(z.string()).min(1),
  benefits: z.array(z.string()).optional(),
  badge: z.string().optional(),
  badgeColor: z.string().optional(),
  subtitle: z.string().optional(),
  legalNote: z.string().optional(),
  expiresAt: z.string().optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase, alphanumeric with hyphens'),
  type: z.enum(['PROMOTION', 'WEEKLY_REPORT', 'FEATURE_ANNOUNCEMENT', 'REENGAGEMENT', 'CUSTOM']),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  subject: z.string().min(1).max(500),
  preheader: z.string().max(200).optional().nullable(),
  body: emailTemplateBodySchema,
  ctaLabel: z.string().max(100).optional().nullable(),
  ctaUrl: z.string().max(1000).optional().nullable(),
  accentColor: z.string().max(20).optional().nullable(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

// ── Campaign Types ─────────────────────────────────────────────

export const EmailCampaignStatus = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  SENDING: 'SENDING',
  SENT: 'SENT',
  CANCELLED: 'CANCELLED',
} as const;

export const EmailCampaignAudience = {
  ALL: 'ALL',
  FREE: 'FREE',
  PAID: 'PAID',
  TRIAL: 'TRIAL',
  CHURNED: 'CHURNED',
  INACTIVE: 'INACTIVE',
  CUSTOM: 'CUSTOM',
} as const;

export const audienceFilterSchema = z.object({
  plans: z.array(z.string()).optional(),
  inactiveDays: z.number().int().min(1).optional(),
  minDaysSinceSignup: z.number().int().min(0).optional(),
  maxDaysSinceSignup: z.number().int().min(0).optional(),
}).optional().nullable();

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  templateId: z.string().min(1),
  audience: z.enum(['ALL', 'FREE', 'PAID', 'TRIAL', 'CHURNED', 'INACTIVE', 'CUSTOM']),
  audienceFilter: audienceFilterSchema,
  scheduledAt: z.string().datetime().optional().nullable(),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  templateId: z.string().min(1).optional(),
  audience: z.enum(['ALL', 'FREE', 'PAID', 'TRIAL', 'CHURNED', 'INACTIVE', 'CUSTOM']).optional(),
  audienceFilter: audienceFilterSchema,
  scheduledAt: z.string().datetime().optional().nullable(),
});

// ── Weekly Report Config ───────────────────────────────────────

export const updateWeeklyReportConfigSchema = z.object({
  enabled: z.boolean().optional(),
  customTitle: z.string().max(200).optional().nullable(),
  customHighlight: z.string().max(500).optional().nullable(),
  ctaLabel: z.string().max(100).optional().nullable(),
  ctaUrl: z.string().max(1000).optional().nullable(),
  footerPromo: z.string().max(500).optional().nullable(),
  sendDay: z.number().int().min(0).max(6).optional(),
  sendHour: z.number().int().min(0).max(23).optional(),
});

// ── Unsubscribe ────────────────────────────────────────────────

export const unsubscribeSchema = z.object({
  token: z.string().min(1),
  category: z.enum(['ALL', 'MARKETING', 'WEEKLY_REPORT', 'PROMOTIONS']).optional(),
});

// ── Shared ─────────────────────────────────────────────────────

export type TemplateBody = z.infer<typeof emailTemplateBodySchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type AudienceFilter = z.infer<typeof audienceFilterSchema>;

export interface CampaignStats {
  totalTemplates: number;
  activeTemplates: number;
  totalCampaigns: number;
  totalSent: number;
  totalFailed: number;
  recentCampaigns: number;
}
