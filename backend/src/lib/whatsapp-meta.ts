/**
 * Thin client for the official WhatsApp Business Cloud API (Meta Graph API).
 * One phone number per Representative/AdminWhatsAppConfig, all registered under the
 * company's own verified WhatsApp Business Account (WABA) — see docs/whatsapp-meta.md
 * for the external Meta Business Suite setup this depends on.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { fetchWithRetry } from '@/lib/fetch-http';

const GRAPH_VERSION = 'v21.0';

function getAccessToken(): string {
    return process.env.META_WHATSAPP_ACCESS_TOKEN ?? '';
}

export function isMetaWhatsAppConfigured(): boolean {
    return Boolean(getAccessToken() && process.env.META_WHATSAPP_APP_SECRET);
}

export type WhatsAppSendResult =
    | { ok: true; providerMessageId: string }
    | { ok: false; error: string; outsideWindow?: boolean };

/** Sends a free-form text message. Only works within 24h of the contact's last inbound message. */
export async function sendMetaText(phoneNumberId: string, to: string, text: string): Promise<WhatsAppSendResult> {
    if (!isMetaWhatsAppConfigured()) {
        return { ok: false, error: 'Meta WhatsApp Cloud API not configured' };
    }
    try {
        const res = await fetchWithRetry(
            `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getAccessToken()}`,
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to,
                    type: 'text',
                    text: { body: text },
                }),
            },
            { timeoutMs: 15000, maxRetries: 1 },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            const errorCode = (body as { error?: { code?: number; message?: string } })?.error?.code;
            const errorMessage = (body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
            // 131047 = "re-engagement message" — outside the 24h customer-service window, needs a template.
            return { ok: false, error: errorMessage, outsideWindow: errorCode === 131047 };
        }
        const providerMessageId = (body as { messages?: { id?: string }[] })?.messages?.[0]?.id ?? '';
        return { ok: true, providerMessageId };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
}

/** Sends a pre-approved template message (required outside the 24h window). */
export async function sendMetaTemplate(
    phoneNumberId: string,
    to: string,
    templateName: string,
    languageCode: string,
    bodyParams: string[] = [],
): Promise<WhatsAppSendResult> {
    if (!isMetaWhatsAppConfigured()) {
        return { ok: false, error: 'Meta WhatsApp Cloud API not configured' };
    }
    try {
        const res = await fetchWithRetry(
            `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getAccessToken()}`,
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to,
                    type: 'template',
                    template: {
                        name: templateName,
                        language: { code: languageCode },
                        ...(bodyParams.length
                            ? { components: [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }] }
                            : {}),
                    },
                }),
            },
            { timeoutMs: 15000, maxRetries: 1 },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            const errorMessage = (body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
            return { ok: false, error: errorMessage };
        }
        const providerMessageId = (body as { messages?: { id?: string }[] })?.messages?.[0]?.id ?? '';
        return { ok: true, providerMessageId };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
}

/** Verifies the GET subscription handshake Meta sends when you register the webhook URL. */
export function verifyMetaWebhookChallenge(mode: string | null, token: string | null): boolean {
    return mode === 'subscribe' && !!token && token === process.env.META_WHATSAPP_VERIFY_TOKEN;
}

/** Verifies the X-Hub-Signature-256 header using the app secret (HMAC-SHA256 of the raw body). */
export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    const appSecret = process.env.META_WHATSAPP_APP_SECRET;
    if (!appSecret || !signatureHeader) return false;
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const provided = signatureHeader.replace(/^sha256=/, '');
    try {
        return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
    } catch {
        return false;
    }
}

export type MetaIncomingMessage = {
    phoneNumberId: string;
    from: string;
    contactName: string | null;
    providerMessageId: string;
    body: string;
    timestamp: string;
};

export type MetaStatusUpdate = {
    phoneNumberId: string;
    providerMessageId: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
};

/** Normalizes a Meta webhook POST payload into incoming messages and status updates. */
export function parseMetaWebhookPayload(payload: unknown): { messages: MetaIncomingMessage[]; statuses: MetaStatusUpdate[] } {
    const messages: MetaIncomingMessage[] = [];
    const statuses: MetaStatusUpdate[] = [];

    const entries = (payload as { entry?: unknown[] })?.entry ?? [];
    for (const entry of entries) {
        const changes = (entry as { changes?: unknown[] })?.changes ?? [];
        for (const change of changes) {
            const value = (change as { value?: Record<string, unknown> })?.value;
            if (!value) continue;
            const phoneNumberId = (value.metadata as { phone_number_id?: string } | undefined)?.phone_number_id ?? '';
            const contacts = (value.contacts as { wa_id?: string; profile?: { name?: string } }[] | undefined) ?? [];
            const nameByWaId = new Map(contacts.map((c) => [c.wa_id, c.profile?.name ?? null]));

            const incoming = (value.messages as { from?: string; id?: string; timestamp?: string; type?: string; text?: { body?: string } }[] | undefined) ?? [];
            for (const m of incoming) {
                if (m.type !== 'text' || !m.from || !m.id) continue;
                messages.push({
                    phoneNumberId,
                    from: m.from,
                    contactName: nameByWaId.get(m.from) ?? null,
                    providerMessageId: m.id,
                    body: m.text?.body ?? '',
                    timestamp: m.timestamp ?? '',
                });
            }

            const statusUpdates = (value.statuses as { id?: string; status?: string }[] | undefined) ?? [];
            for (const s of statusUpdates) {
                if (!s.id || !s.status) continue;
                if (!['sent', 'delivered', 'read', 'failed'].includes(s.status)) continue;
                statuses.push({ phoneNumberId, providerMessageId: s.id, status: s.status as MetaStatusUpdate['status'] });
            }
        }
    }

    return { messages, statuses };
}
