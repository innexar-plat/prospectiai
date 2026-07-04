import { getLogMessage, getAnalyzeStepLabel, type LogMessageKey } from '@/lib/i18n/log-messages';
import { detectLocale } from '@/lib/locale';
import { request, requestWithRetry } from './_request';
import type {
    Analysis,
    Place,
    PlaceDetail,
    SearchHistoryItem,
    CompetitorAnalysisResult,
    ViabilityReport,
    ViabilityAnalyzeParams,
    CompanyAnalysisReport,
    CompanyAnalysisParams,
    MarketReport,
    IntelligenceReportItem,
    CnaeCode,
    RfCompanyResult,
    SmartRelationsResult,
    AutoProspStats,
    AutoProspConfig,
    AutoProspLead,
    AutoProspRun,
    AutoProspProfile,
    PaginatedResponse,
    AnalyzeProgressStep,
    AnalyzeStreamCallbacks,
    AnalyzeStreamOptions,
} from './types';

// ─── Analyze stream helpers ──────────────────────────────────────────────────

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
    const res = await fetch('/api/analyze/status?jobId=' + jobId, {
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
            const { jobId, ...immediate } = await request<{ jobId?: string; score?: number }>('/analyze', {
                method: 'POST',
                body: JSON.stringify({
                    ...body,
                    locale: (body.locale as string | undefined) ?? options?.locale ?? detectLocale(),
                }),
            });

            if (!jobId) {
                callbacks.onProgress('done', stepLabel('done'));
                callbacks.onResult(immediate as unknown as Analysis);
                return;
            }

            callbacks.onProgress('profile', stepLabel('profile'));

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

// ─── Competitors ─────────────────────────────────────────────────────────────

export const competitorApi = {
    analyze: (params: { textQuery: string; includedType?: string; pageSize?: number; city?: string; state?: string; country?: string; radiusKm?: number }) =>
        request<CompetitorAnalysisResult>('/competitors', {
            method: 'POST',
            body: JSON.stringify(params),
        }),
};

// ─── Viability ───────────────────────────────────────────────────────────────

export const viabilityApi = {
    analyze: (params: ViabilityAnalyzeParams) =>
        request<ViabilityReport>('/viability', {
            method: 'POST',
            body: JSON.stringify(params),
        }),
};

// ─── Company Analysis ────────────────────────────────────────────────────────

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

// ─── CNAE & Receita Federal ──────────────────────────────────────────────────

export const cnaeApi = {
    search: (q: string, limit = 20) =>
        request<{ codes: CnaeCode[] }>(`/cnae?q=${encodeURIComponent(q)}&limit=${limit}`),
};

export const rfSearchApi = {
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

    stats: () =>
        request<{ totalCompanies: number; totalCnaes: number; available: boolean }>('/rf-search'),
};

// ─── Smart Relations ─────────────────────────────────────────────────────────

export const smartRelationsApi = {
    get: (leadId: string) =>
        request<{ data: SmartRelationsResult }>(`/leads/${encodeURIComponent(leadId)}/relations`),
};

// ─── Integrations ────────────────────────────────────────────────────────────

export const integrationsApi = {
    rdStationSaveToken: (token: string) =>
        request<{ ok: boolean }>('/integrations/rdstation', {
            method: 'POST',
            body: JSON.stringify({ token }),
        }),
    rdStationTest: () =>
        request<{ ok: boolean; connected?: boolean; mode?: 'manual' | 'oauth' | null }>('/integrations/rdstation'),
    rdStationOauthConnectUrl: () =>
        request<{ ok: boolean; url: string }>('/integrations/rdstation/oauth/connect'),
    rdStationDisconnect: () =>
        request<{ ok: boolean }>('/integrations/rdstation/disconnect', { method: 'POST' }),
    agendorTest: () =>
        request<{ ok: boolean; connected?: boolean; source?: 'env' | 'user' | null; user?: { id?: number; name?: string } }>('/integrations/agendor'),
    agendorSaveToken: (token: string) =>
        request<{ ok: boolean }>('/integrations/agendor', {
            method: 'POST',
            body: JSON.stringify({ token }),
        }),
    agendorDisconnect: () =>
        request<{ ok: boolean }>('/integrations/agendor', { method: 'DELETE' }),
    agendorFunnels: () =>
        request<{ data: Array<{ id: number; name: string; sequence?: number }> }>('/integrations/agendor/funnels'),
    agendorDealStages: (funnelId?: number) =>
        request<{ data: Array<{ id: number; name: string; sequence?: number; funnel?: { id: number; name: string } }> }>(
            funnelId ? `/integrations/agendor/deal-stages?funnel_id=${funnelId}` : '/integrations/agendor/deal-stages'
        ),
    agendorUsers: () =>
        request<{ data: Array<{ id: number; name: string; email?: string }> }>('/integrations/agendor/users'),
    rdStationSources: () =>
        request<{ data: Array<{ id: string; name: string; description?: string }> }>('/integrations/rdstation/sources'),
    rdStationCampaigns: () =>
        request<{ data: Array<{ id: string; name: string }> }>('/integrations/rdstation/campaigns'),
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
    hubspotTest: () =>
        request<{ ok: boolean; connected?: boolean; mode?: 'oauth' | null }>('/integrations/hubspot'),
    hubspotOauthConnectUrl: () =>
        request<{ ok: boolean; url: string }>('/integrations/hubspot/oauth/connect'),
    hubspotDisconnect: () =>
        request<{ ok: boolean }>('/integrations/hubspot/disconnect', { method: 'POST' }),
    hubspotPipelines: () =>
        request<{ data: Array<{ id: string; label: string; stages: Array<{ id: string; label: string }> }> }>('/integrations/hubspot/pipelines'),
    hubspotOwners: () =>
        request<{ data: Array<{ id: string; label: string }> }>('/integrations/hubspot/owners'),
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

// ─── Auto-Prospecção ─────────────────────────────────────────────────────────

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
