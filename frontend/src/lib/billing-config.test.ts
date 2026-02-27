import { describe, it, expect } from 'vitest';
import { PLANS, getPlanDisplayName, type PlanType } from './billing-config';

describe('billing-config', () => {
    describe('getPlanDisplayName', () => {
        it('returns display name for known plan keys', () => {
            expect(getPlanDisplayName('FREE')).toBe('Free');
            expect(getPlanDisplayName('BASIC')).toBe('Starter');
            expect(getPlanDisplayName('PRO')).toBe('Growth');
            expect(getPlanDisplayName('BUSINESS')).toBe('Business');
            expect(getPlanDisplayName('SCALE')).toBe('Enterprise');
        });

        it('returns the key when plan is unknown', () => {
            expect(getPlanDisplayName('UNKNOWN')).toBe('UNKNOWN');
            expect(getPlanDisplayName('')).toBe('');
        });
    });

    describe('PLANS', () => {
        it('defines all plan keys with name and leadsLimit', () => {
            const keys: PlanType[] = ['FREE', 'BASIC', 'PRO', 'BUSINESS', 'SCALE'];
            for (const key of keys) {
                expect(PLANS[key].name).toBeDefined();
                expect(typeof PLANS[key].leadsLimit).toBe('number');
                expect(PLANS[key].monthly).toBeDefined();
                expect(PLANS[key].annual).toBeDefined();
            }
        });

        it('FREE has zero price and low leads limit', () => {
            expect(PLANS.FREE.leadsLimit).toBe(5);
            expect(PLANS.FREE.monthly.price_brl).toBe(0);
            expect(PLANS.FREE.annual.price_brl).toBe(0);
        });
    });
});
