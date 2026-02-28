import { z } from 'zod';

/** POST /api/auth/register */
export const registerSchema = z.object({
  email: z.email({ error: 'Invalid email' }).transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().max(200).optional().transform((s) => (s?.trim() || undefined)),
});

/** POST /api/onboarding/complete */
export const onboardingCompleteSchema = z.object({
  companyName: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  productService: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  targetAudience: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  mainBenefit: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
});

/** POST /api/search — city/state/country/radiusKm for locationBias (Places API) */
export const searchSchema = z.object({
  textQuery: z.string().min(1, 'textQuery is required').max(500),
  includedType: z.string().max(100).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  pageToken: z.string().optional(),
  hasWebsite: z.enum(['yes', 'no']).optional(),
  hasPhone: z.enum(['yes', 'no']).optional(),
  city: z.string().max(200).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  radiusKm: z.coerce.number().min(1).max(100).optional(),
});

/** POST /api/market-report */
export const marketReportSchema = z.object({
  textQuery: z.string().min(1, 'textQuery is required').max(500),
  includedType: z.string().max(100).optional(),
  pageSize: z.coerce.number().int().min(1).max(60).optional(),
  city: z.string().max(200).optional(),
  state: z.string().max(100).optional(),
});

/** POST /api/analyze — full place data improves precision (website, address, reviews). */
export const analyzeSchema = z.object({
  placeId: z.string().min(1, 'placeId is required'),
  name: z.string().min(1, 'Business name is required'),
  userProfile: z.record(z.string(), z.unknown()).optional(),
  locale: z.string().optional(),
  websiteUri: z.string().optional(),
  website: z.string().optional(),
  formattedAddress: z.string().optional(),
  address: z.string().optional(),
  nationalPhoneNumber: z.string().optional(),
  internationalPhoneNumber: z.string().optional(),
  phone: z.string().optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  reviewCount: z.number().optional(),
  types: z.array(z.string()).optional(),
  primaryType: z.string().optional(),
  businessStatus: z.string().optional(),
  reviews: z.array(z.object({
    rating: z.number(),
    text: z.object({ text: z.string() }).optional(),
    authorAttribution: z.object({ displayName: z.string() }).optional(),
    relativePublishTimeDescription: z.string().optional(),
  })).optional(),
});

/** POST /api/user/profile (personal profile only) */
export const profileSchema = z.object({
  name: z.string().max(200).optional().transform((s) => (s?.trim() || undefined)),
  phone: z.string().max(50).optional().transform((s) => (s?.trim() || undefined)),
  address: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  linkedInUrl: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  instagramUrl: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  facebookUrl: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  websiteUrl: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  image: z.string().max(2000).optional().transform((s) => (s?.trim() || undefined)),
  notifyByEmail: z.boolean().optional(),
  notifyWeeklyReport: z.boolean().optional(),
  notifyLeadAlerts: z.boolean().optional(),
});

/** POST /api/company-analysis — useProfile (default true) + optional overrides (defaults from workspace when useProfile) */
export const companyAnalysisSchema = z.object({
  useProfile: z.boolean().optional().default(true),
  companyName: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  city: z.string().max(200).optional().transform((s) => (s?.trim() || undefined)),
  state: z.string().max(100).optional().transform((s) => (s?.trim() || undefined)),
  productService: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  targetAudience: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  mainBenefit: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  address: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  websiteUrl: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  linkedInUrl: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  instagramUrl: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  facebookUrl: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
});

/** PATCH /api/workspace/current/profile (workspace/company profile) */
export const workspaceProfileSchema = z.object({
  companyName: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  productService: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  targetAudience: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  mainBenefit: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  address: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  linkedInUrl: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  instagramUrl: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  facebookUrl: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  websiteUrl: z.string().max(500).optional().transform((s) => (s?.trim() || undefined)),
  logoUrl: z.string().max(2000).optional().transform((s) => (s?.trim() || undefined)),
});

/** POST /api/billing/checkout and /api/v1/billing/checkout */
export const checkoutSchema = z.object({
  planId: z.string().min(1, 'planId is required'),
  locale: z.string().max(10).optional(),
  cycle: z.enum(['monthly', 'annual']).optional(),
  interval: z.enum(['monthly', 'annual']).optional(),
  /** Mercado Pago card token (for recurring subscription with card). Omit for PIX/boleto (Preference). */
  card_token_id: z.string().max(500).optional(),
  /** If true and current plan > target plan, schedule downgrade at period end instead of creating new checkout. */
  scheduleAtPeriodEnd: z.boolean().optional(),
});

/** POST /api/billing/schedule-downgrade — schedule plan change at end of current period (no immediate charge). */
export const scheduleDowngradeSchema = z.object({
  planId: z.enum(['FREE', 'BASIC', 'PRO', 'BUSINESS', 'SCALE'], { message: 'planId must be a valid plan key' }),
});

/** POST /api/billing/process-payment (Mercado Pago) */
export const processPaymentSchema = z.object({
  token: z.string().min(1, 'token is required'),
  issuer_id: z.string().optional(),
  payment_method_id: z.string().min(1, 'payment_method_id is required'),
  transaction_amount: z.coerce.number().positive('transaction_amount must be positive'),
  installments: z.number().int().min(1).optional(),
  payer: z.object({
    email: z.email().optional(),
    identification: z.object({ type: z.string().optional(), number: z.string().optional() }).optional(),
  }).optional(),
  planId: z.string().min(1, 'planId is required'),
  interval: z.enum(['monthly', 'annual']),
});

