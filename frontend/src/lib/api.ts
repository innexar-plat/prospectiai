/**
 * Centralized API service for the ProspectorAI frontend.
 * All requests use relative /api paths — Nginx proxies them to the Next.js backend.
 */

const BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        credentials: 'include', // send auth cookies
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/** Get CSRF token required for NextAuth credentials sign-in */
async function getCsrfToken(): Promise<string> {
    const res = await fetch(`${BASE}/auth/csrf`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to get CSRF token');
    const data = await res.json();
    return data?.csrfToken ?? data?.token ?? '';
}

export const authApi = {
    /** Get current logged-in user (null if not authenticated) */
    session: () => request<{ user: SessionUser | null }>('/auth/session'),

    /** Register a new user with email + password */
    register: (data: { email: string; password: string; name?: string }) =>
        request<{ message: string; id: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    /** Sign in with email/password (uses NextAuth credentials + CSRF) */
    signIn: async (data: { email: string; password: string; callbackUrl?: string }) => {
        const csrfToken = await getCsrfToken();
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const callbackUrl =
            data.callbackUrl && data.callbackUrl.startsWith('http')
                ? data.callbackUrl
                : data.callbackUrl
                    ? `${origin.replace(/\/$/, '')}${data.callbackUrl.startsWith('/') ? data.callbackUrl : `/${data.callbackUrl}`}`
                    : `${origin}/dashboard`;

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `${BASE}/auth/callback/credentials`;

        const addInput = (name: string, value: string) => {
            const input = document.createElement('input');
            input.name = name;
            input.type = 'hidden';
            input.value = value;
            form.appendChild(input);
        };

        addInput('csrfToken', csrfToken);
        addInput('email', data.email);
        addInput('password', data.password);
        addInput('callbackUrl', callbackUrl);

        document.body.appendChild(form);
        form.submit();
    },

    /**
     * Initiate OAuth sign-in (Google or GitHub).
     * Auth.js requires POST with CSRF token; GET with provider throws "Unsupported action".
     * Redirect after OAuth uses current origin (window.location.origin) so production must be
     * served from the canonical domain (e.g. https://prospectorai.innexar.com.br).
     */
    initiateOAuthSignIn: async (provider: 'google' | 'github', callbackPath = '/dashboard') => {
        const csrfToken = await getCsrfToken();
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const callbackUrl = origin ? `${origin.replace(/\/$/, '')}${callbackPath.startsWith('/') ? callbackPath : `/${callbackPath}`}` : '';
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `${BASE}/auth/signin/${provider}`;
        const addInput = (name: string, value: string) => {
            const input = document.createElement('input');
            input.name = name;
            input.type = 'hidden';
            input.value = value;
            form.appendChild(input);
        };
        addInput('csrfToken', csrfToken);
        addInput('callbackUrl', callbackUrl);
        document.body.appendChild(form);
        form.submit();
    },

    /** Request password reset email. POST /api/auth/forgot-password { email } */
    forgotPassword: (email: string) =>
        request<{ message: string; devToken?: string }>('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),

    /** Reset password with token from email. POST /api/auth/reset-password { token, password } */
    resetPassword: (data: { token: string; password: string }) =>
        request<{ message: string }>('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    /** Sign out — sends JSON POST with CSRF token to properly clear NextAuth session */
    signOut: async () => {
        const csrfToken = await getCsrfToken();
        const res = await fetch(`${BASE}/auth/signout`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csrfToken, callbackUrl: `${window.location.origin}/auth/signin` }),
        });
        if (!res.ok) throw new Error('Logout failed');
        return res.json();
    },
};

// ─── Search ──────────────────────────────────────────────────────────────────

export const searchApi = {
    search: (params: {
        textQuery: string;
        includedType?: string;
        hasWebsite?: string;
        hasPhone?: string;
        pageToken?: string;
        pageSize?: number;
        city?: string;
        state?: string;
        country?: string;
        radiusKm?: number;
    }) =>
        request<{ places: Place[]; nextPageToken?: string }>('/search', {
            method: 'POST',
            body: JSON.stringify(params),
        }),

    details: (placeId: string) =>
        request<PlaceDetail>(`/details?placeId=${placeId}`),

    history: (params?: { limit?: number; offset?: number }) => {
        const qs = new URLSearchParams();
        if (params?.limit) qs.set('limit', String(params.limit));
        if (params?.offset) qs.set('offset', String(params.offset));
        const suffix = qs.toString() ? `?${qs}` : '';
        return request<{ items: SearchHistoryItem[]; total: number; limit: number; offset: number }>(`/search/history${suffix}`);
    },

    historyDetail: (id: string) =>
        request<SearchHistoryItem & { resultsData?: Place[] }>(`/search/history/${id}`),

    analyze: (body: Partial<PlaceDetail> & { placeId: string; name: string; locale?: string; websiteUri?: string; website?: string; formattedAddress?: string; nationalPhoneNumber?: string; internationalPhoneNumber?: string; rating?: number; userRatingCount?: number; types?: string[]; primaryType?: string; businessStatus?: string; reviews?: Array<{ rating: number; text?: { text: string }; authorAttribution?: { displayName: string }; relativePublishTimeDescription?: string }> }) =>
        request<Analysis>('/analyze', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    marketReport: (params: { textQuery: string; includedType?: string; pageSize?: number }) =>
        request<any>('/market-report', {
            method: 'POST',
            body: JSON.stringify(params),
        }),
};

// ─── Plans (from PlanConfig, for dashboard Planos page) ───────────────────────

export interface PlanFromApi {
    key: string;
    name: string;
    leadsLimit: number;
    priceMonthlyBrl: number;
    priceAnnualBrl: number;
    modules: string[];
}

export const plansApi = {
    list: () => request<PlanFromApi[]>('/plans'),
};

// ─── Billing ─────────────────────────────────────────────────────────────────

export type CheckoutResponse =
    | { url: string; scheduled?: false }
    | { url: null; scheduled: true; message: string; pendingPlanEffectiveAt?: string };

export const billingApi = {
    checkout: (data: {
        planId: string;
        interval?: 'monthly' | 'annual';
        locale?: string;
        /** When true and current plan > target plan, schedules downgrade at period end (no redirect). */
        scheduleAtPeriodEnd?: boolean;
    }) =>
        request<CheckoutResponse>('/billing/checkout', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

// ─── Competitors ─────────────────────────────────────────────────────────────

export const competitorApi = {
    analyze: (params: { textQuery: string; includedType?: string; pageSize?: number; city?: string; state?: string; radiusKm?: number }) =>
        request<CompetitorAnalysisResult>('/competitors', {
            method: 'POST',
            body: JSON.stringify(params),
        }),
};

// ─── Viability ───────────────────────────────────────────────────────────────

/** Viability analysis mode: new business, expand/franchise, or user's own business (profile). */
export type ViabilityMode = 'new_business' | 'expand' | 'my_business';

export interface ViabilityAnalyzeParams {
    mode: ViabilityMode;
    businessType?: string;
    city: string;
    state?: string;
}

export const viabilityApi = {
    analyze: (params: ViabilityAnalyzeParams) =>
        request<ViabilityReport>('/viability', {
            method: 'POST',
            body: JSON.stringify(params),
        }),
};

// ─── Company Analysis (Análise da minha empresa) ──────────────────────────────

export interface CompanyAnalysisReport {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    reclameAquiSummary?: string;
    googlePresenceScore?: number;
    googleRating?: number;
    googleReviewCount?: number;
    googleReviewsSnippets?: string[];
    socialNetworks: {
        presence: string;
        perNetwork?: Array<{
            network: string;
            link?: string;
            found?: string;
            suggestions?: string;
        }>;
        consistency?: string;
        recommendations?: string[];
    };
    suggestedNiche?: string;
    suggestedBusinessModel?: string;
    recommendations: string[];
}

export interface CompanyAnalysisParams {
    useProfile?: boolean;
    companyName?: string;
    city?: string;
    state?: string;
    productService?: string;
    targetAudience?: string;
    mainBenefit?: string;
    address?: string;
    websiteUrl?: string;
    linkedInUrl?: string;
    instagramUrl?: string;
    facebookUrl?: string;
}

export const companyAnalysisApi = {
    run: (body?: CompanyAnalysisParams) =>
        request<CompanyAnalysisReport>('/company-analysis', {
            method: 'POST',
            body: JSON.stringify(body ?? {}),
        }),
};

// ─── Intelligence ────────────────────────────────────────────────────────────

export const intelligenceApi = {
    history: (params?: { module?: string; favoriteOnly?: boolean; limit?: number; offset?: number }) => {
        const qs = new URLSearchParams();
        if (params?.module) qs.set('module', params.module);
        if (params?.favoriteOnly === true) qs.set('favoriteOnly', 'true');
        if (params?.limit) qs.set('limit', String(params.limit));
        if (params?.offset) qs.set('offset', String(params.offset));
        const suffix = qs.toString() ? `?${qs}` : '';
        return request<{ items: IntelligenceReportItem[]; total: number }>(`/intelligence/history${suffix}`);
    },
    detail: (id: string) => request<IntelligenceReportItem & { resultsData: unknown }>(`/intelligence/history/${id}`),
    toggleFavorite: (id: string, isFavorite: boolean) =>
        request<IntelligenceReportItem & { resultsData?: unknown }>(`/intelligence/history/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ isFavorite }),
        }),
};

// ─── Activity ────────────────────────────────────────────────────────────────

export const activityApi = {
    track: (data: { action: string; metadata?: Record<string, unknown> }) =>
        request<{ ok: boolean }>('/activity', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

// ─── Notifications ───────────────────────────────────────────────────────────

export type NotificationType = 'INFO' | 'ALERT' | 'REMINDER' | 'SYSTEM';

export interface NotificationItem {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    link: string | null;
    readAt: string | null;
    createdAt: string;
}

export const notificationsApi = {
    list: (params?: { unreadOnly?: boolean; limit?: number }) => {
        const qs = new URLSearchParams();
        if (params?.unreadOnly === true) qs.set('unreadOnly', 'true');
        if (params?.limit != null) qs.set('limit', String(params.limit));
        const suffix = qs.toString() ? `?${qs}` : '';
        return request<{ items: NotificationItem[]; unreadCount: number; limit: number }>(`/notifications${suffix}`);
    },
    markRead: (id: string) =>
        request<{ id: string; readAt: string; link: string | null }>(`/notifications/${id}`, {
            method: 'PATCH',
        }),
};

// ─── Tags ────────────────────────────────────────────────────────────────────

export interface LeadTagItem {
    id: string;
    userId: string;
    leadId: string;
    label: string;
    color: string;
    createdAt: string;
}

export const tagsApi = {
    list: (leadId?: string) => {
        const qs = leadId ? `?leadId=${leadId}` : '';
        return request<{ tags: LeadTagItem[] }>(`/tags${qs}`);
    },
    add: (data: { leadId: string; label: string; color?: string }) =>
        request<{ tag: LeadTagItem }>('/tags', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    remove: (tagId: string) =>
        request<{ ok: boolean }>(`/tags?id=${tagId}`, { method: 'DELETE' }),
};

// ─── Leads ───────────────────────────────────────────────────────────────────

/** Lead analysis list item: backend returns LeadAnalysis with included lead. */
export interface LeadAnalysisListItem {
    id: string;
    status?: string;
    score?: number;
    summary?: string;
    isFavorite?: boolean;
    createdAt: string;
    lead: Lead;
}

export const leadsApi = {
    list: () => request<LeadAnalysisListItem[]>('/leads'),
    get: (id: string) => request<LeadAnalysisListItem>(`/leads/${id}`),
    toggleFavorite: (analysisId: string, isFavorite: boolean) =>
        request<LeadAnalysisListItem>(`/leads/${analysisId}`, {
            method: 'PATCH',
            body: JSON.stringify({ isFavorite }),
        }),
};

// ─── User ────────────────────────────────────────────────────────────────────

export const userApi = {
    me: () => request<{ user: SessionUser | null; workspaceProfile?: WorkspaceProfile | null }>('/user/me'),
    updateProfile: (data: UserProfileUpdate) =>
        request<UserProfileResponse>('/user/profile', { method: 'POST', body: JSON.stringify(data) }),
};

export interface WorkspaceProfile {
    companyName: string | null;
    productService: string | null;
    targetAudience: string | null;
    mainBenefit: string | null;
    address: string | null;
    linkedInUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    websiteUrl: string | null;
    logoUrl: string | null;
}

export const workspaceProfileApi = {
    get: () => request<WorkspaceProfile>('/workspace/current/profile'),
    update: (data: Partial<WorkspaceProfile>) =>
        request<WorkspaceProfile>('/workspace/current/profile', {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
};

// ─── Onboarding ─────────────────────────────────────────────────────────────

export const onboardingApi = {
    complete: (data: { companyName?: string; productService?: string; targetAudience?: string; mainBenefit?: string }) =>
        request<{ message: string; onboardingCompletedAt: string }>('/onboarding/complete', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionUser {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    plan: 'FREE' | 'BASIC' | 'PRO' | 'BUSINESS' | 'SCALE';
    leadsUsed: number;
    leadsLimit: number;
    companyName?: string | null;
    productService?: string | null;
    targetAudience?: string | null;
    mainBenefit?: string | null;
    /** Personal profile */
    phone?: string | null;
    address?: string | null;
    linkedInUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    websiteUrl?: string | null;
    /** When true, front must redirect to /onboarding before using dashboard. */
    requiresOnboarding?: boolean;
    twoFactorEnabled?: boolean;
    subscriptionStatus?: string | null;
    currentPeriodEnd?: string | null;
    /** End of 3-day grace period when payment failed (past_due). */
    gracePeriodEnd?: string | null;
    /** Downgrade scheduled for period end (plan to apply at pendingPlanEffectiveAt). */
    pendingPlanId?: string | null;
    pendingPlanEffectiveAt?: string | null;
    notifyByEmail?: boolean;
    notifyWeeklyReport?: boolean;
    notifyLeadAlerts?: boolean;
}

/** Payload for POST /api/user/profile (personal profile only) */
export type UserProfileUpdate = Partial<Pick<SessionUser,
    'name' | 'phone' | 'address' | 'linkedInUrl' | 'instagramUrl' | 'facebookUrl' | 'websiteUrl' | 'image'
    | 'notifyByEmail' | 'notifyWeeklyReport' | 'notifyLeadAlerts'>>;

/** Response from POST /api/user/profile */
export interface UserProfileResponse {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    phone: string | null;
    address: string | null;
    linkedInUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    websiteUrl: string | null;
    notifyByEmail: boolean;
    notifyWeeklyReport: boolean;
    notifyLeadAlerts: boolean;
}

export interface Place {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    rating?: number;
    userRatingCount?: number;
    types?: string[];
    businessStatus?: string;
}

export type PlaceDetail = Place & {
    regularOpeningHours?: unknown;
    editorialSummary?: { text: string };
};

export interface Analysis {
    placeId?: string;
    name?: string;
    score?: number;
    summary?: string;
    strengths?: string[];
    weaknesses?: string[];
    opportunities?: string[];
    /** Provider used for this analysis (e.g. GEMINI, OPENAI, CLOUDFLARE). */
    aiProvider?: string;
    [key: string]: unknown;
}

export interface Lead {
    id: string;
    placeId: string;
    name: string;
    address?: string;
    phone?: string;
    website?: string;
    rating?: number;
    reviewCount?: number;
    types?: string[];
    businessStatus?: string;
    analysis?: Analysis;
    /** When true, lead/analysis is marked as favorite (from LeadAnalysis.isFavorite). */
    isFavorite?: boolean;
    createdAt: string;
}

export interface SearchHistoryItem {
    id: string;
    textQuery: string;
    pageSize: number;
    filters?: Record<string, unknown>;
    resultsCount: number;
    resultsData?: Place[];
    createdAt: string;
    user?: { name: string | null; email: string | null };
}

export interface CompetitorRankEntry {
    position: number;
    id: string;
    name: string;
    rating?: number;
    reviewCount?: number;
}

export interface CompetitorAnalysisResult {
    totalCount: number;
    rankingByRating: CompetitorRankEntry[];
    rankingByReviews: CompetitorRankEntry[];
    digitalPresence: {
        withWebsite: number;
        withoutWebsite: number;
        withPhone: number;
        withoutPhone: number;
    };
    opportunities: Array<{ id: string; name: string; missingWebsite: boolean; missingPhone: boolean }>;
    avgRating: number | null;
    medianReviews: number;
    topOpportunities: ScoredPlace[];
    aiPlaybook: AiPlaybook | null;
}

export interface ScoredPlace {
    id: string;
    name: string;
    score: number;
    scoreFactors: Record<string, boolean>;
    formattedAddress?: string;
    phone?: string;
    website?: string;
    rating?: number;
    reviewCount?: number;
    primaryType?: string;
}

export interface AiPlaybook {
    entryBarrier: 'alto' | 'medio' | 'baixo';
    entryBarrierExplanation: string;
    marketSummary: string;
    seoChecklist: string[];
    reviewStrategy: string[];
    quickWins: string[];
}

export interface AiMarketInsights {
    executiveSummary: string;
    marketTrends: string[];
    opportunities: string[];
    recommendations: string[];
}

export interface MarketReport {
    totalBusinesses: number;
    segments: Array<{ type: string; count: number; avgRating: number | null }>;
    digitalMaturity: {
        withWebsite: number;
        withPhone: number;
        total: number;
        withWebsitePercent: number;
        withPhonePercent: number;
    };
    saturationIndex: number;
    avgRating: number | null;
    topOpportunities: ScoredPlace[];
    aiInsights: AiMarketInsights | null;
}

export interface SegmentBreakdown {
    segment: string;
    count: number;
    avgRating: number | null;
    opportunityLevel: 'alta' | 'media' | 'baixa';
}

export interface ViabilityReport {
    score: number;
    verdict: string;
    goNoGo: 'GO' | 'CAUTION' | 'NO_GO';
    summary: string;
    competitorDensity: number;
    saturationIndex: number;
    digitalMaturityPercent: number;
    strengths: string[];
    risks: string[];
    recommendations: string[];
    estimatedInvestment: string;
    bestLocations: string[];
    segmentBreakdown: SegmentBreakdown[];
    dailyLeadsTarget: number;
    suggestedOffer: string;
    suggestedTicket: string;
    topOpportunities: ScoredPlace[];
}

export interface IntelligenceReportItem {
    id: string;
    module: string;
    inputQuery: string;
    inputCity?: string;
    inputState?: string;
    isFavorite: boolean;
    createdAt: string;
}
