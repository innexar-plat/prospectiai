import { describe, expect, it } from '@jest/globals';
import { getSiteUrlForMarket, getSiteUrlFromRequest } from '@/lib/site-url';

describe('getSiteUrlForMarket', () => {
    it('returns US canonical origin for US market', () => {
        expect(getSiteUrlForMarket('US')).toBe('https://precisionai.innexar.app');
    });

    it('returns BR canonical origin for BR market', () => {
        expect(getSiteUrlForMarket('BR')).toBe('https://precisionia.com.br');
    });
});

describe('getSiteUrlFromRequest', () => {
    it('uses US site URL when host is US domain', () => {
        const req = new Request('http://localhost/api/auth/register', {
            headers: { host: 'precisionai.innexar.app' },
        });
        expect(getSiteUrlFromRequest(req)).toBe('https://precisionai.innexar.app');
    });

    it('uses BR site URL when host is BR domain', () => {
        const req = new Request('http://localhost/api/auth/register', {
            headers: { host: 'precisionia.com.br' },
        });
        expect(getSiteUrlFromRequest(req)).toBe('https://precisionia.com.br');
    });

    it('uses market from X-Prospector-Market header', () => {
        const req = new Request('http://localhost/api/billing/checkout', {
            headers: {
                host: 'localhost:3000',
                'X-Prospector-Market': 'US',
            },
        });
        expect(getSiteUrlFromRequest(req)).toBe('https://precisionai.innexar.app');
    });

    it('uses market from prospector-market cookie when header absent', () => {
        const req = new Request('http://localhost/api/billing/checkout', {
            headers: {
                host: 'localhost:3000',
                cookie: 'prospector-market=BR; session=abc',
            },
        });
        expect(getSiteUrlFromRequest(req)).toBe('https://precisionia.com.br');
    });

    it('prefers X-Prospector-Market header over cookie', () => {
        const req = new Request('http://localhost/api/billing/checkout', {
            headers: {
                host: 'localhost:3000',
                'X-Prospector-Market': 'US',
                cookie: 'prospector-market=BR',
            },
        });
        expect(getSiteUrlFromRequest(req)).toBe('https://precisionai.innexar.app');
    });
});
