/**
 * Billing period + credit cycle math.
 *
 * Credits are monthly for every paid plan (annual plans included): at each
 * creditsResetAt boundary unused credits expire and leadsUsed goes back to 0.
 * Paid access itself ends at currentPeriodEnd (+ grace) unless renewed.
 */

export type BillingCycle = 'monthly' | 'annual';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days after currentPeriodEnd during which an unpaid plan keeps working. */
export const PERIOD_GRACE_DAYS = 3;
/** Days before currentPeriodEnd the recurring PIX renewal charge is generated. */
export const PIX_RENEWAL_LEAD_DAYS = 5;
/** Days before creditsResetAt the "your credits are about to expire" email is sent. */
export const CREDITS_EXPIRING_NOTICE_DAYS = 3;
/** Plans whose limit is at least this are treated as unlimited (internal/manual grants). */
export const UNLIMITED_LEADS_THRESHOLD = 100_000;

export function toCycle(value: string | null | undefined): BillingCycle {
    return value === 'annual' ? 'annual' : 'monthly';
}

export function addMonths(from: Date, months: number): Date {
    const d = new Date(from.getTime());
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, lastDay));
    return d;
}

export function addCycle(from: Date, cycle: BillingCycle): Date {
    return addMonths(from, cycle === 'annual' ? 12 : 1);
}

export function addDays(from: Date, days: number): Date {
    return new Date(from.getTime() + days * DAY_MS);
}

/**
 * New period end after a payment. Paying early keeps the remaining days: the new
 * period starts at the later of now and the current period end.
 */
export function extendPeriodEnd(currentPeriodEnd: Date | null | undefined, cycle: BillingCycle, now = new Date()): Date {
    const base = currentPeriodEnd && currentPeriodEnd > now ? currentPeriodEnd : now;
    return addCycle(base, cycle);
}

/** Next credit reset: one month from `from`, never past the paid period end. */
export function nextCreditsResetAt(from: Date, periodEnd?: Date | null): Date {
    const next = addMonths(from, 1);
    if (periodEnd && periodEnd > from && periodEnd < next) return periodEnd;
    return next;
}

/** Credits come back to full at the start of a cycle. */
export function freshCreditCycle(now: Date, periodEnd?: Date | null): { leadsUsed: number; creditsResetAt: Date } {
    return { leadsUsed: 0, creditsResetAt: nextCreditsResetAt(now, periodEnd) };
}

export function isStripeSubscriptionId(id: string | null | undefined): boolean {
    return id != null && id.startsWith('sub_');
}

/** One-time Mercado Pago payment (PIX or card via Checkout Pro) — renewed by recurring PIX charges. */
export function isMpOneTimeId(id: string | null | undefined): boolean {
    return id != null && id.startsWith('mp_pay_');
}

/** Mercado Pago PreApproval (recurring card subscription). */
export function isMpPreapprovalId(id: string | null | undefined): boolean {
    return id != null && id.length > 0 && !isStripeSubscriptionId(id) && !isMpOneTimeId(id);
}

export function daysUntil(date: Date, now = new Date()): number {
    return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / DAY_MS));
}
