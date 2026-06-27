const FREE_SIGNUP_SESSION_KEY = 'precision_free_signup_conversion_tracked';
const FREE_SIGNUP_PENDING_SESSION_KEY = 'precision_free_signup_conversion_pending';

const rawGoogleAdsId = import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID?.trim();
const rawGoogleAdsLabel = import.meta.env.VITE_GOOGLE_ADS_CONVERSION_LABEL?.trim();

function getGoogleAdsSendTo(): string | null {
    if (!rawGoogleAdsId || !rawGoogleAdsLabel) return null;
    return `${rawGoogleAdsId}/${rawGoogleAdsLabel}`;
}

function markFreeSignupTracked(): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(FREE_SIGNUP_SESSION_KEY, '1');
        window.sessionStorage.removeItem(FREE_SIGNUP_PENDING_SESSION_KEY);
    } catch {
        // Ignore storage failures in privacy-restricted browsers.
    }
}

function hasPendingFreeSignup(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.sessionStorage.getItem(FREE_SIGNUP_PENDING_SESSION_KEY) === '1';
    } catch {
        return false;
    }
}

export function markPendingFreeSignupConversion(): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(FREE_SIGNUP_PENDING_SESSION_KEY, '1');
    } catch {
        // Ignore storage failures in privacy-restricted browsers.
    }
}

function hasTrackedFreeSignup(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.sessionStorage.getItem(FREE_SIGNUP_SESSION_KEY) === '1';
    } catch {
        return false;
    }
}

function getGtag(): ((command: string, eventName: string, params?: Record<string, unknown>) => void) | null {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return null;
    return window.gtag;
}

async function waitForGtag(timeoutMs = 3000, pollMs = 100): Promise<((command: string, eventName: string, params?: Record<string, unknown>) => void) | null> {
    const existing = getGtag();
    if (existing || typeof window === 'undefined') return existing;

    return new Promise((resolve) => {
        const startedAt = Date.now();
        const timer = window.setInterval(() => {
            const gtag = getGtag();
            if (gtag) {
                window.clearInterval(timer);
                resolve(gtag);
                return;
            }

            if (Date.now() - startedAt >= timeoutMs) {
                window.clearInterval(timer);
                resolve(null);
            }
        }, pollMs);
    });
}

function waitForDispatch(dispatch: (done: () => void) => void, timeoutMs = 1200): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();

    return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
        };

        const timer = window.setTimeout(finish, timeoutMs);

        dispatch(() => {
            window.clearTimeout(timer);
            finish();
        });
    });
}

export async function trackFreeSignupConversion(method = 'account_created'): Promise<boolean> {
    if (hasTrackedFreeSignup()) return true;

    const gtag = await waitForGtag();
    if (!gtag) {
        return false;
    }

    gtag('event', 'sign_up', {
        method,
        plan: 'FREE',
        credits_limit: 10,
        event_category: 'acquisition',
    });

    const sendTo = getGoogleAdsSendTo();
    if (!sendTo) {
        return false;
    }

    await waitForDispatch((done) => {
        gtag('event', 'conversion', {
            send_to: sendTo,
            value: 1,
            currency: 'BRL',
            transaction_id: `free_signup_${Date.now()}`,
            event_callback: done,
        });
    });

    markFreeSignupTracked();

    return true;
}

export async function trackPendingFreeSignupConversion(method = 'account_created'): Promise<boolean> {
    if (!hasPendingFreeSignup()) return hasTrackedFreeSignup();
    return trackFreeSignupConversion(method);
}