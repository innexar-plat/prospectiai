import { PLANS, getPlanPrices, isUpgrade, isDowngrade, type PlanType, type BillingCycle } from '@/lib/billing-config';

describe('billing-config', () => {
    it('getPlanPrices returns monthly prices for BASIC', () => {
        const plan = PLANS.BASIC;
        const prices = getPlanPrices(plan, 'monthly');
        expect(prices.price_brl).toBe(129);
        expect(prices.price_usd).toBe(25);
    });

    it('getPlanPrices returns annual prices for PRO', () => {
        const plan = PLANS.PRO;
        const prices = getPlanPrices(plan, 'annual');
        expect(prices.price_brl).toBe(4049);
        expect(prices.price_usd).toBe(805);
    });

    it('FREE plan has zero prices', () => {
        const monthly = getPlanPrices(PLANS.FREE, 'monthly');
        expect(monthly.price_brl).toBe(0);
        expect(monthly.price_usd).toBe(0);
    });

    it('isUpgrade returns true for lower to higher tier', () => {
        expect(isUpgrade('FREE', 'BASIC')).toBe(true);
        expect(isUpgrade('BASIC', 'PRO')).toBe(true);
        expect(isUpgrade('PRO', 'BUSINESS')).toBe(true);
    });

    it('isUpgrade returns false for same or downgrade', () => {
        expect(isUpgrade('BASIC', 'BASIC')).toBe(false);
        expect(isUpgrade('PRO', 'BASIC')).toBe(false);
        expect(isUpgrade('FREE', 'FREE')).toBe(false);
    });

    it('isDowngrade is opposite of isUpgrade for different tiers', () => {
        expect(isDowngrade('PRO', 'BASIC')).toBe(true);
        expect(isUpgrade('BASIC', 'PRO')).toBe(true);
    });

    it('isDowngrade returns false for unknown plan', () => {
        expect(isDowngrade('UNKNOWN' as PlanType, 'BASIC')).toBe(false);
        expect(isDowngrade('BASIC', 'UNKNOWN' as PlanType)).toBe(false);
    });

    it('isUpgrade returns false for unknown plan', () => {
        expect(isUpgrade('UNKNOWN' as PlanType, 'PRO')).toBe(false);
        expect(isUpgrade('BASIC', 'UNKNOWN' as PlanType)).toBe(false);
    });
});
