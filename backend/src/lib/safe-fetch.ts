/**
 * SSRF-safe fetch for user/Google-supplied URLs (website scraping). Only public http(s) hosts:
 * private, loopback, link-local and CGNAT ranges are refused, as are single-label hostnames
 * (Docker service names such as "prospector-redis"). Redirects are followed manually so every
 * hop is re-validated.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_REDIRECTS = 3;

export function isPrivateAddress(ip: string): boolean {
    if (isIP(ip) === 4) {
        const [a, b] = ip.split('.').map(Number) as [number, number];
        return a === 10 || a === 127 || a === 0 ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 169 && b === 254) ||
            (a === 100 && b >= 64 && b <= 127) ||
            a >= 224;
    }
    const v6 = ip.toLowerCase();
    if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
    return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Blocked protocol');
    if (url.username || url.password) throw new Error('Blocked credentials in URL');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host)) {
        if (isPrivateAddress(host)) throw new Error('Blocked private address');
        return url;
    }
    if (!host.includes('.') || /\.(local|internal|localhost)$/i.test(host) || host === 'localhost') {
        throw new Error('Blocked internal hostname');
    }
    const addresses = await lookup(host, { all: true });
    if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
        throw new Error('Blocked private address');
    }
    return url;
}

export async function safeFetch(raw: string, init: RequestInit = {}): Promise<Response> {
    let current = raw;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const url = await assertPublicHttpUrl(current);
        const res = await fetch(url, { ...init, redirect: 'manual' });
        const location = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && location) {
            current = new URL(location, url).toString();
            continue;
        }
        return res;
    }
    throw new Error('Too many redirects');
}
