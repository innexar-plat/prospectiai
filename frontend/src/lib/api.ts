/**
 * Centralized API service for the Precision frontend.
 * All requests use relative /api paths — Nginx proxies them to the Next.js backend.
 */

import { getLogMessage, getAnalyzeStepLabel, type LogMessageKey } from '@/lib/i18n/log-messages';
import type { SupportedLocale } from '@/lib/locale';
import { detectLocale } from '@/lib/locale';
import { getActiveMarket } from '@/lib/market';
import { assertMarketHostname } from '@/lib/site-url';

const BASE = '/api';
let authRedirectInProgress = false;

export function buildApiHeaders(localeOverride?: SupportedLocale): Record<string, string> {
    const locale = localeOverride ?? detectLocale();
    return {
        'X-Prospector-Market': getActiveMarket(),
        'X-Locale': locale,
    };
}

function shouldSkipUnauthorizedRedirect(path: string): boolean {
    return path.startsWith('/auth/register')
        || path.startsWith('/auth/forgot-password')
        || path.startsWith('/auth/reset-password')
        || path.startsWith('/auth/resend-verification')
        || path.startsWith('/auth/verify-email')
        || path.startsWith('/auth/csrf')
        || path.startsWith('/auth/callback');
}

function handleUnauthorized(path: string): void {
    const win = globalThis.window;
    if (!win) return;
    if (authRedirectInProgress) return;
    if (shouldSkipUnauthorizedRedirect(path)) return;

    const pathname = win.location.pathname || '';
    if (pathname.startsWith('/auth/')) return;

    authRedirectInProgress = true;
    const callbackUrl = `${pathname}${win.location.search || ''}${win.location.hash || ''}` || '/dashboard';
    const target = `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    win.location.replace(target);
}

export function __resetAuthRedirectForTests(): void {
    authRedirectInProgress = false;
}

/** Simple exponential-backoff retry for fetch requests. Retries on 5xx and network errors. */
async function requestWithRetry<T>(path: string, options: RequestInit = {}, maxRetries = 2): Promise<T> {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(`${BASE}${path}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...buildApiHeaders(),
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
                if (res.status === 401) {
                    handleUnauthorized(path);
                }
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
            ...buildApiHeaders(),
            ...options.headers,
        },
        ...options,
    });

    if (!res.ok) {
        if (res.status === 401) {
            handleUnauthorized(path);
        }
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
}

export type AnalyzeProgressStep = 'profile' | 'web_search' | 'conversion' | 'prompt' | 'ai_call' | 'parsing' | 'saving' | 'done';

export interface AnalyzeStreamCallbacks {
    onProgress: (step: AnalyzeProgressStep, detail?: string) => void;
    onResult: (result: Analysis) => void;
    onError: (error: string) => void;
}

export interface AnalyzeStreamOptions {
    locale?: SupportedLocale;
    t?: (key: string, options?: Record<string, unknown>) => string;
}

function resolveLogMessage(
    options: AnalyzeStreamOptions | undefined,
    key: LogMessageKey,
): string {
    if (options?.t) {
        const translated = options.t(key);
        if (translated !== key) return translated;
    }
    return getLogMessage(key, options?.locale ?? 'pt');
}

function resolveAnalyzeJobError(
    options: AnalyzeStreamOptions | undefined,
    job: { error?: string; errorCode?: string },
): string {
    if (job.errorCode === 'ANALYSIS_STALE') {
        return resolveLogMessage(options, 'log.analyze.error.stale');
    }
    const lower = (job.error ?? '').toLowerCase();
    if (lower.includes('timed out') || lower.includes('interrupted')) {
        return resolveLogMessage(options, 'log.analyze.error.stale');
    }
    if (job.error) return job.error;
    return resolveLogMessage(options, 'log.analyze.error.failed');
}

type AnalyzeJobStatusResponse = {
    status: string;
    step?: AnalyzeProgressStep;
    result?: Analysis;
    error?: string;
    errorCode?: string;
};

