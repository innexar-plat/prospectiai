/**
 * US funnel smoke (Vitest) — post-auth, checkout gate, market host. Playwright: backend/e2e/us-market.spec.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getPostAuthRedirect,
  getSignupCallbackPath,
  needsCheckoutBeforeOnboarding,
  markCheckoutDone,
  isCheckoutDone,
} from './post-auth-redirect';
import type { SessionUser } from './api';

const baseUser: SessionUser = {
  id: 'u1',
  email: 'user@example.com',
  name: 'User',
  plan: 'FREE',
  leadsUsed: 0,
  leadsLimit: 0,
};

describe('US market funnel integration', () => {
  const originalHostname = window.location.hostname;

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.stubGlobal('location', { ...window.location, hostname: originalHostname });
  });

  it('US host requires checkout before onboarding (same as BR)', () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
    const user = { ...baseUser, requiresOnboarding: true };
    expect(needsCheckoutBeforeOnboarding()).toBe(true);
    expect(isCheckoutDone()).toBe(false);
    expect(getPostAuthRedirect(user)).toBe('/checkout');
    expect(getSignupCallbackPath(null)).toBe('/checkout');
    markCheckoutDone();
    expect(getPostAuthRedirect(user)).toBe('/onboarding');
  });

  it('BR host requires checkout before onboarding until marked', () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'precisionia.com.br', protocol: 'https:' });
    const user = { ...baseUser, requiresOnboarding: true };
    expect(needsCheckoutBeforeOnboarding()).toBe(true);
    expect(getPostAuthRedirect(user)).toBe('/checkout');
    markCheckoutDone();
    expect(getPostAuthRedirect(user)).toBe('/onboarding');
  });
});
