const BASE = '/api/admin/whatsapp';

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

export interface WhatsAppStatusResponse {
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
  number: string | null;
  provider?: 'EVOLUTION' | 'META';
}

export interface WhatsAppConversationItem {
  id: string;
  contactNumber: string;
  contactName: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
}

export interface WhatsAppMessageItem {
  id: string;
  direction: 'IN' | 'OUT';
  body: string;
  status: string;
  createdAt: string;
}

export const adminWhatsappApi = {
  connect: () => request<{ qrCode: string | null; instanceName: string }>('/connect', { method: 'POST' }),

  connectMeta: (data: { phoneNumberId: string; phoneNumber?: string }) =>
    request<{ ok: boolean }>('/meta/connect', { method: 'POST', body: JSON.stringify(data) }),

  status: () => request<WhatsAppStatusResponse>('/status'),

  disconnect: () => request<{ ok: boolean }>('/disconnect', { method: 'POST' }),

  getConversations: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    return request<{ items: WhatsAppConversationItem[]; total: number; limit: number; offset: number }>(`/chat/conversations?${q}`);
  },

  getMessages: (conversationId: string, params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    return request<{ items: WhatsAppMessageItem[]; total: number; limit: number; offset: number }>(`/chat/conversations/${conversationId}/messages?${q}`);
  },

  markRead: (conversationId: string) =>
    request<{ ok: boolean }>(`/chat/conversations/${conversationId}/read`, { method: 'POST' }),

  send: (contactNumber: string, message: string) =>
    request<{ ok: boolean; conversationId: string; messageId: string }>('/chat/send', {
      method: 'POST',
      body: JSON.stringify({ contactNumber, message }),
    }),
};