class AnalyzeStatusHttpError extends Error {
    httpStatus: number;

    constructor(message: string, httpStatus: number) {
        super(message);
        this.httpStatus = httpStatus;
    }
}

async function fetchAnalyzeJobStatus(jobId: string): Promise<AnalyzeJobStatusResponse> {
    const res = await fetch(`${BASE}/analyze/status?jobId=${jobId}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({})) as AnalyzeJobStatusResponse & { error?: string };

    if (res.status === 404) {
        return { status: 'not_found', error: data.error };
    }
    if (!res.ok) {
        throw new AnalyzeStatusHttpError(data.error || `HTTP ${res.status}`, res.status);
    }
    return data;
}

/**
 * Analyze with async fire-and-poll pattern.
 * 1. POST /api/analyze → { jobId } (fast, <1s)
 * 2. Poll GET /api/analyze/status?jobId every 2s
 * 3. Backend updates Redis with real progress steps
 */
export function analyzeStream(
    body: Record<string, unknown>,
    callbacks: AnalyzeStreamCallbacks,
    options?: AnalyzeStreamOptions,
): { abort: () => void } {
    let aborted = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const locale = options?.locale ?? 'pt';
    const stepLabel = (step: AnalyzeProgressStep) => {
        if (options?.t) {
            const translated = options.t(`log.analyze.step.${step}`);
            if (translated !== `log.analyze.step.${step}`) return translated;
        }
        return getAnalyzeStepLabel(step, locale);
    };

    (async () => {
        try {
            // 1. Fire the job
            const { jobId, ...immediate } = await request<{ jobId?: string; score?: number }>('/analyze', {
                method: 'POST',
                body: JSON.stringify({
                    ...body,
                    locale: (body.locale as string | undefined) ?? options?.locale ?? detectLocale(),
                }),
            });

            // If backend returned a cached result directly (no jobId), finish immediately
            if (!jobId) {
                callbacks.onProgress('done', stepLabel('done'));
                callbacks.onResult(immediate as unknown as Analysis);
                return;
            }

            callbacks.onProgress('profile', stepLabel('profile'));

            // 2. Poll for status (15 min max — matches backend ANALYZE_JOB_TTL_SECONDS default)
            const POLL_INTERVAL = 2000;
            const MAX_POLLS = 450;
            const MAX_CONSECUTIVE_ERRORS = 5;
            let polls = 0;
            let consecutiveErrors = 0;

            const poll = async () => {
                if (aborted) return;
                polls++;

                try {
                    const job = await fetchAnalyzeJobStatus(jobId);

                    if (aborted) return;
                    consecutiveErrors = 0;

                    if (job.status === 'not_found') {
                        callbacks.onError(job.error || resolveLogMessage(options, 'log.analyze.error.jobNotFound'));
                        return;
                    }

                    if (job.status === 'processing') {
                        if (job.step) {
                            callbacks.onProgress(job.step, stepLabel(job.step));
                        }
                        if (polls < MAX_POLLS) {
                            pollTimer = setTimeout(poll, POLL_INTERVAL);
                        } else {
                            callbacks.onError(resolveLogMessage(options, 'log.analyze.error.timeout'));
                        }
                    } else if (job.status === 'done' && job.result) {
                        callbacks.onProgress('done', stepLabel('done'));
                        callbacks.onResult(job.result);
                    } else if (job.status === 'error') {
                        callbacks.onError(resolveAnalyzeJobError(options, job));
                    } else {
                        callbacks.onError(resolveLogMessage(options, 'log.analyze.error.jobNotFound'));
                    }
                } catch (err) {
                    if (aborted) return;
                    consecutiveErrors++;
                    const httpStatus = err instanceof AnalyzeStatusHttpError ? err.httpStatus : undefined;
                    const isTransient = httpStatus === 502 || httpStatus === 503 || httpStatus === 520 || httpStatus === undefined;

                    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && isTransient) {
                        callbacks.onError(resolveLogMessage(options, 'log.analyze.error.serviceUnavailable'));
                        return;
                    }

                    // Transient poll error — retry unless max reached
                    if (polls < MAX_POLLS) {
                        pollTimer = setTimeout(poll, POLL_INTERVAL);
                    } else {
                        callbacks.onError(err instanceof Error ? err.message : resolveLogMessage(options, 'log.analyze.error.statusCheck'));
                    }
                }
            };

            pollTimer = setTimeout(poll, POLL_INTERVAL);
        } catch (err) {
            if (aborted) return;
            callbacks.onError(err instanceof Error ? err.message : resolveLogMessage(options, 'log.analyze.error.startFailed'));
        }
    })();

    return {
        abort: () => {
            aborted = true;
            if (pollTimer) clearTimeout(pollTimer);
        },
    };
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

function normalizeCallbackPath(callbackUrl?: string, fallbackPath = '/dashboard'): string {
    const win = globalThis.window;
    const origin = win?.location?.origin;

    let path = fallbackPath;
    if (callbackUrl?.startsWith('/')) {
        path = callbackUrl;
    } else if (callbackUrl) {
        try {
            const parsed = new URL(callbackUrl);
            if (origin && parsed.origin === origin) {
                return assertMarketHostname(callbackUrl);
            }
            path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
            if (!path.startsWith('/')) path = fallbackPath;
        } catch {
            path = fallbackPath;
        }
    }

    if (origin) {
        return assertMarketHostname(`${origin}${path}`);
    }
    return assertMarketHostname(path);
}

export const authApi = {
    /** Get current logged-in user (null if not authenticated) */
    session: () => request<{ user: SessionUser | null }>('/auth/session'),

    /** Register a new user with email + password. affiliateCode opcional (?ref=). */
    register: (data: { email: string; password: string; name?: string; affiliateCode?: string }) =>
        request<{ message: string; id: string; requiresOnboarding: boolean; verificationEmailSent: boolean; verificationEmailError?: string | null }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    /** Sign in with email/password (uses NextAuth credentials + CSRF) */
    signIn: async (data: { email: string; password: string; callbackUrl?: string }) => {
        const csrfToken = await getCsrfToken();
        const callbackUrl = normalizeCallbackPath(data.callbackUrl, '/dashboard');

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
        const callbackUrl = normalizeCallbackPath(callbackPath, '/dashboard');
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

    /** Resend email verification. POST /api/auth/resend-verification */
    resendVerification: () =>
        request<{ sent?: boolean; cooldown?: number; error?: string }>('/auth/resend-verification', {
            method: 'POST',
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
        requestWithRetry<{ places: Place[]; nextPageToken?: string }>('/search', {
            method: 'POST',
            body: JSON.stringify(params),
        }, 2),

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

    marketReport: (params: { textQuery: string; includedType?: string; pageSize?: number; city?: string; state?: string; country?: string }) =>
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
    priceMonthlyUsd?: number;
    priceAnnualUsd?: number;
    currency?: 'BRL' | 'USD';
    modules: string[];
    promo?: StarterPromoInfo;
}

export type StarterPromoInfo = {
    id: string;
    planId: string;
    planKey: string;
    priceMonthlyBrl: number;
    regularPriceMonthlyBrl: number;
    months: number;
    eligible: boolean;
};

export type PromoValidateResponse = {
    eligible: boolean;
    promo: StarterPromoInfo;
    planKey: string;
    priceMonthlyBrl: number;
    regularPriceMonthlyBrl: number;
    months: number;
    checkoutPlanId: string;
    error?: string;
    reason?: string;
};

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
        promoCode?: string;
        promoToken?: string;
    }) =>
        request<CheckoutResponse>('/billing/checkout', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    validatePromo: (params: { promo?: string; token?: string }) => {
        const qs = new URLSearchParams();
        if (params.promo) qs.set('promo', params.promo);
        if (params.token) qs.set('token', params.token);
        return request<PromoValidateResponse>(`/billing/promo/validate?${qs.toString()}`);
    },
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
    analyze: (params: { textQuery: string; includedType?: string; pageSize?: number; city?: string; state?: string; country?: string; radiusKm?: number }) =>
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
    country?: string;
    locale?: string;
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
    legalName?: string;
    tradeName?: string;
    cnpj?: string;
    city?: string;
    state?: string;
    country?: string;
    locale?: SupportedLocale;
    postalCode?: string;
    neighborhood?: string;
    primaryCnaeCode?: string;
    primaryCnaeDescription?: string;
    companySize?: string;
    foundingDate?: string;
    productService?: string;
    targetAudience?: string;
    mainBenefit?: string;
    address?: string;
    websiteUrl?: string;
    linkedInUrl?: string;
    instagramUrl?: string;
    facebookUrl?: string;
    serviceModel?: string;
    averageTicket?: number;
    operationRadiusKm?: number;
    knownCompetitors?: string;
}

export const companyAnalysisApi = {
    run: (body?: CompanyAnalysisParams) =>
        requestWithRetry<CompanyAnalysisReport>('/company-analysis', {
            method: 'POST',
            body: JSON.stringify(body ?? {}),
        }, 3),
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
    painPoints?: string[];
    approach?: string;
    firstContactMessage?: string;
    isFavorite?: boolean;
    suggestedWhatsAppMessage?: string;
    closeProbability?: number;
    estimatedDealValue?: number;
    bestContactWindow?: string;
    conversionReason?: string;
    dealValue?: number;
    lostReason?: string;
    contactedAt?: string;
    convertedAt?: string;
    lostAt?: string;
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
    updateStatus: (analysisId: string, status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'LOST', extra?: {
        conversionReason?: string;
        dealValue?: number;
        lostReason?: string;
    }) =>
        request<LeadAnalysisListItem>(`/leads/${analysisId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status, ...extra }),
        }),
};

