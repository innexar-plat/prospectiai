const BASE = '/api/admin/representatives';

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

export type RepStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type RepLevel = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
export type PayoutType = 'PIX' | 'BANK_TRANSFER';
export type CommissionStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';
export type Market = 'BR' | 'US';

export interface RepresentativeListItem {
  id: string;
  name: string;
  email: string;
  level: RepLevel;
  status: RepStatus;
  creditsUsed: number;
  creditsLimit: number;
  phone?: string | null;
  region?: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string | null;
  _count?: { clients: number; commissions: number; affiliates: number };
}

export interface RepresentativeDetail {
  id: string;
  name: string;
  email: string;
  document?: string | null;
  phone?: string | null;
  region?: string | null;
  level: RepLevel;
  status: RepStatus;
  creditsUsed: number;
  creditsLimit: number;
  directCommissionPercent: number;
  affiliateOverridePercent: number;
  holdDays: number;
  payoutType?: PayoutType | null;
  payoutPayload?: string | null;
  minPayoutCents: number;
  monthlyGoal?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
  _count: { clients: number; commissions: number; affiliates: number };
  balanceCents?: number;
  currentMonthCommissionsCents?: number;
  monthlyGoalProgress?: number;
  currency?: string;
  disclosureLink?: string;
  linkClicks?: number;
  leadsCount?: number;
  activeClientsCount?: number;
}

export interface CommissionItem {
  id: string;
  source: string;
  clientId?: string | null;
  clientName?: string | null;
  amountCents: number;
  currency: string;
  percent: number;
  status: CommissionStatus;
  holdUntil?: string | null;
  paidAt?: string | null;
  paymentProofUrl?: string | null;
  createdAt: string;
}

export interface GoalItem {
  id: string;
  targetAmount: number;
  currentProgress?: number;
  month: number;
  year: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientItem {
  id: string;
  name?: string | null;
  email?: string | null;
  plan?: string | null;
  status?: string | null;
  valueCents?: number | null;
  currency?: string;
  createdAt: string;
}

export interface AffiliateLinkItem {
  id: string;
  name?: string | null;
  email?: string | null;
  code?: string | null;
  status?: string | null;
  createdAt: string;
}

export interface LevelConfig {
  level: RepLevel;
  directCommissionPercent: number;
  affiliateOverridePercent: number;
  creditsLimit: number;
  minPayoutCents: number;
  monthlyGoal: number;
}

export interface RepStats {
  totalRepresentatives: number;
  activeRepresentatives: number;
  inactiveRepresentatives: number;
  suspendedRepresentatives: number;
  totalCommissionsPaidMonth: number;
  totalCommissionsPaidYear: number;
  totalCommissionsPaidMonthCents: number;
  totalCommissionsPaidYearCents: number;
  totalClientsGenerated: number;
  totalLeads: number;
  totalActiveClients: number;
  totalLinkClicks: number;
  totalRevenueGenerated: number;
  totalRevenueGeneratedCents: number;
  byCurrency?: {
    BRL: { totalCommissionsPaidMonthCents: number; totalCommissionsPaidYearCents: number; totalRevenueGeneratedCents: number };
    USD: { totalCommissionsPaidMonthCents: number; totalCommissionsPaidYearCents: number; totalRevenueGeneratedCents: number };
  };
}

export interface RepresentativeListResponse {
  items: RepresentativeListItem[];
  total: number;
  limit: number;
  offset: number;
}

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null) search.set(key, String(value));
  }
  const q = search.toString();
  return q ? `?${q}` : '';
}

export interface CreateRepresentativeResponse {
  id: string;
  name: string;
  email: string;
  level: RepLevel;
  status: RepStatus;
  accountCreated: boolean;
  message: string;
}

export const representativesApi = {
  list: (params?: { limit?: number; offset?: number; search?: string; status?: string; level?: string }) =>
    request<RepresentativeListResponse>(`${buildQuery(params as Record<string, string | number | boolean | undefined>)}`),

  get: (id: string) =>
    request<RepresentativeDetail>(`/${id}`),

  create: (data: Record<string, unknown>) =>
    request<CreateRepresentativeResponse>('', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    request<RepresentativeDetail>(`/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deactivate: (id: string) =>
    request<{ ok: boolean }>(`/${id}`, { method: 'DELETE' }),

  getCommissions: (repId: string, params?: { limit?: number; offset?: number; status?: string }) =>
    request<{ items: CommissionItem[]; total: number; limit: number; offset: number }>(
      `/${repId}/commissions${buildQuery(params as Record<string, string | number | boolean | undefined>)}`,
    ),

  updateCommissionStatus: (commissionId: string, status: CommissionStatus, data?: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/commissions/${commissionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...data }),
    }),

  getGoals: (repId: string) =>
    request<{ items: GoalItem[] }>(`/${repId}/goals`),

  setGoal: (repId: string, data: { month: number; year: number; targetCents: number }) =>
    request<GoalItem>(`/${repId}/goals`, { method: 'POST', body: JSON.stringify(data) }),

  getClients: (repId: string, params?: { limit?: number; offset?: number }) =>
    request<{ items: ClientItem[]; total: number; limit: number; offset: number }>(
      `/${repId}/clients${buildQuery(params as Record<string, string | number | boolean | undefined>)}`,
    ),

  getAffiliates: (repId: string, params?: { limit?: number; offset?: number }) =>
    request<{ items: AffiliateLinkItem[]; total: number; limit: number; offset: number }>(
      `/${repId}/affiliates${buildQuery(params as Record<string, string | number | boolean | undefined>)}`,
    ),

  linkAffiliate: (repId: string, affiliateId: string) =>
    request<{ ok: boolean }>(`/${repId}/affiliates`, {
      method: 'POST',
      body: JSON.stringify({ affiliateId }),
    }),

  getLevelConfigs: () =>
    request<{ items: LevelConfig[] }>('/levels'),

  updateLevelConfig: (level: RepLevel, data: Partial<LevelConfig>) =>
    request<LevelConfig>(`/levels/${level}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getStats: () =>
    request<RepStats>('/stats'),
};
