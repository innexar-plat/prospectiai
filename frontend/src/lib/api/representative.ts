import { request } from './_request';
import type { RepresentativeDTO, RepDashboardDTO, RepCommissionDTO, RepClientDTO, RepAffiliateDTO, RepPaymentDTO, WhatsAppConversationDTO, WhatsAppMessageDTO } from './types';
import type { RepClientStatus } from '@/lib/rep-client-status';

export interface RepClientInput {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    planId?: string;
    valueCents?: number;
    status?: RepClientStatus;
    notes?: string;
}

export const representativeApi = {
    me: () => request<RepresentativeDTO>('/representative/me'),

    getDashboard: () => request<RepDashboardDTO>('/representative/dashboard'),

    getCommissions: (params?: { page?: number; limit?: number; status?: string }) => {
        const q = new URLSearchParams();
        if (params?.page != null) q.set('page', String(params.page));
        if (params?.limit != null) q.set('limit', String(params.limit));
        if (params?.status) q.set('status', params.status);
        return request<{ items: RepCommissionDTO[]; total: number; page: number; limit: number }>(`/representative/commissions?${q}`);
    },

    getClients: (params?: { page?: number; limit?: number; status?: string }) => {
        const q = new URLSearchParams();
        if (params?.page != null) q.set('page', String(params.page));
        if (params?.limit != null) q.set('limit', String(params.limit));
        if (params?.status) q.set('status', params.status);
        return request<{ items: RepClientDTO[]; total: number; page: number; limit: number }>(`/representative/clients?${q}`);
    },

    createClient: (data: RepClientInput) =>
        request<RepClientDTO>('/representative/clients', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updateClient: (id: string, data: Partial<RepClientInput>) =>
        request<RepClientDTO>(`/representative/clients/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    deleteClient: (id: string) =>
        request<{ ok: boolean }>(`/representative/clients/${id}`, { method: 'DELETE' }),

    getAffiliates: (params?: { page?: number; limit?: number }) => {
        const q = new URLSearchParams();
        if (params?.page != null) q.set('page', String(params.page));
        if (params?.limit != null) q.set('limit', String(params.limit));
        return request<{ items: RepAffiliateDTO[]; total: number; page: number; limit: number }>(`/representative/affiliates?${q}`);
    },

    getLink: () => request<{ link: string; code: string }>('/representative/link'),

    getPayments: (params?: { page?: number; limit?: number; year?: number; month?: number }) => {
        const q = new URLSearchParams();
        if (params?.page != null) q.set('page', String(params.page));
        if (params?.limit != null) q.set('limit', String(params.limit));
        if (params?.year != null) q.set('year', String(params.year));
        if (params?.month != null) q.set('month', String(params.month));
        return request<{ items: RepPaymentDTO[]; total: number; page: number; limit: number }>(`/representative/payments?${q}`);
    },

    connectWhatsApp: () =>
        request<{ qrCode: string | null; instanceName: string }>('/representative/whatsapp/connect', { method: 'POST' }),

    getWhatsAppStatus: () =>
        request<{ status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'; number: string | null; provider?: 'EVOLUTION' | 'META' }>('/representative/whatsapp/status'),

    disconnectWhatsApp: () =>
        request<{ ok: boolean }>('/representative/whatsapp/disconnect', { method: 'POST' }),

    sendWhatsApp: (repClientId: string, message: string) =>
        request<{ ok: boolean }>('/representative/whatsapp/send', {
            method: 'POST',
            body: JSON.stringify({ repClientId, message }),
        }),

    connectMetaWhatsApp: (data: { phoneNumberId: string; phoneNumber?: string }) =>
        request<{ ok: boolean }>('/representative/whatsapp/meta/connect', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getChatConversations: (params?: { limit?: number; offset?: number }) => {
        const q = new URLSearchParams();
        if (params?.limit != null) q.set('limit', String(params.limit));
        if (params?.offset != null) q.set('offset', String(params.offset));
        return request<{ items: WhatsAppConversationDTO[]; total: number; limit: number; offset: number }>(`/representative/whatsapp/chat/conversations?${q}`);
    },

    getChatMessages: (conversationId: string, params?: { limit?: number; offset?: number }) => {
        const q = new URLSearchParams();
        if (params?.limit != null) q.set('limit', String(params.limit));
        if (params?.offset != null) q.set('offset', String(params.offset));
        return request<{ items: WhatsAppMessageDTO[]; total: number; limit: number; offset: number }>(`/representative/whatsapp/chat/conversations/${conversationId}/messages?${q}`);
    },

    markChatRead: (conversationId: string) =>
        request<{ ok: boolean }>(`/representative/whatsapp/chat/conversations/${conversationId}/read`, { method: 'POST' }),

    sendChatMessage: (contactNumber: string, message: string) =>
        request<{ ok: boolean; conversationId: string; messageId: string }>('/representative/whatsapp/chat/send', {
            method: 'POST',
            body: JSON.stringify({ contactNumber, message }),
        }),
};