/** Pipeline Intelligence API */
export interface PipelineRecommendation {
    rank: number;
    leadId: string;
    leadPlaceId?: string;
    analysisId: string;
    leadName: string;
    phone?: string;
    closeProbability?: number;
    estimatedDealValue?: number;
    bestContactWindow?: string;
    scoreLabel?: string;
    status: string;
    reasons: string[];
    suggestedAction: string;
}

export interface PipelineStats {
    totalActive: number;
    hotLeads: number;
    avgCloseProbability: number;
    pipelineValue: number;
    conversionRate: number | null;
    avgDealValue: number | null;
    avgCycleDays: number | null;
    totalConverted: number;
    totalLost: number;
    topLostReasons: { reason: string; count: number }[];
}

export interface PipelineBrief {
    recommendations: PipelineRecommendation[];
    stats: PipelineStats;
}

export interface ConversionStats {
    totalAnalyzed: number;
    contacted: number;
    converted: number;
    lost: number;
    conversionRate: number | null;
    avgDealValue: number | null;
    totalRevenue: number | null;
    avgCycleDays: number | null;
    topLostReasons: { reason: string; count: number }[];
    topConvertingTypes: { type: string; count: number }[];
    convertedWithoutWebsite: number | null;
    convertedWithoutPhone: number | null;
}

