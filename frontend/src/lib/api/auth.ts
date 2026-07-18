import { assertMarketHostname } from '@/lib/site-url';
import { request, buildApiHeaders } from './_request';
import type { SessionUser } from './types';

async function getCsrfToken(): Promise<string> {
    const res = await fetch('/api/auth/csrf', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to get CSRF token');
    const data = await res.json();
    return data?.csrfToken ?? data?.token ?? '';
}

function createAndSubmitForm(action: string, fields: Record<string, string>): void {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement('input');
        input.name = name;
        input.type = 'hidden';
        input.value = value;
        form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
}

function normalizeCallbackPath(callbackUrl?: string, fallbackPath = '/dashboard'): string {
    const win = globalThis.window;
    const origin = win?.location?.origin;

    let path = fallbackPath;
    if (callbackUrl?.startsWith('/')) {
        path = callbackUrl;
    } else if (callbackUrl) {
        try {
            const parsed = new URL(callbackUrl);
            if (origin && parsed.origin === origin) {
                return assertMarketHostname(callbackUrl);
            }
            path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
            if (!path.startsWith('/')) path = fallbackPath;
        } catch {
            path = fallbackPath;
        }
    }

    if (origin) {
        return assertMarketHostname(`${origin}${path}`);
    }
    return assertMarketHostname(path);
}

export const authApi = {
    session: () => request<{ user: SessionUser | null }>('/auth/session'),

    register: (data: { email: string; password: string; name?: string; affiliateCode?: string; repCode?: string }) =>
        request<{ message: string; id: string; requiresOnboarding: boolean; verificationEmailSent: boolean; verificationEmailError?: string | null }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    signIn: async (data: { email: string; password: string; code?: string; callbackUrl?: string }) => {
        const csrfToken = await getCsrfToken();
        const callbackUrl = normalizeCallbackPath(data.callbackUrl, '/dashboard');

        createAndSubmitForm('/api/auth/callback/credentials', {
            csrfToken,
            email: data.email,
            password: data.password,
            ...(data.code ? { code: data.code } : {}),
            callbackUrl,
        });
    },

    initiateOAuthSignIn: async (provider: 'google' | 'github', callbackPath = '/dashboard') => {
        const callbackUrl = normalizeCallbackPath(callbackPath, '/dashboard');
        window.location.href = `/api/oauth/${provider}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    },

    forgotPassword: (email: string) =>
        request<{ message: string; devToken?: string }>('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),

    resetPassword: (data: { token: string; password: string }) =>
        request<{ message: string }>('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    resendVerification: () =>
        request<{ sent?: boolean; cooldown?: number; error?: string }>('/auth/resend-verification', {
            method: 'POST',
        }),

    signOut: async () => {
        const csrfToken = await getCsrfToken();
        const res = await fetch('/api/auth/signout', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...buildApiHeaders() },
            body: JSON.stringify({ csrfToken, callbackUrl: `${window.location.origin}/auth/signin` }),
        });
        if (!res.ok) throw new Error('Logout failed');
        return res.json();
    },
};