/** Admin list endpoints: query params limit, offset, workspaceId (optional filter) */
export const adminListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  workspaceId: z.string().min(1).optional(),
});

/** Support users list: limit, offset, search (name/email) */
export const supportUsersListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  search: z.string().min(1).max(200).optional(),
});

/** PATCH /api/support/users/[id]/deactivate body */
export const supportDeactivateSchema = z.object({
  reason: z.string().max(500).optional(),
});

/** POST /api/admin/users/[id]/reset-password and /api/support/users/[id]/reset-password */
export const adminResetPasswordSchema = z.object({
  sendEmail: z.boolean().optional(),
  temporaryPassword: z.string().min(8, 'Password must be at least 8 characters').optional(),
}).refine((d) => d.sendEmail === true || (d.temporaryPassword != null && d.temporaryPassword.length >= 8), {
  message: 'Either sendEmail true or temporaryPassword (min 8 chars) is required',
});

/** PATCH /api/admin/workspaces/[id] */
export const adminWorkspaceUpdateSchema = z.object({
  plan: z.enum(['FREE', 'BASIC', 'PRO', 'BUSINESS', 'SCALE']).optional(),
  leadsLimit: z.coerce.number().int().min(0).optional(),
});

/** POST /api/team/invite */
export const teamInviteSchema = z.object({
  email: z.email({ error: 'Valid email is required' }).transform((s) => s.trim().toLowerCase()),
});

/** POST /api/auth/forgot-password */
export const forgotSchema = z.object({
  email: z.email({ error: 'Invalid email address' }),
});

/** POST /api/auth/reset-password */
export const resetSchema = z.object({
  token: z.string().min(1, 'Token and password are required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/** POST /api/auth/2fa/verify and disable — TOTP code */
export const twoFaCodeSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must be 6 digits'),
});

/** GET /api/details — query param */
export const detailsQuerySchema = z.object({
  placeId: z.string().min(1, 'placeId is required'),
});

/** GET /api/export/leads — query params */
export const exportLeadsQuerySchema = z.object({
  format: z.enum(['json', 'csv']).optional(),
});

/** GET /api/search/history — query params */
export const searchHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/** PATCH /api/leads/[id] — body (at least one of status or isFavorite) */
export const leadStatusSchema = z
  .object({
    status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'LOST']).optional(),
    isFavorite: z.boolean().optional(),
  })
  .refine((d) => d.status !== undefined || d.isFavorite !== undefined, {
    message: 'At least one of status or isFavorite is required',
  });

/** DELETE /api/team/remove — body */
export const teamRemoveSchema = z.object({
  userIdToRemove: z.string().min(1, 'User ID to remove is required'),
});

/** POST /api/v1/analyze — same as analyze plus optional userId for external callers */
export const v1AnalyzeSchema = analyzeSchema.extend({
  userId: z.string().optional(),
});

/** POST /api/admin/ai-config — create AI provider config */
export const aiConfigCreateSchema = z.object({
  role: z.enum(['lead_analysis', 'viability']),
  provider: z.enum(['GEMINI', 'OPENAI', 'CLOUDFLARE']),
  model: z.string().min(1).max(200),
  apiKey: z.string().optional(),
  cloudflareAccountId: z.string().max(100).optional(),
  enabled: z.boolean().optional().default(true),
});

/** PATCH /api/admin/ai-config/[id] — update AI provider config */
export const aiConfigUpdateSchema = z.object({
  role: z.enum(['lead_analysis', 'viability']).optional(),
  provider: z.enum(['GEMINI', 'OPENAI', 'CLOUDFLARE']).optional(),
  model: z.string().min(1).max(200).optional(),
  apiKey: z.string().optional(),
  cloudflareAccountId: z.string().max(100).optional().nullable(),
  enabled: z.boolean().optional(),
});

/** PATCH /api/admin/web-search-config — upsert web search config by role */
export const webSearchConfigSchema = z.object({
  role: z.enum(['lead_analysis', 'viability']),
  provider: z.enum(['SERPER', 'TAVILY']),
  apiKey: z.string().optional(),
  maxResults: z.number().int().min(1).max(20).optional().default(5),
  enabled: z.boolean().optional().default(true),
});

/** Returns first Zod error message for 400 responses */
export function formatZodError(
  result: { success: false; error: z.ZodError }
): string {
  const first = result.error.issues[0];
  return first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Validation failed';
}

export type RegisterInput = z.infer<typeof registerSchema>;
export type OnboardingCompleteInput = z.infer<typeof onboardingCompleteSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type AnalyzeInput = z.infer<typeof analyzeSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
export type TeamInviteInput = z.infer<typeof teamInviteSchema>;
export type ForgotInput = z.infer<typeof forgotSchema>;
export type ResetInput = z.infer<typeof resetSchema>;
export type TwoFaCodeInput = z.infer<typeof twoFaCodeSchema>;
export type ExportLeadsQuery = z.infer<typeof exportLeadsQuerySchema>;
export type DetailsQuery = z.infer<typeof detailsQuerySchema>;
export type SearchHistoryQuery = z.infer<typeof searchHistoryQuerySchema>;
export type LeadStatusInput = z.infer<typeof leadStatusSchema>;
export type TeamRemoveInput = z.infer<typeof teamRemoveSchema>;
export type V1AnalyzeInput = z.infer<typeof v1AnalyzeSchema>;
export type AiConfigCreateInput = z.infer<typeof aiConfigCreateSchema>;
export type AiConfigUpdateInput = z.infer<typeof aiConfigUpdateSchema>;
export type WebSearchConfigInput = z.infer<typeof webSearchConfigSchema>;
