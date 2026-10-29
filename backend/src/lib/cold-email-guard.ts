/**
 * Deliverability rules for cold outreach sent from the main domain. The domain also carries
 * password resets, PIX and receipts, so volume ramps up slowly and risky recipients are skipped:
 * Receita e-mails are often the accountant's or the fiscal department's, and one accountant
 * receiving the same pitch for ten clients is the fastest way to a spam complaint.
 */
import { resolveMx } from 'node:dns/promises';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Warm-up: 15/day the first week, 30 the second, 60 the third, then the configured ceiling (≤120). */
export function warmupDailyCap(startedAt: Date | null, now: Date, configuredMax: number): number {
    const ceiling = Math.max(1, Math.min(configuredMax, 120));
    if (!startedAt) return Math.min(15, ceiling);
    const day = Math.floor((now.getTime() - startedAt.getTime()) / DAY_MS);
    if (day < 7) return Math.min(15, ceiling);
    if (day < 14) return Math.min(30, ceiling);
    if (day < 21) return Math.min(60, ceiling);
    return ceiling;
}

const ROLE_LOCAL = /^(nfe|nf-e|nfse|xml|danfe|fiscal|sped|contab|contabil|contabilidade|contador|contadora|escrita|tributario|impostos|dp|rh|noreply|no-reply|naoresponda|postmaster|abuse|mailer-daemon)([._-]|\d|$)/i;
const ACCOUNTING_HINT = /(contab|contador|contabil|escritorio|escrit[oó]rio|assessoria|fiscal|tributar)/i;

/** Accountant / fiscal / role addresses: not the decision maker, high complaint risk. */
export function isRiskyRecipient(email: string): boolean {
    const [local = '', domain = ''] = email.toLowerCase().trim().split('@');
    if (!local || !domain || !domain.includes('.')) return true;
    if (ROLE_LOCAL.test(local)) return true;
    return ACCOUNTING_HINT.test(local) || ACCOUNTING_HINT.test(domain.split('.')[0] ?? '');
}

const mxCache = new Map<string, boolean>();

/** Domain accepts mail (has MX). Avoids hard bounces, which hurt reputation more than anything. */
export async function domainAcceptsMail(email: string): Promise<boolean> {
    const domain = email.toLowerCase().split('@')[1];
    if (!domain) return false;
    const cached = mxCache.get(domain);
    if (cached !== undefined) return cached;
    let ok = false;
    try {
        ok = (await resolveMx(domain)).length > 0;
    } catch {
        ok = false;
    }
    mxCache.set(domain, ok);
    return ok;
}

/** Monday–Friday, 09:00–17:59 in Brasília — replies come in business hours, bursts at night look automated. */
export function isBusinessHoursBrt(now: Date): boolean {
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const weekday = brt.getUTCDay();
    const hour = brt.getUTCHours();
    return weekday >= 1 && weekday <= 5 && hour >= 9 && hour < 18;
}

/** Start of the current day in Brasília, as a UTC instant. */
export function brtDayStart(now: Date): Date {
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()) + 3 * 60 * 60 * 1000);
}

/** Spread the day's quota over the half-hourly runs in business hours (18 runs, 09:00–17:30). */
export function perRunQuota(remainingToday: number, now: Date): number {
    if (remainingToday <= 0) return 0;
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const minutesLeft = Math.max(30, (18 * 60) - (brt.getUTCHours() * 60 + brt.getUTCMinutes()));
    const runsLeft = Math.max(1, Math.ceil(minutesLeft / 30));
    return Math.max(1, Math.ceil(remainingToday / runsLeft));
}

/** Plain-text part from the HTML body (multipart mail scores better with spam filters). */
export function htmlToText(html: string): string {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<img[^>]*>/gi, '')
        .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
        .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, '\n')
        .replace(/<li[^>]*>/gi, '- ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
        .trim();
}
