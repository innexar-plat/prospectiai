/**
 * Thin client for the self-hosted Evolution API (WhatsApp gateway).
 * One Evolution "instance" per Representative, named `rep_<representativeId>`.
 *
 * Docs: https://doc.evolution-api.com
 */
import { fetchWithRetry } from '@/lib/fetch-http';

function getBaseUrl(): string {
    return (process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '');
}

function getApiKey(): string {
    return process.env.EVOLUTION_API_KEY ?? '';
}

export function isEvolutionConfigured(): boolean {
    return Boolean(getBaseUrl() && getApiKey());
}

export function instanceNameForRep(representativeId: string): string {
    return `rep_${representativeId}`;
}

async function evolutionFetch(path: string, init: RequestInit = {}): Promise<Response> {
    if (!isEvolutionConfigured()) {
        throw new Error('Evolution API not configured (EVOLUTION_API_URL/EVOLUTION_API_KEY)');
    }
    return fetchWithRetry(`${getBaseUrl()}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            apikey: getApiKey(),
            ...init.headers,
        },
    }, { timeoutMs: 15000, maxRetries: 2 });
}

export type EvolutionConnectionState = 'open' | 'connecting' | 'close';

/** Creates the instance if it doesn't exist yet; safe to call repeatedly. */
export async function ensureInstance(instanceName: string): Promise<void> {
    const res = await evolutionFetch('/instance/create', {
        method: 'POST',
        body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
        }),
    });
    // 403/409-ish "already exists" responses are fine — the instance is usable either way.
    if (!res.ok && res.status !== 403 && res.status !== 409) {
        throw new Error(`Evolution instance/create failed: HTTP ${res.status}`);
    }
    await configureWebhook(instanceName).catch(() => undefined);
}

/** Points the instance's webhook at our receiver, tagged with a shared secret we can verify. */
async function configureWebhook(instanceName: string): Promise<void> {
    const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '');
    const token = process.env.EVOLUTION_WEBHOOK_TOKEN;
    if (!siteUrl || !token) return;

    await evolutionFetch(`/webhook/set/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        body: JSON.stringify({
            webhook: {
                url: `${siteUrl}/api/representative/whatsapp/webhook?token=${encodeURIComponent(token)}`,
                enabled: true,
                events: ['CONNECTION_UPDATE', 'MESSAGES_UPSERT'],
            },
        }),
    });
}

/** Returns the QR code (base64 data URI) to scan, or null if not available right now. */
export async function getQrCode(instanceName: string): Promise<string | null> {
    const res = await evolutionFetch(`/instance/connect/${encodeURIComponent(instanceName)}`);
    if (!res.ok) throw new Error(`Evolution instance/connect failed: HTTP ${res.status}`);
    const body = await res.json().catch(() => ({}));
    return (body as { base64?: string; qrcode?: { base64?: string } })?.base64
        ?? (body as { qrcode?: { base64?: string } })?.qrcode?.base64
        ?? null;
}

export async function getInstanceStatus(instanceName: string): Promise<EvolutionConnectionState> {
    const res = await evolutionFetch(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
    if (!res.ok) return 'close';
    const body = await res.json().catch(() => ({}));
    const state = (body as { instance?: { state?: string } })?.instance?.state;
    if (state === 'open' || state === 'connecting') return state;
    return 'close';
}

export async function logoutInstance(instanceName: string): Promise<void> {
    await evolutionFetch(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: 'DELETE' }).catch(() => undefined);
    await evolutionFetch(`/instance/delete/${encodeURIComponent(instanceName)}`, { method: 'DELETE' }).catch(() => undefined);
}

export async function sendText(instanceName: string, number: string, text: string): Promise<void> {
    const res = await evolutionFetch(`/message/sendText/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        body: JSON.stringify({ number, text }),
    });
    if (!res.ok) throw new Error(`Evolution message/sendText failed: HTTP ${res.status}`);
}

export type EvolutionIncomingMessage = {
    from: string;
    contactName: string | null;
    providerMessageId: string;
    body: string;
};

/**
 * Normalizes a MESSAGES_UPSERT webhook payload into an incoming message, or null when it's
 * not a genuine inbound text (group chat, media-only, or an echo of a message we sent — `fromMe: true`).
 */
export function parseEvolutionIncomingMessage(payload: unknown): EvolutionIncomingMessage | null {
    const data = (payload as { data?: Record<string, unknown> })?.data;
    if (!data) return null;

    const key = data.key as { remoteJid?: string; fromMe?: boolean; id?: string } | undefined;
    if (!key?.remoteJid || key.fromMe || !key.id) return null;
    if (key.remoteJid.endsWith('@g.us')) return null; // ignore group chats

    const from = key.remoteJid.split('@')[0];
    if (!from) return null;

    const message = data.message as { conversation?: string; extendedTextMessage?: { text?: string } } | undefined;
    const body = message?.conversation ?? message?.extendedTextMessage?.text ?? '';
    if (!body) return null;

    return {
        from,
        contactName: (data.pushName as string | undefined) ?? null,
        providerMessageId: key.id,
        body,
    };
}
