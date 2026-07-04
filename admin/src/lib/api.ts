/**
 * Admin panel API client.
 * Uses relative /api — same origin (Nginx or Vite proxy to Next.js backend).
 */

const BASE = '/api';

export type PanelRole = 'admin' | 'support';

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: PanelRole | null;
}

export interface MarketRevenueStats {
  total: number;
  mrr: number;
  currency: 'BRL' | 'USD';
  paidWorkspaces: number;
}

export interface MarketCountStats {
  BR: number;
  US: number;
  unknown?: number;
}

export interface AdminStats {
  users: number;
  workspaces: number;
  searchHistory: number;
  leadAnalyses: number;
  onlineUsers?: number;
  trialWorkspaces?: number;
  trialExpiredWorkspaces?: number;
  paidWorkspaces?: number;
  googlePlacesSearchTotal?: number;
  googlePlacesDetailsTotal?: number;
  serperRequestsTotal?: number;
  aiInputTokensTotal?: number;
  aiOutputTokensTotal?: number;
  usersByMarket?: MarketCountStats;
  revenueByMarket?: {
    BR: MarketRevenueStats;
    US: MarketRevenueStats;
  };
}

export interface StatsHistoryDay {
  date: string;
  users: number;
  analyses: number;
  searches: number;
  googleSearch: number;
  googleDetails: number;
  serper: number;
}

export interface StatsHistoryResponse {
  days: number;
  series: StatsHistoryDay[];
}

export interface WorkspaceUsage {
  googlePlacesSearch: number;
  googlePlacesDetails: number;
  serperRequests: number;
  aiInputTokens: number;
  aiOutputTokens: number;
}

export interface AdminUserListItem {
  id: string;
  name: string | null;
  email: string | null;
  plan: string;
  disabledAt: string | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
  _count: { workspaces: number; analyses: number; searchHistory: number };
}

export interface SupportUserListItem {
  id: string;
  name: string | null;
  email: string | null;
  plan: string;
  disabledAt: string | null;
  createdAt: string;
}

export interface SupportUserDetail {
  id: string;
  name: string | null;
  email: string | null;
  plan: string;
  disabledAt: string | null;
  createdAt: string;
  companyName?: string | null;
  productService?: string | null;
  targetAudience?: string | null;
  mainBenefit?: string | null;
  onboardingCompletedAt?: string | null;
  workspaces: Array<{ id: string; name: string | null }>;
}

export interface ResetPasswordBody {
  sendEmail?: boolean;
  temporaryPassword?: string;
}

export interface WorkspaceUpdateBody {
  plan?: 'FREE' | 'TRIAL' | 'BASIC' | 'PRO' | 'BUSINESS' | 'SCALE';
  leadsLimit?: number;
  market?: string;
}

export interface UserUpdateBody {
  market?: string;
}

export interface AdminUserDetail extends AdminUserListItem {
  market?: string;
  leadsUsed: number;
  leadsLimit: number;
  companyName: string | null;
  productService: string | null;
  targetAudience: string | null;
  mainBenefit: string | null;
  updatedAt: string;
  workspaces: Array<{ workspace: AdminWorkspaceListItem }>;
}

export interface AdminWorkspaceListItem {
  id: string;
  name: string | null;
  market?: string;
  plan: string;
  leadsUsed: number;
  leadsLimit: number;
  createdAt: string;
  updatedAt: string;
  autoProspeccaoEnabled?: boolean;
  _count: { members: number; analyses: number; searchHistory: number };
  usage?: WorkspaceUsage | null;
}

export interface AdminWorkspaceMember {
  id: string;
  user: { id: string; name: string | null; email: string | null };
}

export interface AdminWorkspaceDetail extends AdminWorkspaceListItem {
  members: AdminWorkspaceMember[];
  usage?: WorkspaceUsage | null;
}

export interface AdminLeadListItem {
  id: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null };
  workspace: { id: string; name: string | null } | null;
  lead: {
    id: string;
    placeId: string;
    name: string;
    address: string | null;
    phone: string | null;
    website: string | null;
  };
}

export interface AdminSearchHistoryListItem {
  id: string;
  textQuery: string;
  resultsCount: number | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null };
  workspace: { id: string; name: string | null };
}

