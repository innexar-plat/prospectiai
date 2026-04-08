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

// Simple sliding window rate limiter
const timestamps: number[] = [];

function isRateLimited(): boolean {
    const now = Date.now();
    // Remove timestamps older than window
    while (timestamps.length > 0 && timestamps[0] < now - WINDOW_MS) {
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

function escapeMarkdown(text: string): string {
    // Escape special chars for MarkdownV2
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
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

    let text = `${emoji} *${escapeMarkdown(label)}* — ${escapeMarkdown(opts.title)}\n\n`;
    text += `${escapeMarkdown(opts.message)}\n`;

    if (opts.meta && Object.keys(opts.meta).length > 0) {
        text += '\n';
        for (const [key, value] of Object.entries(opts.meta)) {
            if (value != null) {
                text += `• *${escapeMarkdown(key)}*: \`${escapeMarkdown(String(value))}\`\n`;
            }
        }
    }

    text += `\n🕐 ${escapeMarkdown(timestamp)}`;
    text += `\n🏷 ${escapeMarkdown('PrecisionAI')}`;

    text = truncate(text, MAX_MESSAGE_LENGTH);

    try {
        const url = `${TELEGRAM_API}/bot${config.token}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: config.chatId,
                text,
                parse_mode: 'MarkdownV2',
                disable_web_page_preview: true,
            }),
            signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            process.stderr.write(`[telegram-alert] API error ${res.status}: ${body}\n`);
            return false;
        }
        return true;
    } catch (err) {
        process.stderr.write(
            `[telegram-alert] Send failed: ${err instanceof Error ? err.message : 'Unknown'}\n`
        );
        return false;
    }
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
