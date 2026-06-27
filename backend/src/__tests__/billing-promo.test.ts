import { describe, expect, it, beforeEach } from '@jest/globals';
import {
    STARTER_PROMO_BR,
    STARTER_PROMO_BR_PLAN_ID,
    buildMpExternalReference,
    buildPromoCheckoutContext,
    canApplyStarterPromo,
    createPromoToken,
    getStarterPromoPublicInfo,
    isStarterPromoEligibleWorkspace,
    parseMpExternalReference,
    resolvePromoIdFromInput,
    verifyPromoToken,
} from '@/lib/billing-promo';
import { TRIAL_EXPIRED_STATUS } from '@/lib/trial';

describe('billing-promo', () => {
    beforeEach(() => {
        process.env.AUTH_SECRET = 'test-auth-secret-min-16-chars';
    });

    it('resolves promo id from plan id STARTER_PROMO_BR', () => {
        expect(resolvePromoIdFromInput(null, STARTER_PROMO_BR_PLAN_ID)).toBe('starter-6m');
    });

    it('resolves promo aliases starter-6m and reactivation', () => {
        expect(resolvePromoIdFromInput('starter-6m')).toBe('starter-6m');
        expect(resolvePromoIdFromInput('reactivation')).toBe('starter-6m');
        expect(resolvePromoIdFromInput('unknown')).toBeNull();
    });

    it('buildPromoCheckoutContext returns R$59 for 6 months on BASIC', () => {
        const ctx = buildPromoCheckoutContext('starter-6m');
        expect(ctx).toEqual({
            promoId: 'starter-6m',
            planId: 'BASIC',
            priceBrl: 59,
            regularPriceBrl: 99,
            months: 6,
        });
    });

    it('getStarterPromoPublicInfo exposes BR promo metadata', () => {
        expect(getStarterPromoPublicInfo(true)).toMatchObject({
            priceMonthlyBrl: 59,
            regularPriceMonthlyBrl: 99,
            months: 6,
            eligible: true,
        });
    });

    it('isStarterPromoEligibleWorkspace for trial expired BR workspace', () => {
        expect(
            isStarterPromoEligibleWorkspace(
                { plan: 'TRIAL', subscriptionStatus: TRIAL_EXPIRED_STATUS },
                'BR',
            ),
        ).toBe(true);
        expect(
            isStarterPromoEligibleWorkspace({ starterPromoEligible: true }, 'BR'),
        ).toBe(true);
        expect(
            isStarterPromoEligibleWorkspace({ plan: 'PRO' }, 'BR'),
        ).toBe(false);
        expect(
            isStarterPromoEligibleWorkspace({ starterPromoEligible: true }, 'US'),
        ).toBe(false);
    });

    it('canApplyStarterPromo requires monthly BR trial-expired workspace', () => {
        const workspace = { plan: 'TRIAL', subscriptionStatus: TRIAL_EXPIRED_STATUS };
        expect(canApplyStarterPromo(workspace, 'BR', 'monthly')).toBe(true);
        expect(canApplyStarterPromo(workspace, 'BR', 'annual')).toBe(false);
        expect(canApplyStarterPromo(workspace, 'US', 'monthly')).toBe(false);
    });

    it('builds and parses MP external reference with promo', () => {
        const extRef = buildMpExternalReference({
            userId: 'u1',
            planId: 'BASIC',
            cycle: 'monthly',
            affiliateCode: 'aff1',
            promoId: STARTER_PROMO_BR.id,
        });
        expect(parseMpExternalReference(extRef)).toEqual({
            userId: 'u1',
            planId: 'BASIC',
            cycle: 'monthly',
            affiliateCode: 'aff1',
            promoId: 'starter-6m',
        });
    });

    it('creates and verifies signed promo token', () => {
        const token = createPromoToken('user-1', 'starter-6m', 7);
        expect(verifyPromoToken(token, 'user-1')).toEqual({ valid: true, promoId: 'starter-6m' });
        expect(verifyPromoToken(token, 'other-user').valid).toBe(false);
    });
});
