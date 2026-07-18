/**
 * Telegram Bot Alert Service — Observabilidade PrecisionAI
 *
 * Envia alertas formatados para um chat/grupo do Telegram via Bot API.
 * Níveis: 🔴 CRITICAL, 🟡 WARNING, 🔵 INFO, ✅ SUCCESS
 *
 * Rate limiting interno: máx 30 msgs/min (Telegram limit para bots).
 * Env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

const TELEGRAM_API = 'https://api.telegram.org';
const MAX_MESSAGES_PER_MINUTE = 30;
const WINDOW_MS = 60_000;
const MAX_MESSAGE_LENGTH = 4000; // Telegram max ~4096 chars
const RETRY_DELAY_MS = 2_000;

// Simple sliding window rate limiter
const timestamps: number[] = [];

function isRateLimited(): boolean {
    const now = Date.now();
    // Remove timestamps older than window
    while (timestamps.length > 0 && timestamps[0]! < now - WINDOW_MS) {
        timestamps.shift();
    }
    if (timestamps.length >= MAX_MESSAGES_PER_MINUTE) return true;
    timestamps.push(now);
    return false;
}

function getConfig(): { token: string; chatId: string } | null {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
    if (!token || !chatId) return null;
    return { token, chatId };
}

function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max - 20) + '\n\n… (truncado)';
}

/** Escape dynamic text for Telegram HTML parse_mode (&, <, > only). */
export function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type AlertLevel = 'critical' | 'warning' | 'info' | 'success';

const LEVEL_EMOJI: Record<AlertLevel, string> = {
    critical: '🔴',
    warning: '🟡',
    info: '🔵',
    success: '✅',
};

const LEVEL_LABEL: Record<AlertLevel, string> = {
    critical: 'CRITICAL',
    warning: 'WARNING',
    info: 'INFO',
    success: 'SUCCESS',
};

export interface AlertOptions {
    level: AlertLevel;
    title: string;
    message: string;
    /** Extra key-value metadata shown in the alert */
    meta?: Record<string, string | number | boolean | null | undefined>;
    /** If true, bypass rate limiting (for truly critical alerts) */
    force?: boolean;
}

/**
 * Send a formatted alert to Telegram.
 * Fails silently (logs to stderr) — never throws.
 */
export async function sendTelegramAlert(opts: AlertOptions): Promise<boolean> {
    const config = getConfig();
    if (!config) return false;

    if (!opts.force && isRateLimited()) {
        process.stderr.write(`[telegram-alert] Rate limited, dropping: ${opts.title}\n`);
        return false;
    }

    const emoji = LEVEL_EMOJI[opts.level];
    const label = LEVEL_LABEL[opts.level];
    const timestamp = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

    let text = `${emoji} <b>${escapeHtml(label)}</b> — ${escapeHtml(opts.title)}\n\n`;
    text += `${escapeHtml(opts.message)}\n`;

    if (opts.meta && Object.keys(opts.meta).length > 0) {
        text += '\n';
        for (const [key, value] of Object.entries(opts.meta)) {
            if (value != null) {
                text += `• <b>${escapeHtml(key)}</b>: <code>${escapeHtml(String(value))}</code>\n`;
            }
        }
    }

    text += `\n🕐 ${escapeHtml(timestamp)}`;
    text += `\n🏷 ${escapeHtml('PrecisionAI')}`;

    text = truncate(text, MAX_MESSAGE_LENGTH);

    return postTelegramMessage(config.token, config.chatId, text);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postTelegramMessage(token: string, chatId: string, text: string): Promise<boolean> {
    const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
    const body = JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    });

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                signal: AbortSignal.timeout(10_000),
            });

            if (res.ok) return true;

            const responseBody = await res.text().catch(() => '');
            if (attempt === 0) {
                await sleep(RETRY_DELAY_MS);
                continue;
            }
            process.stderr.write(`[telegram-alert] API error ${res.status}: ${responseBody}\n`);
            return false;
        } catch (err) {
            if (attempt === 0) {
                await sleep(RETRY_DELAY_MS);
                continue;
            }
            process.stderr.write(
                `[telegram-alert] Send failed: ${err instanceof Error ? err.message : 'Unknown'}\n`
            );
            return false;
        }
    }
    return false;
}

// ─── Convenience helpers ─────────────────────────────────────────────────────

export function alertCritical(title: string, message: string, meta?: AlertOptions['meta']): Promise<boolean> {
    return sendTelegramAlert({ level: 'critical', title, message, meta, force: true });
}

export function alertWarning(title: string, message: string, meta?: AlertOptions['meta']): Promise<boolean> {
    return sendTelegramAlert({ level: 'warning', title, message, meta });
}

export function alertInfo(title: string, message: string, meta?: AlertOptions['meta']): Promise<boolean> {
    return sendTelegramAlert({ level: 'info', title, message, meta });
}

export function alertSuccess(title: string, message: string, meta?: AlertOptions['meta']): Promise<boolean> {
    return sendTelegramAlert({ level: 'success', title, message, meta });
}