export interface AdminAuditLogItem {
  id: string;
  userId: string;
  adminEmail: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export type AiConfigRole = 'lead_analysis' | 'viability';
export type AiConfigProvider = 'GEMINI' | 'OPENAI' | 'CLOUDFLARE' | 'GROQ' | 'DEEPSEEK' | 'ANTHROPIC' | 'OPENROUTER';

export interface AiConfigListItem {
  id: string;
  role: AiConfigRole;
  provider: AiConfigProvider;
  model: string;
  enabled: boolean;
  cloudflareAccountId?: string;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiConfigCreateBody {
  role: AiConfigRole;
  provider: AiConfigProvider;
  model: string;
  apiKey?: string;
  cloudflareAccountId?: string;
  enabled?: boolean;
}

export interface AiConfigUpdateBody {
  role?: AiConfigRole;
  provider?: AiConfigProvider;
  model?: string;
  apiKey?: string;
  cloudflareAccountId?: string | null;
  enabled?: boolean;
}

export interface AiRuntimeControls {
  analyzeRateLimitMax: number;
  analyzeRateLimitWindowSeconds: number;
  analyzeBulkheadMaxInFlight: number;
  analyzeBulkheadAcquireTimeoutMs: number;
  aiModelMaxInFlight: number;
  analyzeAiMaxOutputTokens: number;
  aiCircuitBreakerFailureThreshold: number;
  aiCircuitBreakerOpenMs: number;
  aiFallbackProvider: 'GEMINI' | 'CLOUDFLARE' | 'OPENROUTER';
  aiCloudflareModelsLeadAnalysis: string;
  aiCloudflareModelsViability: string;
  aiCloudflareModelsCompanyAnalysis: string;
}

export type WebSearchProvider = 'SERPER' | 'TAVILY';

export interface WebSearchConfigItem {
  id: string;
  role: AiConfigRole;
  provider: WebSearchProvider;
  maxResults: number;
  enabled: boolean;
  hasApiKey: boolean;
  updatedAt: string;
}

export interface WebSearchConfigBody {
  role: AiConfigRole;
  provider: WebSearchProvider;
  apiKey?: string;
  maxResults?: number;
  enabled?: boolean;
}

export interface PlanConfigItem {
  id: string;
  key: string;
  name: string;
  leadsLimit: number;
  priceMonthlyBrl: number;
  priceAnnualBrl: number;
  priceMonthlyUsd: number;
  priceAnnualUsd: number;
  modules: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanConfigCreateBody {
  key: string;
  name: string;
  leadsLimit?: number;
  priceMonthlyBrl?: number;
  priceAnnualBrl?: number;
  priceMonthlyUsd?: number;
  priceAnnualUsd?: number;
  modules?: string[];
  isActive?: boolean;
  sortOrder?: number;
}

export interface AdminListParams {
  limit?: number;
  offset?: number;
  workspaceId?: string;
  search?: string;
}

export interface AdminNotificationListItem {
  id: string;
  userId: string;
  workspaceId: string | null;
  title: string;
  message: string;
  type: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null };
}

export interface EmailConfigPublic {
  configured: boolean;
  provider?: 'resend' | 'smtp';
  fromEmail?: string | null;
  hasResendApiKey?: boolean;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
}

export interface EmailConfigUpdateBody {
  provider: 'resend' | 'smtp';
  apiKey?: string;
  fromEmail?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPassword?: string;
}

export interface CrmConfigPublic {
  configured: boolean;
  provider: 'rdstation' | 'agendor' | 'hubspot';
  clientId: string;
  hasClientSecret: boolean;
}

export interface CrmConfigUpdateBody {
  provider: 'rdstation' | 'agendor' | 'hubspot';
  clientId: string;
  clientSecret?: string;
}

export interface AgendorObservability {
  connectedUsers: number;
  totalUsers: number;
  percentConnected: number;
  usesEnvFallback: boolean;
}

export interface HubspotObservability {
  connectedUsers: number;
  totalUsers: number;
  percentConnected: number;
}

export interface SupportUsersParams {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface AdminListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const body = err as { error?: string; details?: string };
    const message = body.details
      ? `${body.error ?? 'Error'}: ${body.details}`
      : body.error ?? `HTTP ${res.status}`;
    const e = new Error(message) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }

  return res.json();
}

function buildQuery(params?: AdminListParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.offset != null) search.set('offset', String(params.offset));
  if (params.workspaceId) search.set('workspaceId', params.workspaceId);
  if (params.search) search.set('search', params.search);
  const q = search.toString();
  return q ? `?${q}` : '';
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch(`${BASE}/auth/csrf`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to get CSRF token');
  const data = await res.json();
  return (data as { csrfToken?: string }).csrfToken ?? (data as { token?: string }).token ?? '';
}

export const authApi = {
  session: () => request<{ user: SessionUser | null }>('/auth/session'),

  signOut: async (): Promise<void> => {
    const csrfToken = await getCsrfToken();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const callbackUrl = `${origin}/auth/signin`;
    const res = await fetch(`${BASE}/auth/signout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrfToken, callbackUrl }),
    });
    if (!res.ok) throw new Error('Logout failed');
  },
};

export const adminApi = {
  stats: () => request<AdminStats>('/admin/stats'),
  statsHistory: (days = 7) => request<StatsHistoryResponse>(`/admin/stats/history?days=${days}`),

  users: (params?: AdminListParams) =>
    request<AdminListResponse<AdminUserListItem>>(`/admin/users${buildQuery(params)}`),

  user: (id: string) => request<AdminUserDetail>(`/admin/users/${id}`),

  workspaces: (params?: AdminListParams) =>
    request<AdminListResponse<AdminWorkspaceListItem>>(`/admin/workspaces${buildQuery(params)}`),

  workspace: (id: string) => request<AdminWorkspaceDetail>(`/admin/workspaces/${id}`),

  updateUser: (id: string, body: UserUpdateBody) =>
    request<AdminUserDetail>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  resetPassword: (userId: string, body: ResetPasswordBody) =>
    request<{ message: string; devToken?: string }>(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateWorkspace: (id: string, body: WorkspaceUpdateBody) =>
    request<AdminWorkspaceDetail>(`/admin/workspaces/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  toggleAutoProspeccao: (id: string) =>
    request<{ data: { id: string; name: string | null; autoProspeccaoEnabled: boolean } }>(
      `/admin/auto-prospeccao/workspaces/${id}/toggle`,
      { method: 'POST' },
    ),

  leads: (params?: AdminListParams) =>
    request<AdminListResponse<AdminLeadListItem>>(`/admin/leads${buildQuery(params)}`),

  searchHistory: (params?: AdminListParams) =>
    request<AdminListResponse<AdminSearchHistoryListItem>>(
      `/admin/search-history${buildQuery(params)}`
    ),

  auditLogs: (params?: AdminListParams) =>
    request<AdminListResponse<AdminAuditLogItem>>(`/admin/audit-logs${buildQuery(params)}`),

  aiConfig: {
    list: () => request<{ items: AiConfigListItem[] }>('/admin/ai-config'),
    create: (body: AiConfigCreateBody) =>
      request<AiConfigListItem>('/admin/ai-config', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: AiConfigUpdateBody) =>
      request<AiConfigListItem>(`/admin/ai-config/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/admin/ai-config/${id}`, { method: 'DELETE' }),
    test: (id: string) =>
      request<{ success: boolean }>(`/admin/ai-config/${id}/test`, { method: 'POST' }),
  },

  aiRuntime: {
    get: () => request<{ controls: AiRuntimeControls }>('/admin/ai-config/runtime'),
    update: (body: Partial<AiRuntimeControls>) =>
      request<{ controls: AiRuntimeControls }>('/admin/ai-config/runtime', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
  },

  webSearchConfig: {
    list: () => request<{ items: WebSearchConfigItem[] }>('/admin/web-search-config'),
    upsert: (body: WebSearchConfigBody) =>
      request<WebSearchConfigItem>('/admin/web-search-config', { method: 'PATCH', body: JSON.stringify(body) }),
  },

  plans: {
    list: () => request<PlanConfigItem[]>('/admin/plans'),
    create: (body: PlanConfigCreateBody) =>
      request<PlanConfigItem>('/admin/plans', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<PlanConfigCreateBody>) =>
      request<PlanConfigItem>(`/admin/plans/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/admin/plans/${id}`, { method: 'DELETE' }),
  },

  email: {
    status: () => request<{ configured: boolean }>('/admin/email'),
    getConfig: () =>
      request<EmailConfigPublic>('/admin/email/config'),
    updateConfig: (body: EmailConfigUpdateBody) =>
      request<EmailConfigPublic>('/admin/email/config', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    test: (to: string) =>
      request<{ message?: string; sent?: boolean; error?: string }>('/admin/email/test', {
        method: 'POST',
        body: JSON.stringify({ to }),
      }),
  },

  crmConfig: {
    getConfig: (provider: 'rdstation' | 'agendor' | 'hubspot' = 'rdstation') => request<CrmConfigPublic>(`/admin/crm-config?provider=${provider}`),
    updateConfig: (body: CrmConfigUpdateBody) =>
      request<CrmConfigPublic>('/admin/crm-config', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  },

  agendorObservability: {
    get: () => request<AgendorObservability>('/admin/integrations/agendor/observability'),
  },

  hubspotObservability: {
    get: () => request<HubspotObservability>('/admin/integrations/hubspot/observability'),
  },

  notifications: {
    list: (params?: AdminListParams & { userId?: string; type?: string }) => {
      const search = new URLSearchParams();
      if (params?.limit != null) search.set('limit', String(params.limit));
      if (params?.offset != null) search.set('offset', String(params.offset));
      if (params?.workspaceId) search.set('workspaceId', params.workspaceId);
      if (params?.userId) search.set('userId', params.userId);
      if (params?.type) search.set('type', params.type);
      const suffix = search.toString() ? `?${search}` : '';
      return request<AdminListResponse<AdminNotificationListItem>>(`/admin/notifications${suffix}`);
    },
    sendAll: (body: { title: string; message: string; link?: string; type?: string }) =>
      request<{ sent: number }>('/admin/notifications/send-all', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
  notificationChannels: {
    list: () =>
      request<{ channels: NotificationChannelItem[] }>('/admin/notification-channels'),
    update: (body: { key: string; appEnabled?: boolean; emailEnabled?: boolean }) =>
      request<NotificationChannelItem>('/admin/notification-channels', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  },

  affiliates: (params?: { limit?: number; offset?: number; status?: string; hasPendingCommissions?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    if (params?.status) q.set('status', params.status);
    if (params?.hasPendingCommissions === true) q.set('hasPendingCommissions', 'true');
    const suffix = q.toString() ? `?${q}` : '';
    return request<{ items: AdminAffiliateListItem[]; total: number; limit: number; offset: number }>(`/admin/affiliates${suffix}`);
  },
  createAffiliate: (body: { name: string; email: string; document?: string; notes?: string }) =>
    request<{ id: string; code: string; status: string; message: string }>('/admin/affiliates', { method: 'POST', body: JSON.stringify(body) }),
  affiliate: (id: string) => request<AdminAffiliateDetail>(`/admin/affiliates/${id}`),
  updateAffiliate: (id: string, body: { status?: string; commissionRatePercent?: number; name?: string; email?: string; document?: string | null; notes?: string | null }) =>
    request<{ ok: boolean }>(`/admin/affiliates/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  markCommissionPaid: (affiliateId: string, commissionId: string, paymentProofUrl?: string | null) =>
    request<{ ok: boolean }>(`/admin/affiliates/${affiliateId}/commissions/${commissionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'PAID', ...(paymentProofUrl != null && paymentProofUrl.trim() !== '' && { paymentProofUrl: paymentProofUrl.trim() }) }),
    }),
  markCommissionsPaidBulk: (commissionIds: string[], paymentProofUrl?: string | null) =>
    request<{ ok: boolean; updated: number }>('/admin/commissions/bulk', {
      method: 'PATCH',
      body: JSON.stringify({
        commissionIds,
        status: 'PAID',
        ...(paymentProofUrl != null && paymentProofUrl.trim() !== '' && { paymentProofUrl: paymentProofUrl.trim() }),
      }),
    }),

  commissions: (params?: { limit?: number; offset?: number; status?: string; affiliateId?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    if (params?.status) q.set('status', params.status);
    if (params?.affiliateId) q.set('affiliateId', params.affiliateId);
    const suffix = q.toString() ? `?${q}` : '';
    return request<{ items: AdminCommissionListItem[]; total: number; limit: number; offset: number }>(`/admin/commissions${suffix}`);
  },
  referrals: (params?: { limit?: number; offset?: number; affiliateId?: string; converted?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    if (params?.affiliateId) q.set('affiliateId', params.affiliateId);
    if (params?.converted != null) q.set('converted', params.converted);
    const suffix = q.toString() ? `?${q}` : '';
    return request<{ items: AdminReferralListItem[]; total: number; limit: number; offset: number }>(`/admin/referrals${suffix}`);
  },

  affiliateSettings: {
    get: () => request<AffiliateSettingsPublic>('/admin/affiliate-settings'),
    update: (body: Partial<AffiliateSettingsUpdateBody>) =>
      request<AffiliateSettingsPublic>('/admin/affiliate-settings', { method: 'PATCH', body: JSON.stringify(body) }),
  },

  emailLogs: (params?: { limit?: number; offset?: number; type?: string; status?: string; email?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    if (params?.type) q.set('type', params.type);
    if (params?.status) q.set('status', params.status);
    if (params?.email) q.set('email', params.email);
    const suffix = q.toString() ? `?${q}` : '';
    return request<{ items: EmailLogItem[]; total: number; limit: number; offset: number }>(`/admin/email-logs${suffix}`);
  },
};

export interface EmailLogItem {
  id: string;
  type: string;
  email: string;
  subject: string;
  status: string;
  provider: string | null;
  error: string | null;
  createdAt: string;
}

export interface AffiliateSettingsPublic {
  id: string;
  defaultCommissionRatePercent: number;
  cookieDurationDays: number;
  commissionRule: string;
  approvalHoldDays: number;
  minPayoutCents: number;
  allowSelfSignup: boolean;
  updatedAt: string;
}

export interface AffiliateSettingsUpdateBody {
  defaultCommissionRatePercent?: number;
  cookieDurationDays?: number;
  commissionRule?: 'FIRST_PAYMENT_ONLY' | 'RECURRING';
  approvalHoldDays?: number;
  minPayoutCents?: number;
  allowSelfSignup?: boolean;
}

export interface AdminAffiliateListItem {
  id: string;
  code: string;
  status: string;
  commissionRatePercent: number;
  email: string | null;
  name: string | null;
  approvedAt: string | null;
  createdAt: string;
  referralCount: number;
  clickCount?: number;
  userId: string | null;
}

export interface AdminAffiliateDetail extends AdminAffiliateListItem {
  document?: string | null;
  notes?: string | null;
  payoutType?: string | null;
  payoutPayload?: string | null;
  referrals: Array<{ id: string; landedAt: string; signupAt: string; convertedAt: string | null; planId: string | null; valueCents: number | null }>;
  commissions: Array<{ id: string; amountCents: number; currency: string; status: string; availableAt: string; paidAt: string | null; createdAt: string; paymentProofUrl?: string | null }>;
  commissionPendingCents: number;
  commissionPaidCents: number;
}

export interface AdminCommissionListItem {
  id: string;
  affiliateId: string;
  affiliateCode: string;
  affiliateName: string | null;
  affiliateEmail: string | null;
  amountCents: number;
  currency: string;
  status: string;
  availableAt: string;
  paidAt: string | null;
  commissionType: string;
  createdAt: string;
}

export interface AdminReferralListItem {
  id: string;
  affiliateId: string;
  affiliateCode: string;
  affiliateName: string | null;
  landedAt: string;
  signupAt: string;
  convertedAt: string | null;
  planId: string | null;
  valueCents: number | null;
  emailMasked: string | null;
}

export interface NotificationChannelItem {
  key: string;
  name: string;
  appEnabled: boolean;
  emailEnabled: boolean;
}

function buildSupportUsersQuery(params?: SupportUsersParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.offset != null) search.set('offset', String(params.offset));
  if (params.search) search.set('search', params.search);
  const q = search.toString();
  return q ? `?${q}` : '';
}

export const supportApi = {
  users: (params?: SupportUsersParams) =>
    request<AdminListResponse<SupportUserListItem>>(
      `/support/users${buildSupportUsersQuery(params)}`
    ),
  user: (id: string) => request<SupportUserDetail>(`/support/users/${id}`),
  resetPassword: (userId: string, body: ResetPasswordBody) =>
    request<{ message: string; devToken?: string }>(`/support/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  activate: (id: string) =>
    request<{ ok: boolean }>(`/support/users/${id}/activate`, { method: 'PATCH' }),
  deactivate: (id: string, body?: { reason?: string }) =>
    request<{ ok: boolean }>(`/support/users/${id}/deactivate`, {
      method: 'PATCH',
      body: JSON.stringify(body ?? {}),
    }),
};

// ═══════════════════════════════════════════════════════════════
// EMAIL MARKETING
// ═══════════════════════════════════════════════════════════════

export type EmailTemplateType = 'PROMOTION' | 'WEEKLY_REPORT' | 'FEATURE_ANNOUNCEMENT' | 'REENGAGEMENT' | 'CUSTOM';
export type EmailTemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type EmailCampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELLED';
export type EmailCampaignAudience = 'ALL' | 'FREE' | 'PAID' | 'TRIAL' | 'CHURNED' | 'INACTIVE' | 'CUSTOM';

export interface EmailTemplateItem {
  id: string;
  name: string;
  slug: string;
  type: EmailTemplateType;
  status: EmailTemplateStatus;
  subject: string;
  preheader?: string | null;
  body: {
    paragraphs: string[];
    benefits?: string[];
    badge?: string;
    badgeColor?: string;
    subtitle?: string;
    legalNote?: string;
    expiresAt?: string;
  };
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  accentColor?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { campaigns: number };
}

export interface EmailTemplateCreateBody {
  name: string;
  slug: string;
  type: EmailTemplateType;
  status?: EmailTemplateStatus;
  subject: string;
  preheader?: string | null;
  body: {
    paragraphs: string[];
    benefits?: string[];
    badge?: string;
    badgeColor?: string;
    subtitle?: string;
    legalNote?: string;
    expiresAt?: string;
  };
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  accentColor?: string | null;
}

export interface EmailCampaignItem {
  id: string;
  name: string;
  templateId: string;
  template: { id: string; name: string; slug: string; type: string; subject: string };
  audience: EmailCampaignAudience;
  audienceFilter?: Record<string, unknown> | null;
  status: EmailCampaignStatus;
  scheduledAt?: string | null;
  sentAt?: string | null;
  totalRecipients: number;
  totalSent: number;
  totalFailed: number;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailCampaignCreateBody {
  name: string;
  templateId: string;
  audience: EmailCampaignAudience;
  audienceFilter?: Record<string, unknown> | null;
  scheduledAt?: string | null;
}

export interface EmailCampaignRecipientItem {
  id: string;
  campaignId: string;
  userId: string;
  email: string;
  status: string;
  sentAt?: string | null;
  error?: string | null;
}

export interface EmailMarketingStats {
  totalTemplates: number;
  activeTemplates: number;
  totalCampaigns: number;
  totalSent: number;
  totalFailed: number;
  recentCampaigns: number;
}

export interface WeeklyReportConfigItem {
  id: string;
  enabled: boolean;
  customTitle?: string | null;
  customHighlight?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  footerPromo?: string | null;
  sendDay: number;
  sendHour: number;
  updatedAt: string;
}

export const emailMarketingApi = {
  // Stats
  stats: () => request<EmailMarketingStats>('/admin/email-marketing/stats'),

  // Templates
  templates: {
    list: (params?: { type?: string; status?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.type) q.set('type', params.type);
      if (params?.status) q.set('status', params.status);
      if (params?.limit != null) q.set('limit', String(params.limit));
      if (params?.offset != null) q.set('offset', String(params.offset));
      const suffix = q.toString() ? `?${q}` : '';
      return request<{ items: EmailTemplateItem[]; total: number; limit: number; offset: number }>(
        `/admin/email-marketing/templates${suffix}`,
      );
    },
    get: (id: string) => request<{ data: EmailTemplateItem }>(`/admin/email-marketing/templates/${id}`),
    create: (body: EmailTemplateCreateBody) =>
      request<{ data: EmailTemplateItem }>('/admin/email-marketing/templates', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<EmailTemplateCreateBody>) =>
      request<{ data: EmailTemplateItem }>(`/admin/email-marketing/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/admin/email-marketing/templates/${id}`, { method: 'DELETE' }),
    preview: (id: string, userName?: string) =>
      fetch(`${BASE}/admin/email-marketing/templates/${id}/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName }),
      }).then(r => r.text()),
  },

  // Campaigns
  campaigns: {
    list: (params?: { status?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.limit != null) q.set('limit', String(params.limit));
      if (params?.offset != null) q.set('offset', String(params.offset));
      const suffix = q.toString() ? `?${q}` : '';
      return request<{ items: EmailCampaignItem[]; total: number; limit: number; offset: number }>(
        `/admin/email-marketing/campaigns${suffix}`,
      );
    },
    get: (id: string) => request<{ data: EmailCampaignItem }>(`/admin/email-marketing/campaigns/${id}`),
    create: (body: EmailCampaignCreateBody) =>
      request<{ data: EmailCampaignItem }>('/admin/email-marketing/campaigns', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<EmailCampaignCreateBody>) =>
      request<{ data: EmailCampaignItem }>(`/admin/email-marketing/campaigns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/admin/email-marketing/campaigns/${id}`, { method: 'DELETE' }),
    send: (id: string) =>
      request<{ message: string; totalRecipients?: number; totalSent?: number; totalFailed?: number }>(
        `/admin/email-marketing/campaigns/${id}/send`,
        { method: 'POST' },
      ),
    cancel: (id: string) =>
      request<{ ok: boolean; message: string }>(`/admin/email-marketing/campaigns/${id}/cancel`, {
        method: 'POST',
      }),
    recipients: (id: string, params?: { status?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.limit != null) q.set('limit', String(params.limit));
      if (params?.offset != null) q.set('offset', String(params.offset));
      const suffix = q.toString() ? `?${q}` : '';
      return request<{ items: EmailCampaignRecipientItem[]; total: number }>(
        `/admin/email-marketing/campaigns/${id}/recipients${suffix}`,
      );
    },
  },

  // Audience count
  audienceCount: (audience: string, audienceFilter?: Record<string, unknown>) =>
    request<{ count: number }>('/admin/email-marketing/audience-count', {
      method: 'POST',
      body: JSON.stringify({ audience, audienceFilter }),
    }),

  // Weekly Report
  weeklyReport: {
    get: () => request<{ data: WeeklyReportConfigItem }>('/admin/email-marketing/weekly-report'),
    update: (body: Partial<Omit<WeeklyReportConfigItem, 'id' | 'updatedAt'>>) =>
      request<{ data: WeeklyReportConfigItem }>('/admin/email-marketing/weekly-report', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    preview: () =>
      fetch(`${BASE}/admin/email-marketing/weekly-report/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      }).then(r => r.text()),
  },
};

// ─── Auto-Prospecção Admin Types ───────────────────────────────────────────────

export type AutoProspTemplateType =
  | 'HOT_COLD_INTRO' | 'HOT_FOLLOW_NO_OPEN' | 'HOT_FOLLOW_OPENED' | 'HOT_LAST_ATTEMPT'
  | 'WARM_WEEK1_EDUCATION' | 'WARM_WEEK2_VALUE' | 'WARM_WEEK3_SOCIAL' | 'WARM_WEEK4_OFFER'
  | 'CUSTOM';

export interface AutoProspTemplate {
  id: string;
  name: string;
  type: AutoProspTemplateType;
  subject: string;
  preheader: string | null;
  bodyHtml: string;
  bodyText: string | null;
  targetCnae: string | null;
  targetSegment: string | null;
  isSystem: boolean;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutoProspTemplateListResponse {
  data: AutoProspTemplate[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AutoProspSearchProfile {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  priority: number;
  cnae: string | null;
  cnaeList: unknown;
  uf: unknown;
  porte: unknown;
  hasEmail: boolean | null;
  hasPhone: boolean | null;
  minCapital: number | null;
  workspaceId: string | null;
  lastRunAt: string | null;
  totalFound: number;
  totalHot: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutoProspSearchProfileListResponse {
  data: AutoProspSearchProfile[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Auto-Prospecção Admin API ─────────────────────────────────────────────────

export interface AutoProspConfig {
  id: string;
  workspaceId: string;
  isActive: boolean;
  scheduleDays: number[];
  scheduleTimeStart: string;
  scheduleTimeEnd: string;
  searchIntervalHours: number;
  analyzeDelayMinutes: number;
  maxLeadsPerRun: number;
  maxEmailsPerDay: number;
  maxCrmPushPerDay: number;
  hotScoreMin: number;
  warmScoreMin: number;
  crmAutoSend: boolean;
  crmProvider: string | null;
  crmOwnerUserId: string | null;
  emailAutoSend: boolean;
  emailStepIntervalHours: number;
  defaultSequenceId: string | null;
  updatedAt: string;
}

export interface SenderPoolItem {
  id: string;
  workspaceId: string;
  label: string;
  provider: string;
  fromEmail: string;
  isActive: boolean;
  dailyLimit: number;
  sentToday: number;
  lastUsedAt: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  createdAt: string;
  updatedAt: string;
}

export const autoProspeccaoAdminApi = {
  templates: {
    list: (params?: { isSystem?: string; type?: string; limit?: number; page?: number }) => {
      const q = new URLSearchParams();
      if (params?.isSystem != null) q.set('isSystem', params.isSystem);
      if (params?.type) q.set('type', params.type);
      if (params?.limit != null) q.set('limit', String(params.limit));
      if (params?.page != null) q.set('page', String(params.page));
      const suffix = q.toString() ? `?${q}` : '';
      return request<AutoProspTemplateListResponse>(`/admin/auto-prospeccao/templates${suffix}`);
    },
    get: (id: string) =>
      request<{ data: AutoProspTemplate }>(`/admin/auto-prospeccao/templates/${id}`),
    create: (body: Partial<AutoProspTemplate>) =>
      request<{ data: AutoProspTemplate }>('/admin/auto-prospeccao/templates', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<AutoProspTemplate>) =>
      request<{ data: AutoProspTemplate }>(`/admin/auto-prospeccao/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/admin/auto-prospeccao/templates/${id}`, { method: 'DELETE' }),
  },

  searchProfiles: {
    list: (params?: { isSystem?: string; limit?: number; page?: number }) => {
      const q = new URLSearchParams();
      if (params?.isSystem != null) q.set('isSystem', params.isSystem);
      if (params?.limit != null) q.set('limit', String(params.limit));
      if (params?.page != null) q.set('page', String(params.page));
      const suffix = q.toString() ? `?${q}` : '';
      return request<AutoProspSearchProfileListResponse>(`/admin/auto-prospeccao/search-profiles${suffix}`);
    },
    get: (id: string) =>
      request<{ data: AutoProspSearchProfile }>(`/admin/auto-prospeccao/search-profiles/${id}`),
    create: (body: Partial<AutoProspSearchProfile>) =>
      request<{ data: AutoProspSearchProfile }>('/admin/auto-prospeccao/search-profiles', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<AutoProspSearchProfile>) =>
      request<{ data: AutoProspSearchProfile }>(`/admin/auto-prospeccao/search-profiles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/admin/auto-prospeccao/search-profiles/${id}`, { method: 'DELETE' }),
  },

  config: {
    get: (workspaceId: string) =>
      request<{ data: AutoProspConfig }>(`/admin/auto-prospeccao/config?workspaceId=${encodeURIComponent(workspaceId)}`),
    update: (workspaceId: string, body: Partial<AutoProspConfig>) =>
      request<{ data: AutoProspConfig }>(`/admin/auto-prospeccao/config?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  },

  senderPool: {
    list: (workspaceId: string) =>
      request<{ data: SenderPoolItem[] }>(
        `/admin/auto-prospeccao/sender-pool?workspaceId=${encodeURIComponent(workspaceId)}`,
      ),
    create: (body: Record<string, unknown>) =>
      request<{ data: SenderPoolItem }>('/admin/auto-prospeccao/sender-pool', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Record<string, unknown>) =>
      request<{ data: SenderPoolItem }>(`/admin/auto-prospeccao/sender-pool/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/admin/auto-prospeccao/sender-pool/${id}`, { method: 'DELETE' }),
    test: (id: string, testEmail: string) =>
      request<{ success: boolean; message: string }>(
        `/admin/auto-prospeccao/sender-pool/${id}/test`,
        { method: 'POST', body: JSON.stringify({ testEmail }) },
      ),
  },
};