export const pipelineApi = {
    getDailyBrief: () => request<PipelineBrief>('/pipeline/daily-brief'),
    getStats: () => request<ConversionStats>('/pipeline/stats'),
};

// ─── User ────────────────────────────────────────────────────────────────────

export const userApi = {
    me: () => request<{ user: SessionUser | null; workspaceProfile?: WorkspaceProfile | null }>('/user/me'),
    updateProfile: (data: UserProfileUpdate) =>
        request<UserProfileResponse>('/user/profile', { method: 'POST', body: JSON.stringify(data) }),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
        request<{ message: string }>('/user/change-password', { method: 'POST', body: JSON.stringify(data) }),
};

export interface WorkspaceProfile {
    companyName: string | null;
    legalName: string | null;
    tradeName: string | null;
    cnpj: string | null;
    primaryCnaeCode: string | null;
    primaryCnaeDescription: string | null;
    companySize: string | null;
    foundingDate: string | null;
    productService: string | null;
    targetAudience: string | null;
    mainBenefit: string | null;
    address: string | null;
    postalCode: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    linkedInUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    websiteUrl: string | null;
    logoUrl: string | null;
    serviceModel: string | null;
    averageTicket: number | null;
    operationRadiusKm: number | null;
    knownCompetitors: string | null;
}

