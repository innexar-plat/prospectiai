import type { SessionUser } from '@/lib/api';

export const CHECKOUT_DONE_KEY = 'prospector-checkout-done';
export const PENDING_CREDITS_TOUR_KEY = 'prospector-pending-credits-tour';

export function markCheckoutDone(): void {
    sessionStorage.setItem(CHECKOUT_DONE_KEY, '1');
    sessionStorage.setItem(PENDING_CREDITS_TOUR_KEY, '1');
}

export function isCheckoutDone(): boolean {
    return sessionStorage.getItem(CHECKOUT_DONE_KEY) === '1';
}

export function clearCheckoutDone(): void {
    sessionStorage.removeItem(CHECKOUT_DONE_KEY);
}

export function isPendingCreditsTour(): boolean {
    return sessionStorage.getItem(PENDING_CREDITS_TOUR_KEY) === '1';
}

export function clearPendingCreditsTour(): void {
    sessionStorage.removeItem(PENDING_CREDITS_TOUR_KEY);
}

/** Both BR and US require checkout (plan selection / payment) before onboarding. */
export function needsCheckoutBeforeOnboarding(): boolean {
    return true;
}

function resolveCallbackPath(callbackUrl?: string | null, fallbackPath = '/dashboard'): string {
    if (callbackUrl?.startsWith('/')) return callbackUrl;
    if (callbackUrl?.startsWith('http')) {
        try {
            const parsed = new URL(callbackUrl);
            const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
            return path.startsWith('/') ? path : fallbackPath;
        } catch {
            return fallbackPath;
        }
    }
    return fallbackPath;
}

/** Default sign-in callback after registration — dedicated checkout gate unless custom callback. */
export function getSignupCallbackPath(callbackUrlFromQuery?: string | null): string {
    const fromQuery = resolveCallbackPath(callbackUrlFromQuery);
    if (callbackUrlFromQuery) return fromQuery;
    return '/checkout';
}

/** Where to send a logged-in user after sign-in / sign-up. */
export function getPostAuthRedirect(user: SessionUser | null | undefined): string {
    if (!user) return '/auth/signin';
    if (user.requiresOnboarding) {
        return isCheckoutDone() ? '/onboarding' : '/checkout';
    }
    return '/dashboard';
}
