import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { assertMarketHostname, getAppOrigin, getMarketOrigin } from './site-url';
import { MARKET_COOKIE } from './market';

describe('site-url', () => {
    const originalHostname = window.location.hostname;
    const originalOrigin = window.location.origin;

    beforeEach(() => {
        document.cookie = `${MARKET_COOKIE}=;path=/;max-age=0`;
    });

    afterEach(() => {
        vi.stubGlobal('location', {
            ...window.location,
            hostname: originalHostname,
            origin: originalOrigin,
            protocol: 'https:',
        });
        document.cookie = `${MARKET_COOKIE}=;path=/;max-age=0`;
    });

    it('returns market default origin without window', () => {
        expect(getMarketOrigin('US')).toBe('https://precisionai.innexar.app');
        expect(getMarketOrigin('BR')).toBe('https://precisionia.com.br');
    });

    it('uses current browser origin when available', () => {
        vi.stubGlobal('location', {
            ...window.location,
            hostname: 'precisionai.innexar.app',
            origin: 'https://precisionai.innexar.app',
            protocol: 'https:',
        });
        expect(getAppOrigin()).toBe('https://precisionai.innexar.app');
    });

    it('rewrites sibling market absolute URLs to current origin', () => {
        vi.stubGlobal('location', {
            ...window.location,
            hostname: 'precisionai.innexar.app',
            origin: 'https://precisionai.innexar.app',
            protocol: 'https:',
        });
        expect(
            assertMarketHostname('https://precisionia.com.br/dashboard/planos?x=1'),
        ).toBe('https://precisionai.innexar.app/dashboard/planos?x=1');
    });

    it('keeps URLs on the same origin unchanged', () => {
        vi.stubGlobal('location', {
            ...window.location,
            hostname: 'precisionia.com.br',
            origin: 'https://precisionia.com.br',
            protocol: 'https:',
        });
        const url = 'https://precisionia.com.br/auth/signin?callbackUrl=%2Fdashboard';
        expect(assertMarketHostname(url)).toBe(url);
    });

    it('leaves relative paths unchanged', () => {
        expect(assertMarketHostname('/dashboard')).toBe('/dashboard');
    });
});
