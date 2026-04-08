/**
 * Centralized API service for the Precision IA frontend.
 * All requests use relative /api paths — Nginx proxies them to the Next.js backend.
 */

const BASE = '/api';

/** Simple exponential-backoff retry for fetch requests. Retries on 5xx and network errors. */
async function requestWithRetry<T>(path: string, options: RequestInit = {}, maxRetries = 2): Promise<T> {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(`${BASE}${path}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                ...options,
            });
            // Retry on 503/502/520 (transient)
            if (!res.ok && attempt < maxRetries && (res.status === 503 || res.status === 502 || res.status === 520)) {
                await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
                continue;
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: res.statusText }));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            return res.json();
        } catch (err) {
            lastErr = err instanceof Error ? err : new Error(String(err));
            if (attempt < maxRetries) {
                await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
                continue;
            }
        }
    }
    throw lastErr ?? new Error('Request failed');
}

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

/** Create a form with hidden inputs and submit (used by credentials and OAuth sign-in). */
function createAndSubmitForm(action: string, fields: Record<string, string>): void {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement('input');
        input.name = name;
        input.type = 'hidden';
        input.value = value;
        form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
}

export const authApi = {
    /** Get current logged-in user (null if not authenticated) */
    session: () => request<{ user: SessionUser | null }>('/auth/session'),

    /** Register a new user with email + password. affiliateCode opcional (?ref=). */
    register: (data: { email: string; password: string; name?: string; affiliateCode?: string }) =>
        request<{ message: string; id: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    /** Sign in with email/password (uses NextAuth credentials + CSRF) */
    signIn: async (data: { email: string; password: string; callbackUrl?: string }) => {
        const csrfToken = await getCsrfToken();
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const baseOrigin = origin.replace(/\/$/, '');
        let pathPart: string;
        if (data.callbackUrl?.startsWith('/')) pathPart = data.callbackUrl;
        else if (data.callbackUrl) pathPart = `/${data.callbackUrl}`;
        else pathPart = '';
        let callbackUrl: string;
        if (data.callbackUrl && data.callbackUrl.startsWith('http')) callbackUrl = data.callbackUrl;
        else if (data.callbackUrl) callbackUrl = `${baseOrigin}${pathPart}`;
        else callbackUrl = `${origin}/dashboard`;

        createAndSubmitForm(`${BASE}/auth/callback/credentials`, {
            csrfToken,
            email: data.email,
            password: data.password,
            callbackUrl,
        });
    },

    /**
     * Initiate OAuth sign-in (Google or GitHub).
     * Navigates via GET to /api/oauth/:provider which triggers Auth.js server-side
     * signIn(), avoiding a form POST that Chrome Enhanced Protection may flag.
     */
    initiateOAuthSignIn: async (provider: 'google' | 'github', callbackPath = '/dashboard') => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const baseOrigin = origin.replace(/\/$/, '');
        const pathSegment = callbackPath.startsWith('/') ? callbackPath : `/${callbackPath}`;
        const callbackUrl = origin === '' ? '' : `${baseOrigin}${pathSegment}`;
        window.location.href = `${BASE}/oauth/${provider}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
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
        requestWithRetry<PlaceDetail>(`/details?placeId=${placeId}`, {}, 3),

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
        requestWithRetry<Analysis>('/analyze', {
            method: 'POST',
            body: JSON.stringify(body),
        }, 2),

    analyzeBatch: (items: Array<Partial<PlaceDetail> & {
        placeId: string;
        name: string;
        locale?: string;
    }>) =>
        request<{ jobId: string; status: string; total: number; processed: number; succeeded: number; failed: number; startedAt: string }>('/analyze/batch', {
            method: 'POST',
            body: JSON.stringify({ items }),
        }),

    analyzeBatchStatus: (jobId: string) =>
        request<{
            id: string;
            status: 'queued' | 'running' | 'completed' | 'failed';
            total: number;
            processed: number;
            succeeded: number;
            failed: number;
            startedAt: string;
            finishedAt?: string;
            errors: Array<{ placeId: string; message: string }>;
        }>(`/analyze/batch/${encodeURIComponent(jobId)}`),

    citySuggestions: (params: { state: string; country?: string; q?: string }) => {
        const qs = new URLSearchParams();
        qs.set('state', params.state);
        if (params.country) qs.set('country', params.country);
        if (params.q) qs.set('q', params.q);
        return request<{ cities: string[] }>(`/location/cities?${qs.toString()}`);
    },

    marketReport: (params: { textQuery: string; includedType?: string; pageSize?: number; city?: string; state?: string }) =>
        request<MarketReport>('/market-report', {
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
        scheduleAtPeriodEnd?: boolean;
        /** Código do afiliado (do cookie ref). */
        affiliateCode?: string;
    }) =>
        request<CheckoutResponse>('/billing/checkout', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    cancelSubscription: () =>
        request<{ ok: boolean; message: string; pendingPlanId?: string | null; pendingPlanEffectiveAt?: string | null }>('/billing/cancel-subscription', {
            method: 'POST',
        }),
    cancelPendingDowngrade: () =>
        request<{ ok: boolean; message: string }>('/billing/cancel-pending-downgrade', {
            method: 'POST',
        }),
};

// ─── Affiliate ───────────────────────────────────────────────────────────────

export type AffiliateMe = {
    id: string;
    code: string;
    status: 'PENDING' | 'APPROVED' | 'SUSPENDED';
    commissionRatePercent: number;
    payoutType: string | null;
    approvedAt: string | null;
    createdAt: string;
    referralCount: number;
    commissionCount: number;
};

export type AffiliateStats = {
    referralCount: number;
    convertedCount: number;
    commissionPendingCents: number;
    commissionPaidCents: number;
};

export const affiliateApi = {
    me: () => request<AffiliateMe>('/affiliate/me'),
    register: () => request<{ id: string; code: string; status: string; message: string }>('/affiliate/register', { method: 'POST' }),
    stats: () => request<AffiliateStats>('/affiliate/stats'),
    referrals: (params?: { page?: number; limit?: number }) => {
        const q = new URLSearchParams();
        if (params?.page != null) q.set('page', String(params.page));
        if (params?.limit != null) q.set('limit', String(params.limit));
        return request<{ items: Array<{ id: string; landedAt: string; signupAt: string; convertedAt: string | null; refSource: string; planId: string | null; valueCents: number | null; emailMasked: string | null }>; total: number; page: number; limit: number }>(`/affiliate/referrals?${q}`);
    },
    commissions: (params?: { page?: number; limit?: number; status?: string }) => {
        const q = new URLSearchParams();
        if (params?.page != null) q.set('page', String(params.page));
        if (params?.limit != null) q.set('limit', String(params.limit));
        if (params?.status) q.set('status', params.status);
        return request<{ items: Array<{ id: string; amountCents: number; currency: string; status: string; availableAt: string; paidAt: string | null; commissionType: string; createdAt: string }>; total: number; page: number; limit: number }>(`/affiliate/commissions?${q}`);
    },
    updatePayout: (data: { payoutType?: 'PIX' | 'BANK_TRANSFER'; payoutPayload?: string }) =>
        request<{ ok: boolean }>('/affiliate/me', { method: 'PATCH', body: JSON.stringify(data) }),
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

// ─── Push Subscription ──────────────────────────────────────────────────────

export const pushApi = {
    getVapidKey: () => request<{ publicKey: string }>('/push-subscription/vapid-key'),
    subscribe: (subscription: PushSubscriptionJSON) =>
        request<{ id: string }>('/push-subscription', {
            method: 'POST',
            body: JSON.stringify(subscription),
        }),
    unsubscribe: (endpoint: string) =>
        request<{ ok: boolean }>('/push-subscription', {
            method: 'DELETE',
            body: JSON.stringify({ endpoint }),
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
    status?: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'LOST';
    score?: number;
    summary?: string;
    isFavorite?: boolean;
    suggestedWhatsAppMessage?: string;
    createdAt: string;
    lead: Lead;
}

export interface LeadStats {
    total: number;
    highScore: number;
    favorites: number;
    searchesThisMonth: number;
}

export const leadsApi = {
    list: () => request<LeadAnalysisListItem[]>('/leads'),
    get: (id: string) => request<LeadAnalysisListItem>(`/leads/${id}`),
    stats: () => request<LeadStats>('/leads/stats'),
    save: (place: { placeId: string; name: string; address?: string; phone?: string; website?: string; rating?: number; reviewCount?: number; types?: string[]; businessStatus?: string }) =>
        request<LeadAnalysisListItem>('/leads', {
            method: 'POST',
            body: JSON.stringify(place),
        }),
    toggleFavorite: (analysisId: string, isFavorite: boolean) =>
        request<LeadAnalysisListItem>(`/leads/${analysisId}`, {
            method: 'PATCH',
            body: JSON.stringify({ isFavorite }),
        }),
    updateStatus: (analysisId: string, status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'LOST') =>
        request<LeadAnalysisListItem>(`/leads/${analysisId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
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
    billingCycle?: 'monthly' | 'annual' | null;
    /** End of 3-day grace period when payment failed (past_due). */
    gracePeriodEnd?: string | null;
    /** Downgrade scheduled for period end (plan to apply at pendingPlanEffectiveAt). */
    pendingPlanId?: string | null;
    pendingPlanEffectiveAt?: string | null;
    notifyByEmail?: boolean;
}

/** Payload for POST /api/user/profile (personal profile only) */
export type UserProfileUpdate = Partial<Pick<SessionUser,
    'name' | 'phone' | 'address' | 'linkedInUrl' | 'instagramUrl' | 'facebookUrl' | 'websiteUrl' | 'image'
    | 'notifyByEmail'>>;

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
}

export interface Place {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    website?: string;
    rating?: number;
    userRatingCount?: number;
    types?: string[];
    primaryType?: string;
    businessStatus?: string;
    opportunityScore?: number;
    currentOpeningHours?: {
        openNow?: boolean;
        weekdayDescriptions?: string[];
    };
    reviews?: Array<{
        rating: number;
        text?: { text: string };
        authorAttribution?: { displayName: string };
        relativePublishTimeDescription?: string;
    }>;
}

export type PlaceDetail = Place & {
    regularOpeningHours?: unknown;
    editorialSummary?: { text: string };
    website?: string;
    primaryType?: string;
    reviews?: Array<{
        rating: number;
        text?: { text: string };
        authorAttribution?: { displayName: string };
        relativePublishTimeDescription?: string;
    }>;
};

export interface Analysis {
    placeId?: string;
    name?: string;
    score?: number;
    summary?: string;
    strengths?: string[];
    weaknesses?: string[];
    opportunities?: string[];
    reviewAnalysis?: string;
    reviewTrend?: string;
    suggestedContactTime?: string;
    contactStrategy?: string;
    fullReport?: string;
    socialMedia?: { instagram?: string; facebook?: string; linkedin?: string };
    firstContactMessage?: string;
    suggestedWhatsAppMessage?: string;
    scoreLabel?: string;
    painPoints?: string[];
    gaps?: string[];
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
    city?: string | null;
    state?: string | null;
    country?: string | null;
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

// ─── Integrations ────────────────────────────────────────────────────────────

export const integrationsApi = {
    /** Save/update RD Station API token for the current user. */
    rdStationSaveToken: (token: string) =>
        request<{ ok: boolean }>('/integrations/rdstation', {
            method: 'POST',
            body: JSON.stringify({ token }),
        }),
    /** Test RD Station connection. */
    rdStationTest: () =>
        request<{ ok: boolean; connected?: boolean; mode?: 'manual' | 'oauth' | null }>('/integrations/rdstation'),
    /** Get OAuth authorization URL for RD Station connection flow. */
    rdStationOauthConnectUrl: () =>
        request<{ ok: boolean; url: string }>('/integrations/rdstation/oauth/connect'),
    /** Disconnect RD Station integration and clear stored credentials. */
    rdStationDisconnect: () =>
        request<{ ok: boolean }>('/integrations/rdstation/disconnect', { method: 'POST' }),
    /** Test Agendor connection (user token or env fallback). */
    agendorTest: () =>
        request<{ ok: boolean; connected?: boolean; source?: 'env' | 'user' | null; user?: { id?: number; name?: string } }>('/integrations/agendor'),
    /** Save Agendor API token for current user. */
    agendorSaveToken: (token: string) =>
        request<{ ok: boolean }>('/integrations/agendor', {
            method: 'POST',
            body: JSON.stringify({ token }),
        }),
    /** Remove Agendor API token for current user. */
    agendorDisconnect: () =>
        request<{ ok: boolean }>('/integrations/agendor', { method: 'DELETE' }),
    /** List Agendor funnels. */
    agendorFunnels: () =>
        request<{ data: Array<{ id: number; name: string; sequence?: number }> }>('/integrations/agendor/funnels'),
    /** List Agendor deal stages (optionally filtered by funnel). */
    agendorDealStages: (funnelId?: number) =>
        request<{ data: Array<{ id: number; name: string; sequence?: number; funnel?: { id: number; name: string } }> }>(
            funnelId ? `/integrations/agendor/deal-stages?funnel_id=${funnelId}` : '/integrations/agendor/deal-stages'
        ),
    /** List Agendor users. */
    agendorUsers: () =>
        request<{ data: Array<{ id: number; name: string; email?: string }> }>('/integrations/agendor/users'),
    /** List RD Station CRM sources. */
    rdStationSources: () =>
        request<{ data: Array<{ id: string; name: string; description?: string }> }>('/integrations/rdstation/sources'),
    /** List RD Station CRM campaigns. */
    rdStationCampaigns: () =>
        request<{ data: Array<{ id: string; name: string }> }>('/integrations/rdstation/campaigns'),
    /** Send lead data to RD Station (contact only or contact + deal). */
    rdStationSend: (lead: {
        mode?: 'contact' | 'contact_and_deal';
        name: string;
        phone?: string;
        email?: string;
        website?: string;
        address?: string;
        rating?: number;
        reviewCount?: number;
        businessStatus?: string;
        primaryType?: string;
        score?: number;
        scoreLabel?: string;
        summary?: string;
        strengths?: string[];
        weaknesses?: string[];
        opportunities?: string[];
        painPoints?: string[];
        gaps?: string[];
        reviewAnalysis?: string;
        reviewTrend?: string;
        suggestedContactTime?: string;
        contactStrategy?: string;
        firstContactMessage?: string;
        suggestedWhatsAppMessage?: string;
        fullReport?: string;
        socialMedia?: { instagram?: string; facebook?: string; linkedin?: string };
        stageId?: string;
        pipelineId?: string;
        sourceId?: string;
        campaignId?: string;
        dealName?: string;
        expectedCloseDate?: string;
        placeId: string;
    }) =>
        request<{ ok: boolean; product?: 'crm' | 'marketing'; contactId?: string; dealId?: string; organizationId?: string; noteId?: string; taskId?: string; warning?: string }>('/integrations/rdstation/send', {
            method: 'POST',
            body: JSON.stringify(lead),
        }),
    /** Send lead data to Agendor (contact only or contact + deal). */
    agendorSend: (lead: {
        mode?: 'contact' | 'contact_and_deal';
        name: string;
        phone?: string;
        email?: string;
        website?: string;
        address?: string;
        rating?: number;
        reviewCount?: number;
        primaryType?: string;
        businessStatus?: string;
        score?: number;
        scoreLabel?: string;
        summary?: string;
        strengths?: string[];
        gaps?: string[];
        painPoints?: string[];
        firstContactMessage?: string;
        suggestedWhatsAppMessage?: string;
        fullReport?: string;
        socialMedia?: { instagram?: string; facebook?: string; linkedin?: string };
        dealName?: string;
        dealValue?: number;
        funnel?: number;
        dealStage?: number;
        ownerUser?: number | string;
        placeId: string;
    }) =>
        request<{ ok: boolean; personId?: number | null; organizationId?: number; dealId?: number; taskId?: number; warning?: string }>('/integrations/agendor/send', {
            method: 'POST',
            body: JSON.stringify(lead),
        }),
    /** Test HubSpot connection. */
    hubspotTest: () =>
        request<{ ok: boolean; connected?: boolean; mode?: 'oauth' | null }>('/integrations/hubspot'),
    /** Get OAuth authorization URL for HubSpot connection flow. */
    hubspotOauthConnectUrl: () =>
        request<{ ok: boolean; url: string }>('/integrations/hubspot/oauth/connect'),
    /** Disconnect HubSpot integration and clear stored credentials. */
    hubspotDisconnect: () =>
        request<{ ok: boolean }>('/integrations/hubspot/disconnect', { method: 'POST' }),
    /** List HubSpot deal pipelines with stages. */
    hubspotPipelines: () =>
        request<{ data: Array<{ id: string; label: string; stages: Array<{ id: string; label: string }> }> }>('/integrations/hubspot/pipelines'),
    /** List HubSpot owners. */
    hubspotOwners: () =>
        request<{ data: Array<{ id: string; label: string }> }>('/integrations/hubspot/owners'),
    /** Send lead data to HubSpot (contact only or contact + deal). */
    hubspotSend: (lead: {
        mode?: 'contact' | 'contact_and_deal';
        name: string;
        phone?: string;
        email?: string;
        website?: string;
        address?: string;
        rating?: number;
        reviewCount?: number;
        businessStatus?: string;
        primaryType?: string;
        score?: number;
        scoreLabel?: string;
        summary?: string;
        strengths?: string[];
        weaknesses?: string[];
        opportunities?: string[];
        painPoints?: string[];
        gaps?: string[];
        reviewAnalysis?: string;
        reviewTrend?: string;
        suggestedContactTime?: string;
        contactStrategy?: string;
        firstContactMessage?: string;
        suggestedWhatsAppMessage?: string;
        fullReport?: string;
        socialMedia?: { instagram?: string; facebook?: string; linkedin?: string };
        pipelineId?: string;
        stageId?: string;
        ownerId?: string;
        dealName?: string;
        dealValue?: number;
        placeId: string;
    }) =>
        request<{ ok: boolean; contactId?: string; dealId?: string; warning?: string }>('/integrations/hubspot/send', {
            method: 'POST',
            body: JSON.stringify(lead),
        }),
};
