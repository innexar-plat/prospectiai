import { PLANS } from '@/lib/billing-config';

describe('Billing Plans', () => {
    it('should have correct limits for each plan', () => {
        expect(PLANS.FREE.leadsLimit).toBe(5);
        expect(PLANS.BASIC.leadsLimit).toBe(100);
        expect(PLANS.PRO.leadsLimit).toBe(400);
        expect(PLANS.BUSINESS.leadsLimit).toBe(1200);
    });

    it('should have BRL prices for all paid plans', () => {
        expect(PLANS.BASIC.monthly.price_brl).toBe(129);
        expect(PLANS.PRO.monthly.price_brl).toBe(397);
        expect(PLANS.BUSINESS.monthly.price_brl).toBe(997);
    });
});