export interface WorkspaceProfileCnpjLookup {
    cnpj: string;
    legalName: string | null;
    tradeName: string | null;
    primaryCnaeCode: string | null;
    primaryCnaeDescription: string | null;
    companySize: string | null;
    foundingDate: string | null;
    postalCode: string | null;
    street: string | null;
    number: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    address: string | null;
}

export const workspaceProfileApi = {
    get: () => request<WorkspaceProfile>('/workspace/current/profile'),
    update: (data: Partial<WorkspaceProfile>) =>
        request<WorkspaceProfile>('/workspace/current/profile', {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    lookupCnpj: (cnpj: string) =>
        request<WorkspaceProfileCnpjLookup>(`/workspace/current/profile/cnpj?cnpj=${encodeURIComponent(cnpj)}`),
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
    plan: 'FREE' | 'TRIAL' | 'BASIC' | 'PRO' | 'BUSINESS' | 'SCALE';
    leadsUsed: number;
    leadsLimit: number;
    companyName?: string | null;
    legalName?: string | null;
    tradeName?: string | null;
    cnpj?: string | null;
    primaryCnaeCode?: string | null;
    primaryCnaeDescription?: string | null;
    companySize?: string | null;
    foundingDate?: string | null;
    productService?: string | null;
    targetAudience?: string | null;
    mainBenefit?: string | null;
    postalCode?: string | null;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    serviceModel?: string | null;
    averageTicket?: number | null;
    operationRadiusKm?: number | null;
    knownCompetitors?: string | null;
    /** Personal profile */
    phone?: string | null;
    address?: string | null;
    linkedInUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    websiteUrl?: string | null;
    /** When true, front must redirect to /onboarding before using dashboard. */
    requiresOnboarding?: boolean;
    /** True if user has verified their email address. */
    emailVerified?: boolean;
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
    /** True if the auto-prospecção module is enabled for this workspace */
    autoProspeccaoEnabled?: boolean;
    /** Trial state (plan TRIAL) */
    isTrialing?: boolean;
    trialExpired?: boolean;
    trialDaysRemaining?: number | null;
    starterPromoEligible?: boolean;
    starterPromo?: StarterPromoInfo | null;
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
    displayName?: { text: string; languageCode?: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    website?: string;
    email?: string;
    rating?: number;
    userRatingCount?: number;
    types?: string[];
    primaryType?: string;
    businessStatus?: string;
    opportunityScore?: number;
    cnpj?: string;
    companyLegalName?: string;
    companyTradeName?: string;
    companyMainCnae?: string;
    cnpjStatus?: string;
    /** All unique phones collected from every source (Google, RF, BrasilAPI, Lead DB). */
    phones?: string[];
    /** All unique emails collected from every source. */
    emails?: string[];
    /** All unique websites collected from every source. */
    websites?: string[];
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
    /** Extra data from Receita Federal (present when result came from RF search) */
    rfData?: {
        porte: string | null;
        capitalSocial: number | null;
        email: string | null;
        cep: string | null;
        dataAbertura: string | null;
        cnaePrincipal: string | null;
        cnaeDescricao: string | null;
    };
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
    verdictKey?: 'HIGHLY_VIABLE' | 'VIABLE_WITH_CAVEATS' | 'MODERATE' | 'RISKY' | 'NOT_RECOMMENDED';
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

// ─── CNAE & Receita Federal ──────────────────────────────────────────────────

export interface CnaeCode {
    code: string;
    description: string;
}

export interface RfCompanyResult {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    cnaePrincipal: string;
    cnaeDescricao: string | null;
    uf: string;
    municipio: string | null;
    cep: string | null;
    bairro: string | null;
    logradouro: string | null;
    numero: string | null;
    telefone: string | null;
    email: string | null;
    porte: string | null;
    capitalSocial: number | null;
    dataAbertura: string | null;
}

export const cnaeApi = {
    /** Autocomplete de códigos CNAE por código ou descrição */
    search: (q: string, limit = 20) =>
        request<{ codes: CnaeCode[] }>(`/cnae?q=${encodeURIComponent(q)}&limit=${limit}`),
};

export const rfSearchApi = {
    /** Buscar empresas da Receita Federal por CNAE(s) + filtros */
    search: (params: {
        cnae?: string;
        cnaes?: string[];
        uf?: string;
        municipio?: string;
        porte?: string;
        razaoSocial?: string;
        page?: number;
        pageSize?: number;
    }) =>
        request<{
            companies: RfCompanyResult[];
            total: number;
            page: number;
            pageSize: number;
            totalPages: number;
        }>('/rf-search', {
            method: 'POST',
            body: JSON.stringify(params),
        }),

    /** Estatísticas da base RF */
    stats: () =>
        request<{ totalCompanies: number; totalCnaes: number; available: boolean }>('/rf-search'),
};

/* ------------------------------------------------------------------ */
/*  Smart Relations (Knowledge Graph)                                  */
/* ------------------------------------------------------------------ */

export interface RelatedCompany {
    cnpj: string;
    name: string;
    tradeName: string | null;
    cnae: string | null;
    city: string | null;
    uf: string | null;
    phone: string | null;
    email: string | null;
    capitalSocial: number | null;
    porte: string | null;
    relation: string;
    relevance: number;
}

export interface SmartRelationsResult {
    lead: { placeId: string; name: string; cnpj: string | null };
    relations: RelatedCompany[];
    clusters: {
        sameSector: RelatedCompany[];
        sameRegion: RelatedCompany[];
        contactNetwork: RelatedCompany[];
        userLeads: RelatedCompany[];
    };
    stats: {
        totalFound: number;
        sameSector: number;
        sameRegion: number;
        contactNetwork: number;
        userLeads: number;
    };
}

export const smartRelationsApi = {
    get: (leadId: string) =>
        request<{ data: SmartRelationsResult }>(`/leads/${encodeURIComponent(leadId)}/relations`),
};

/* ------------------------------------------------------------------ */
/*  Auto-Prospecção                                                     */
/* ------------------------------------------------------------------ */

export interface AutoProspStats {
    totalLeads: number;
    leadsHot: number;
    leadsWarm: number;
    leadsCold: number;
    leadsConverted: number;
    emailsSent: number;
    crmPushed: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
    isActive: boolean;
    runsLast7d: number;
}

export interface AutoProspLead {
    id: string;
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    email: string | null;
    telefone: string | null;
    ddd: string | null;
    cnaePrincipal: string | null;
    uf: string | null;
    municipio: string | null;
    porte: string | null;
    score: number | null;
    status: string;
    aiAnalysisSummary: string | null;
    crmPushedAt: string | null;
    crmProvider: string | null;
    createdAt: string;
    emailEvents: Array<{
        id: string;
        step: number;
        subject: string;
        sentAt: string | null;
        openedAt: string | null;
        clickedAt: string | null;
    }>;
}

export interface AutoProspRun {
    id: string;
    workspaceId: string;
    triggeredBy: string;
    status: string;
    leadsFound: number;
    leadsAnalyzed: number;
    leadsHot: number;
    leadsWarm: number;
    leadsCold: number;
    emailsQueued: number;
    crmPushed: number;
    startedAt: string;
    completedAt: string | null;
    errorLog: string | null;
    searchProfile: { id: string; name: string } | null;
}

export interface AutoProspProfile {
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    isActive: boolean;
    cnae: string | null;
    cnaeList: string[] | null;
    uf: string[] | null;
    porte: string[] | null;
    hasEmail: boolean | null;
    totalFound: number;
    totalHot: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
}

export interface AutoProspConfig {
    id: string;
    isActive: boolean;
    scheduleDays: number[];
    scheduleTimeStart: string;
    scheduleTimeEnd: string;
    maxLeadsPerRun: number;
    maxEmailsPerDay: number;
    maxCrmPushPerDay: number;
    hotScoreMin: number;
    warmScoreMin: number;
    crmAutoSend: boolean;
    crmProvider: string | null;
    emailAutoSend: boolean;
}

interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export const autoProspApi = {
    getStats: () =>
        request<{ data: AutoProspStats }>('/auto-prospeccao/stats'),

    getConfig: () =>
        request<{ data: AutoProspConfig }>('/auto-prospeccao/config'),

    updateConfig: (data: Partial<AutoProspConfig>) =>
        request<{ data: AutoProspConfig }>('/auto-prospeccao/config', {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    trigger: () =>
        request<{ data: { runId: string; status: string } }>('/auto-prospeccao/trigger', {
            method: 'POST',
        }),

    triggerDryRun: () =>
        request<{ data: {
            dryRun: true;
            totalWouldFind: number;
            profiles: Array<{ profileId: string; profileName: string; wouldFind: number; dedupSkip: number }>;
        } }>('/auto-prospeccao/trigger', {
            method: 'POST',
            body: JSON.stringify({ dryRun: true }),
        }),

    listLeads: (params: {
        page?: number;
        limit?: number;
        status?: string;
        uf?: string;
        minScore?: number;
        maxScore?: number;
    }) => {
        const qs = new URLSearchParams();
        if (params.page) qs.set('page', String(params.page));
        if (params.limit) qs.set('limit', String(params.limit));
        if (params.status) qs.set('status', params.status);
        if (params.uf) qs.set('uf', params.uf);
        if (params.minScore !== undefined) qs.set('minScore', String(params.minScore));
        if (params.maxScore !== undefined) qs.set('maxScore', String(params.maxScore));
        return request<PaginatedResponse<AutoProspLead>>(`/auto-prospeccao/leads?${qs.toString()}`);
    },

    getLead: (id: string) =>
        request<{ data: AutoProspLead }>(`/auto-prospeccao/leads/${id}`),

    pushLeadToCrm: (id: string) =>
        request<{ data: { crmId: string | null; provider: string } }>(`/auto-prospeccao/leads/${id}/push-crm`, {
            method: 'POST',
        }),

    discardLead: (id: string) =>
        request<void>(`/auto-prospeccao/leads/${id}/discard`, { method: 'POST' }),

    listRuns: (page = 1, limit = 20) =>
        request<PaginatedResponse<AutoProspRun>>(`/auto-prospeccao/runs?page=${page}&limit=${limit}`),

    getRun: (id: string) =>
        request<{ data: AutoProspRun }>(`/auto-prospeccao/runs/${id}`),

    listProfiles: () =>
        request<{ data: { system: AutoProspProfile[]; workspace: AutoProspProfile[] } }>('/auto-prospeccao/profiles'),

    createProfile: (data: Partial<AutoProspProfile>) =>
        request<{ data: AutoProspProfile }>('/auto-prospeccao/profiles', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updateProfile: (id: string, data: Partial<AutoProspProfile>) =>
        request<{ data: AutoProspProfile }>(`/auto-prospeccao/profiles/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    deleteProfile: (id: string) =>
        request<void>(`/auto-prospeccao/profiles/${id}`, { method: 'DELETE' }),

    toggleProfile: (id: string) =>
        request<{ data: AutoProspProfile }>(`/auto-prospeccao/profiles/${id}/toggle`, { method: 'POST' }),
};
