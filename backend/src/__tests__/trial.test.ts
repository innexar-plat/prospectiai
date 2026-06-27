import {
    TRIAL_DAYS,
    TRIAL_STATUS,
    TRIAL_EXPIRED_STATUS,
    getTrialEndDate,
    buildTrialWorkspaceData,
    buildTrialUserData,
    isTrialExpired,
    isTrialing,
    getTrialDaysRemaining,
    assertWorkspaceCanUseProduct,
} from '@/lib/trial';
import { PLANS } from '@/lib/billing-config';

describe('trial', () => {
    it('buildTrialWorkspaceData sets TRIAL plan with 50 credits and trialing status', () => {
        const data = buildTrialWorkspaceData('Test WS');
        expect(data.plan).toBe('TRIAL');
        expect(data.leadsLimit).toBe(PLANS.TRIAL.leadsLimit);
        expect(data.subscriptionStatus).toBe(TRIAL_STATUS);
        expect(data.currentPeriodEnd).toBeInstanceOf(Date);
    });

    it('buildTrialUserData sets TRIAL plan', () => {
        const data = buildTrialUserData();
        expect(data.plan).toBe('TRIAL');
        expect(data.leadsLimit).toBe(50);
    });

    it('isTrialExpired returns true when period ended', () => {
        const past = new Date(Date.now() - 1000);
        expect(isTrialExpired({ plan: 'TRIAL', subscriptionStatus: TRIAL_STATUS, currentPeriodEnd: past })).toBe(true);
    });

    it('isTrialing returns true for active trial', () => {
        const future = getTrialEndDate();
        expect(isTrialing({ plan: 'TRIAL', subscriptionStatus: TRIAL_STATUS, currentPeriodEnd: future })).toBe(true);
    });

    it('getTrialDaysRemaining returns days left', () => {
        const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const days = getTrialDaysRemaining({ plan: 'TRIAL', subscriptionStatus: TRIAL_STATUS, currentPeriodEnd: future });
        expect(days).toBeGreaterThanOrEqual(2);
        expect(days).toBeLessThanOrEqual(4);
    });

    it('assertWorkspaceCanUseProduct blocks expired trial', () => {
        const result = assertWorkspaceCanUseProduct({
            plan: 'TRIAL',
            subscriptionStatus: TRIAL_EXPIRED_STATUS,
            currentPeriodEnd: new Date(Date.now() - 1000),
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe('TRIAL_EXPIRED');
    });

    it('assertWorkspaceCanUseProduct blocks US FREE without subscription', () => {
        const result = assertWorkspaceCanUseProduct({
            plan: 'FREE',
            subscriptionStatus: 'inactive',
            leadsLimit: 0,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe('SUBSCRIPTION_REQUIRED');
            expect(result.message).toContain('Subscribe');
        }
    });

    it('assertWorkspaceCanUseProduct allows BR FREE with legacy credits', () => {
        const result = assertWorkspaceCanUseProduct({
            plan: 'FREE',
            subscriptionStatus: 'inactive',
            leadsLimit: 10,
        });
        expect(result.ok).toBe(true);
    });

    it('TRIAL_DAYS is 7', () => {
        expect(TRIAL_DAYS).toBe(7);
    });
});
