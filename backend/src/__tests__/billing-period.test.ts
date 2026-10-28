import {
    addMonths,
    extendPeriodEnd,
    nextCreditsResetAt,
    freshCreditCycle,
    isMpOneTimeId,
    isMpPreapprovalId,
    isStripeSubscriptionId,
    toCycle,
} from '@/lib/billing-period';

describe('billing-period', () => {
    it('addMonths clamps to the last day of shorter months', () => {
        expect(addMonths(new Date('2026-01-31T12:00:00Z'), 1).toISOString()).toBe('2026-02-28T12:00:00.000Z');
        expect(addMonths(new Date('2026-03-15T00:00:00Z'), 12).toISOString()).toBe('2027-03-15T00:00:00.000Z');
    });

    it('extendPeriodEnd keeps remaining paid days when paying early', () => {
        const now = new Date('2026-10-01T00:00:00Z');
        const end = new Date('2026-10-05T00:00:00Z');
        expect(extendPeriodEnd(end, 'monthly', now).toISOString()).toBe('2026-11-05T00:00:00.000Z');
    });

    it('extendPeriodEnd starts from now when the period already ended', () => {
        const now = new Date('2026-10-10T00:00:00Z');
        expect(extendPeriodEnd(new Date('2026-09-01T00:00:00Z'), 'annual', now).toISOString()).toBe('2027-10-10T00:00:00.000Z');
        expect(extendPeriodEnd(null, 'monthly', now).toISOString()).toBe('2026-11-10T00:00:00.000Z');
    });

    it('nextCreditsResetAt is monthly even for annual periods, capped at period end', () => {
        const now = new Date('2026-10-10T00:00:00Z');
        expect(nextCreditsResetAt(now, new Date('2027-10-10T00:00:00Z')).toISOString()).toBe('2026-11-10T00:00:00.000Z');
        expect(nextCreditsResetAt(now, new Date('2026-10-20T00:00:00Z')).toISOString()).toBe('2026-10-20T00:00:00.000Z');
    });

    it('freshCreditCycle zeroes usage', () => {
        const c = freshCreditCycle(new Date('2026-10-10T00:00:00Z'), null);
        expect(c.leadsUsed).toBe(0);
        expect(c.creditsResetAt.toISOString()).toBe('2026-11-10T00:00:00.000Z');
    });

    it('classifies subscription ids', () => {
        expect(isStripeSubscriptionId('sub_123')).toBe(true);
        expect(isMpOneTimeId('mp_pay_1')).toBe(true);
        expect(isMpPreapprovalId('2c938084abc')).toBe(true);
        expect(isMpPreapprovalId('mp_pay_1')).toBe(false);
        expect(isMpPreapprovalId(null)).toBe(false);
        expect(toCycle('annual')).toBe('annual');
        expect(toCycle(undefined)).toBe('monthly');
    });
});
