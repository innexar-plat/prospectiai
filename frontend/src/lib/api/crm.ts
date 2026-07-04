import { request } from './_request';
import type {
    LeadAnalysisListItem,
    LeadStats,
    PipelineBrief,
    ConversionStats,
    LeadTagItem,
    NotificationItem,
} from './types';

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

export const pipelineApi = {
    getDailyBrief: () => request<PipelineBrief>('/pipeline/daily-brief'),
    getStats: () => request<ConversionStats>('/pipeline/stats'),
};

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
