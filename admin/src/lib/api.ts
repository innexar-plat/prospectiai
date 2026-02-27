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

export interface AdminStats {
  users: number;
  workspaces: number;
  searchHistory: number;
  leadAnalyses: number;
  googlePlacesSearchTotal?: number;
  googlePlacesDetailsTotal?: number;
  serperRequestsTotal?: number;
  aiInputTokensTotal?: number;
  aiOutputTokensTotal?: number;
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
  plan?: 'FREE' | 'BASIC' | 'PRO' | 'BUSINESS' | 'SCALE';
  leadsLimit?: number;
}

export interface AdminUserDetail extends AdminUserListItem {
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
  plan: string;
  leadsUsed: number;
  leadsLimit: number;
  createdAt: string;
  updatedAt: string;
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
export type AiConfigProvider = 'GEMINI' | 'OPENAI' | 'CLOUDFLARE';

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

  users: (params?: AdminListParams) =>
    request<AdminListResponse<AdminUserListItem>>(`/admin/users${buildQuery(params)}`),

  user: (id: string) => request<AdminUserDetail>(`/admin/users/${id}`),

  workspaces: (params?: AdminListParams) =>
    request<AdminListResponse<AdminWorkspaceListItem>>(`/admin/workspaces${buildQuery(params)}`),

  workspace: (id: string) => request<AdminWorkspaceDetail>(`/admin/workspaces/${id}`),

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
};

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
