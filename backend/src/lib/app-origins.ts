/** Canonical public app origins (multi-domain deploy). */
export const APP_ORIGINS = [
    'https://precisionia.com.br',
    'https://precisionai.innexar.app',
] as const;

export function isAllowedAppOrigin(url: string): boolean {
    try {
        const origin = new URL(url).origin.replace(/\/$/, '');
        return APP_ORIGINS.some((allowed) => allowed === origin);
    } catch {
        return false;
    }
}

/** Auth.js redirect: keep user on the domain they signed in from. */
export function resolveAuthRedirectUrl(url: string, baseUrl: string): string {
    const base = baseUrl.replace(/\/$/, '');

    if (url.startsWith('http') && isAllowedAppOrigin(url)) {
        try {
            const parsed = new URL(url);
            const baseOrigin = new URL(base).origin;
            if (parsed.origin === baseOrigin) return url;
            const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
            return `${base}${path}`;
        } catch {
            return base;
        }
    }

    if (url.startsWith('/')) {
        return `${base}${url}`;
    }

    try {
        if (new URL(url).origin === base) return url;
    } catch {
        return base;
    }

    return base;
}
