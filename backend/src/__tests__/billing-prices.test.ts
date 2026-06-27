import { describe, expect, it } from '@jest/globals';
import { getMarketPlanPrices } from '@/lib/billing-prices';
import { getMarketLeadsLimit } from '@/lib/market';

describe('billing-prices / market leads', () => {
    it('US BASIC is $19/month with 50 credits', () => {
        const monthly = getMarketPlanPrices('BASIC', 'monthly', 'US');
        expect(monthly.primary).toBe(19);
        expect(monthly.currency).toBe('USD');
        expect(monthly.leadsLimit).toBe(50);
    });

    it('US BASIC annual is $190/year (10x monthly)', () => {
        const annual = getMarketPlanPrices('BASIC', 'annual', 'US');
        expect(annual.primary).toBe(190);
        expect(annual.currency).toBe('USD');
    });

    it('BR BASIC keeps 100 credits at R$99', () => {
        const monthly = getMarketPlanPrices('BASIC', 'monthly', 'BR');
        expect(monthly.primary).toBe(99);
        expect(monthly.currency).toBe('BRL');
        expect(monthly.leadsLimit).toBe(100);
    });

    it('BR BASIC promo applies R$59 when promoId is set', () => {
        const monthly = getMarketPlanPrices('BASIC', 'monthly', 'BR', { promoId: 'starter-6m' });
        expect(monthly.primary).toBe(59);
        expect(monthly.promo).toMatchObject({
            priceBrl: 59,
            regularPriceBrl: 99,
            months: 6,
        });
    });

    it('getMarketLeadsLimit applies US override only for BASIC', () => {
        expect(getMarketLeadsLimit('BASIC', 'US')).toBe(50);
        expect(getMarketLeadsLimit('BASIC', 'BR')).toBe(100);
        expect(getMarketLeadsLimit('PRO', 'US')).toBe(400);
    });
});
