import { computeProratedUpgradeAmount } from '@/lib/proration';

describe('proration', () => {
    it('returns null when currentPeriodEnd is null', () => {
        expect(
            computeProratedUpgradeAmount({
                currentPlan: 'BASIC',
                targetPlan: 'PRO',
                cycle: 'monthly',
                currentPeriodEnd: null,
            })
        ).toBeNull();
    });

    it('returns null when currentPeriodEnd is in the past', () => {
        const past = new Date(Date.now() - 86400000);
        expect(
            computeProratedUpgradeAmount({
                currentPlan: 'BASIC',
                targetPlan: 'PRO',
                cycle: 'monthly',
                currentPeriodEnd: past,
            })
        ).toBeNull();
    });

    it('returns prorated amount for monthly upgrade with half period remaining', () => {
        const now = new Date();
        const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
        const result = computeProratedUpgradeAmount({
            currentPlan: 'BASIC',
            targetPlan: 'PRO',
            cycle: 'monthly',
            currentPeriodEnd: in15Days,
        });
        expect(result).not.toBeNull();
        expect(result!.remainingRatio).toBeCloseTo(0.5, 1);
        // BASIC monthly 129 BRL, PRO 397 BRL; diff 268; half = 134
        expect(result!.amountBrl).toBeGreaterThanOrEqual(130);
        expect(result!.amountBrl).toBeLessThanOrEqual(140);
        expect(result!.amountUsd).toBeGreaterThan(0);
    });

    it('returns zero amount when target is same tier (no upgrade)', () => {
        const now = new Date();
        const in10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
        const result = computeProratedUpgradeAmount({
            currentPlan: 'PRO',
            targetPlan: 'PRO',
            cycle: 'monthly',
            currentPeriodEnd: in10Days,
        });
        expect(result).not.toBeNull();
        expect(result!.amountBrl).toBe(0);
        expect(result!.amountUsd).toBe(0);
    });
});
