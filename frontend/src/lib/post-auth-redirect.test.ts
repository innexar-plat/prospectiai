import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    CHECKOUT_DONE_KEY,
    PENDING_CREDITS_TOUR_KEY,
    clearCheckoutDone,
    clearPendingCreditsTour,
    getPostAuthRedirect,
    getSignupCallbackPath,
    isCheckoutDone,
    isPendingCreditsTour,
    markCheckoutDone,
    needsCheckoutBeforeOnboarding,
} from './post-auth-redirect';
import type { SessionUser } from './api';
import { MARKET_COOKIE } from './market';

const baseUser: SessionUser = {
    id: 'u1',
    email: 'user@example.com',
    name: 'User',
    plan: 'FREE',
    leadsUsed: 0,
    leadsLimit: 0,
};

describe('post-auth-redirect', () => {
    const originalHostname = window.location.hostname;

    beforeEach(() => {
        sessionStorage.clear();
        document.cookie = `${MARKET_COOKIE}=;path=/;max-age=0`;
    });

    afterEach(() => {
        vi.stubGlobal('location', { ...window.location, hostname: originalHostname });
        document.cookie = `${MARKET_COOKIE}=;path=/;max-age=0`;
    });

    describe('checkout session flags', () => {
        it('marks and reads checkout done in sessionStorage', () => {
            expect(isCheckoutDone()).toBe(false);
            markCheckoutDone();
            expect(isCheckoutDone()).toBe(true);
            expect(sessionStorage.getItem(CHECKOUT_DONE_KEY)).toBe('1');
        });

        it('clears checkout done flag', () => {
            markCheckoutDone();
            clearCheckoutDone();
            expect(isCheckoutDone()).toBe(false);
        });

        it('marks pending credits tour when checkout completes', () => {
            expect(isPendingCreditsTour()).toBe(false);
            markCheckoutDone();
            expect(isPendingCreditsTour()).toBe(true);
            expect(sessionStorage.getItem(PENDING_CREDITS_TOUR_KEY)).toBe('1');
            clearPendingCreditsTour();
            expect(isPendingCreditsTour()).toBe(false);
        });
    });

    describe('needsCheckoutBeforeOnboarding', () => {
        it('is always true for BR and US', () => {
            vi.stubGlobal('location', { ...window.location, hostname: 'precisionia.com.br', protocol: 'https:' });
            expect(needsCheckoutBeforeOnboarding()).toBe(true);
            vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
            expect(needsCheckoutBeforeOnboarding()).toBe(true);
        });
    });

    describe('getPostAuthRedirect', () => {
        it('sends unauthenticated users to sign-in', () => {
            expect(getPostAuthRedirect(null)).toBe('/auth/signin');
            expect(getPostAuthRedirect(undefined)).toBe('/auth/signin');
        });

        it('sends onboarded users to dashboard', () => {
            const user = { ...baseUser, requiresOnboarding: false };
            expect(getPostAuthRedirect(user)).toBe('/dashboard');
        });

        it('sends new BR users to checkout before checkout step', () => {
            vi.stubGlobal('location', { ...window.location, hostname: 'precisionia.com.br', protocol: 'https:' });
            const user = { ...baseUser, requiresOnboarding: true };
            expect(getPostAuthRedirect(user)).toBe('/checkout');
        });

        it('sends users to onboarding after checkout step is marked', () => {
            vi.stubGlobal('location', { ...window.location, hostname: 'precisionia.com.br', protocol: 'https:' });
            const user = { ...baseUser, requiresOnboarding: true };
            markCheckoutDone();
            expect(getPostAuthRedirect(user)).toBe('/onboarding');
        });

        it('prefers checkout over onboarding when checkout is not done', () => {
            vi.stubGlobal('location', { ...window.location, hostname: 'precisionia.com.br', protocol: 'https:' });
            const user: SessionUser = { ...baseUser, requiresOnboarding: true, plan: 'FREE' as const };
            expect(getPostAuthRedirect(user)).toBe('/checkout');
        });

        it('sends new US users to checkout before checkout (same as BR)', () => {
            vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
            const user = { ...baseUser, requiresOnboarding: true };
            expect(needsCheckoutBeforeOnboarding()).toBe(true);
            expect(getPostAuthRedirect(user)).toBe('/checkout');
        });

        it('sends US users to onboarding after checkout is marked', () => {
            vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
            const user = { ...baseUser, requiresOnboarding: true };
            markCheckoutDone();
            expect(getPostAuthRedirect(user)).toBe('/onboarding');
        });

        it('signup callback defaults to checkout on both markets', () => {
            vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
            expect(getSignupCallbackPath(null)).toBe('/checkout');
            expect(getSignupCallbackPath(undefined)).toBe('/checkout');
            vi.stubGlobal('location', { ...window.location, hostname: 'precisionia.com.br', protocol: 'https:' });
            expect(getSignupCallbackPath(null)).toBe('/checkout');
            expect(getSignupCallbackPath('/accept-invite?token=abc')).toBe('/accept-invite?token=abc');
        });

        it('returns relative paths only (stays on current market domain)', () => {
            const cases = [
                getPostAuthRedirect(null),
                getPostAuthRedirect({ ...baseUser, requiresOnboarding: false }),
                getPostAuthRedirect({ ...baseUser, requiresOnboarding: true }),
            ];
            for (const path of cases) {
                expect(path.startsWith('/')).toBe(true);
                expect(path).not.toMatch(/^https?:\/\//);
                expect(path).not.toContain('precisionia.com.br');
                expect(path).not.toContain('precisionai.innexar.app');
            }
        });
    });
});
