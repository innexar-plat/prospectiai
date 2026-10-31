import { request } from './_request';

export type SupportTicketStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';
export type SupportTicketCategory = 'QUESTION' | 'PROBLEM' | 'BILLING' | 'SUGGESTION';

export interface SupportTicketSummary {
    id: string;
    number: number;
    subject: string;
    category: SupportTicketCategory;
    status: SupportTicketStatus;
    lastMessageAt: string;
    createdAt: string;
    closedAt: string | null;
}

export interface SupportMessageItem {
    id: string;
    authorType: 'USER' | 'ADMIN';
    body: string;
    createdAt: string;
}

export interface SupportTicketDetail extends SupportTicketSummary {
    messages: SupportMessageItem[];
}

export const supportApi = {
    list: () => request<{ tickets: SupportTicketSummary[] }>('/support/tickets'),
    get: (id: string) => request<{ ticket: SupportTicketDetail }>(`/support/tickets/${id}`),
    create: (body: { subject: string; category: SupportTicketCategory; message: string; context?: { page?: string; userAgent?: string } }) =>
        request<{ ticket: SupportTicketSummary }>('/support/tickets', { method: 'POST', body: JSON.stringify(body) }),
    reply: (id: string, body: string) =>
        request<{ ticket: SupportTicketDetail }>(`/support/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
    close: (id: string) => request<{ ticket: SupportTicketDetail }>(`/support/tickets/${id}`, { method: 'PATCH', body: '{}' }),
};
