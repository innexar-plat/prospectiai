import { describe, expect, it } from '@jest/globals';
import { resolveAuthRedirectUrl, isAllowedAppOrigin } from '@/lib/app-origins';
import { getRequestMarket, resolveMarketFromHost, resolveSearchCountry } from '@/lib/market';
import { getSiteUrlFromRequest } from '@/lib/site-url';

const US_BASE = 'https://precisionai.innexar.app';
const BR_BASE = 'https://precisionia.com.br';

describe('app-origins', () => {
    it('keeps same-market absolute redirect URL', () => {
        const url = 'https://precisionai.innexar.app/dashboard/planos';
        expect(isAllowedAppOrigin(url)).toBe(true);
        expect(resolveAuthRedirectUrl(url, US_BASE)).toBe(url);
    });

    it('rewrites sibling market absolute URL to baseUrl origin', () => {
        const url = 'https://precisionai.innexar.app/dashboard/planos';
        expect(resolveAuthRedirectUrl(url, BR_BASE)).toBe(
            'https://precisionia.com.br/dashboard/planos',
        );
        expect(resolveAuthRedirectUrl(url, BR_BASE)).not.toBe(url);
    });

    it('rewrites US absolute URL to US base when signing in on US', () => {
        const brUrl = 'https://precisionia.com.br/onboarding';
        expect(resolveAuthRedirectUrl(brUrl, US_BASE)).toBe(
            'https://precisionai.innexar.app/onboarding',
        );
    });

    it('keeps relative paths on baseUrl', () => {
        expect(resolveAuthRedirectUrl('/dashboard', BR_BASE)).toBe(
            'https://precisionia.com.br/dashboard',
        );
    });

    it('keeps US OAuth callback on US domain (relative path)', () => {
        const result = resolveAuthRedirectUrl('/dashboard', US_BASE);
        expect(result).toBe('https://precisionai.innexar.app/dashboard');
        expect(result).not.toContain('precisionia.com.br');
    });

    it('keeps US OAuth callback on US domain (absolute US url)', () => {
        const url = 'https://precisionai.innexar.app/dashboard/planos';
        const result = resolveAuthRedirectUrl(url, US_BASE);
        expect(result).toBe(url);
        expect(result).not.toContain('precisionia.com.br');
    });

    it('does not send US sign-in callback to BR domain via relative path', () => {
        const paths = ['/dashboard', '/dashboard/planos', '/onboarding'];
        for (const path of paths) {
            const result = resolveAuthRedirectUrl(path, US_BASE);
            expect(result.startsWith(US_BASE)).toBe(true);
            expect(result).not.toContain('precisionia.com.br');
        }
    });

    it('rejects unknown external callback and falls back to base', () => {
        expect(resolveAuthRedirectUrl('https://evil.example/phish', US_BASE)).toBe(US_BASE);
    });
});

describe('getRequestMarket', () => {
    it('resolves US from X-Prospector-Market header', () => {
        const req = new Request('http://localhost/api/plans', {
            headers: { 'X-Prospector-Market': 'US' },
        });
        expect(getRequestMarket(req)).toBe('US');
    });

    it('resolves US from prospector-market cookie', () => {
        const req = new Request('http://localhost/api/plans', {
            headers: { cookie: 'prospector-market=US; other=1' },
        });
        expect(getRequestMarket(req)).toBe('US');
    });

    it('resolves US from host when header/cookie absent', () => {
        const req = new Request('http://localhost/api/plans', {
            headers: { host: 'precisionai.innexar.app' },
        });
        expect(getRequestMarket(req)).toBe('US');
        expect(resolveMarketFromHost('precisionai.innexar.app')).toBe('US');
    });

    it('resolves BR from precisionia.com.br host', () => {
        const req = new Request('http://localhost/api/plans', {
            headers: { host: 'precisionia.com.br' },
        });
        expect(getRequestMarket(req)).toBe('BR');
        expect(resolveMarketFromHost('precisionia.com.br')).toBe('BR');
    });

    it('resolves BR from prospector-market cookie', () => {
        const req = new Request('http://localhost/api/plans', {
            headers: { cookie: 'prospector-market=BR' },
        });
        expect(getRequestMarket(req)).toBe('BR');
    });

    it('prefers explicit header over cookie when host is ambiguous', () => {
        const req = new Request('http://localhost/api/plans', {
            headers: {
                'X-Prospector-Market': 'US',
                cookie: 'prospector-market=BR',
            },
        });
        expect(getRequestMarket(req)).toBe('US');
    });

    it('prefers US host over BR cookie', () => {
        const req = new Request('http://localhost/api/plans', {
            headers: {
                host: 'precisionai.innexar.app',
                cookie: 'prospector-market=BR',
            },
        });
        expect(getRequestMarket(req)).toBe('US');
    });

    it('prefers BR host over US cookie', () => {
        const req = new Request('http://localhost/api/plans', {
            headers: {
                host: 'precisionia.com.br',
                cookie: 'prospector-market=US',
            },
        });
        expect(getRequestMarket(req)).toBe('BR');
    });
});

describe('resolveSearchCountry', () => {
    it('uses body country when provided', () => {
        const req = new Request('http://localhost/api/market-report', {
            headers: { 'X-Prospector-Market': 'US' },
        });
        expect(resolveSearchCountry(req, 'Brasil')).toBe('Brasil');
    });

    it('defaults to US when request market is US and body omits country', () => {
        const req = new Request('http://localhost/api/market-report', {
            headers: { 'X-Prospector-Market': 'US' },
        });
        expect(resolveSearchCountry(req)).toBe('US');
    });

    it('defaults to BR when request market is BR and body omits country', () => {
        const req = new Request('http://localhost/api/market-report', {
            headers: { host: 'precisionia.com.br' },
        });
        expect(resolveSearchCountry(req)).toBe('BR');
    });
});

describe('getSiteUrlFromRequest', () => {
    it('returns US site URL when host is US even with BR cookie', () => {
        const req = new Request('http://localhost/api/auth/register', {
            headers: {
                host: 'precisionai.innexar.app',
                cookie: 'prospector-market=BR',
            },
        });
        expect(getSiteUrlFromRequest(req)).toBe('https://precisionai.innexar.app');
    });

    it('returns BR site URL when host is BR even with US cookie', () => {
        const req = new Request('http://localhost/api/auth/register', {
            headers: {
                host: 'precisionia.com.br',
                cookie: 'prospector-market=US',
            },
        });
        expect(getSiteUrlFromRequest(req)).toBe('https://precisionia.com.br');
    });
});
