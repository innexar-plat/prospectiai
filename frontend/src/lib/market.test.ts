import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    MARKET_COOKIE,
    getActiveMarket,
    getMarketConfig,
    isMarketFeatureEnabled,
    isTrialEnabled,
    needsSubscription,
    persistMarket,
} from './market';

describe('market', () => {
    const originalHostname = window.location.hostname;

    beforeEach(() => {
        document.cookie = `${MARKET_COOKIE}=;path=/;max-age=0`;
    });

    afterEach(() => {
        vi.stubGlobal('location', { ...window.location, hostname: originalHostname });
        document.cookie = `${MARKET_COOKIE}=;path=/;max-age=0`;
    });

    it('detects US market from precisionai.innexar.app hostname', () => {
        vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
        expect(getActiveMarket()).toBe('US');
        expect(getMarketConfig().currency).toBe('USD');
        expect(isTrialEnabled()).toBe(false);
    });

    it('detects US market from subdomain of precisionai.innexar.app', () => {
        vi.stubGlobal('location', { ...window.location, hostname: 'www.precisionai.innexar.app', protocol: 'https:' });
        expect(getActiveMarket()).toBe('US');
    });

    it('detects BR market from precisionia.com.br hostname', () => {
        vi.stubGlobal('location', { ...window.location, hostname: 'precisionia.com.br', protocol: 'https:' });
        expect(getActiveMarket()).toBe('BR');
        expect(getMarketConfig().currency).toBe('BRL');
        expect(isTrialEnabled()).toBe(true);
    });

    it('persists market preference for later visits on ambiguous hosts', () => {
        vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
        getActiveMarket();
        vi.stubGlobal('location', { ...window.location, hostname: 'localhost', protocol: 'http:' });
        persistMarket('US');
        expect(getActiveMarket()).toBe('US');
    });

    it('US hostname ignores legacy BR cookie', () => {
        persistMarket('BR');
        vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
        expect(getActiveMarket()).toBe('US');
    });

    it('BR hostname wins over US cookie (host over cookie)', () => {
        persistMarket('US');
        vi.stubGlobal('location', { ...window.location, hostname: 'precisionia.com.br', protocol: 'https:' });
        expect(getActiveMarket()).toBe('BR');
        expect(isTrialEnabled()).toBe(true);
    });

    it('uses stored cookie when hostname is ambiguous', () => {
        persistMarket('US');
        vi.stubGlobal('location', { ...window.location, hostname: 'localhost', protocol: 'http:' });
        expect(getActiveMarket()).toBe('US');
    });

    it('needsSubscription is true for US FREE user with zero credits', () => {
        vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
        expect(needsSubscription({ plan: 'FREE', leadsLimit: 0 })).toBe(true);
        expect(needsSubscription({ plan: 'FREE', leadsLimit: 50 })).toBe(false);
    });

    it('needsSubscription is true for BR FREE user with zero credits', () => {
        vi.stubGlobal('location', { ...window.location, hostname: 'precisionia.com.br', protocol: 'https:' });
        expect(needsSubscription({ plan: 'FREE', leadsLimit: 0 })).toBe(true);
        expect(needsSubscription({ plan: 'FREE', leadsLimit: 50 })).toBe(false);
    });

    it('US market disables BR-only CRM and PIX affiliate payout', () => {
        vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
        expect(isMarketFeatureEnabled('crmBr')).toBe(false);
        expect(isMarketFeatureEnabled('mercadoPago')).toBe(false);
    });

    it('BR market enables BR CRM and PIX affiliate payout', () => {
        vi.stubGlobal('location', { ...window.location, hostname: 'precisionia.com.br', protocol: 'https:' });
        expect(isMarketFeatureEnabled('crmBr')).toBe(true);
        expect(isMarketFeatureEnabled('mercadoPago')).toBe(true);
    });
});
