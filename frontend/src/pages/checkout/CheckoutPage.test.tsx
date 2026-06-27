import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import CheckoutPage from './CheckoutPage';
import { renderWithProviders } from '@/test/test-utils';
import { MARKET_COOKIE } from '@/lib/market';
import { getLocaleStorageKey } from '@/lib/locale';
import { CHECKOUT_DONE_KEY } from '@/lib/post-auth-redirect';
import type { SessionUser } from '@/lib/api';

vi.mock('@/components/legal/CookieConsent', () => ({
  default: () => null,
}));

const baseUser: SessionUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  plan: 'FREE',
  requiresOnboarding: true,
  emailVerified: true,
  leadsLimit: 0,
  leadsUsed: 0,
};

const mockPlans = [
  {
    key: 'BASIC',
    name: 'Starter',
    leadsLimit: 100,
    priceMonthlyBrl: 99,
    priceAnnualBrl: 990,
    priceMonthlyUsd: 19,
    priceAnnualUsd: 190,
    currency: 'USD' as const,
  },
  {
    key: 'PRO',
    name: 'Growth',
    leadsLimit: 400,
    priceMonthlyBrl: 199,
    priceAnnualBrl: 1990,
    priceMonthlyUsd: 49,
    priceAnnualUsd: 490,
    currency: 'USD' as const,
  },
];

function renderCheckout(user: SessionUser = baseUser, locale = 'en') {
  localStorage.setItem(getLocaleStorageKey(), locale);
  sessionStorage.removeItem(CHECKOUT_DONE_KEY);
  return renderWithProviders(<CheckoutPage user={user} />, { route: '/checkout' });
}

describe('CheckoutPage', () => {
  const originalHostname = window.location.hostname;

  beforeEach(() => {
    document.cookie = `${MARKET_COOKIE}=;path=/;max-age=0`;
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/plans')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPlans),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      } as Response);
    }));
  });

  afterEach(() => {
    vi.stubGlobal('location', { ...window.location, hostname: originalHostname, protocol: 'https:' });
    document.cookie = `${MARKET_COOKIE}=;path=/;max-age=0`;
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('shows plan selection on US host for onboarding users', async () => {
    vi.stubGlobal('location', {
      ...window.location,
      hostname: 'precisionai.innexar.app',
      protocol: 'https:',
    });
    renderCheckout();

    expect(await screen.findByText(/choose your plan/i)).toBeInTheDocument();
    expect(screen.getByText(/select a plan to get started/i)).toBeInTheDocument();
    expect(await screen.findByText('Starter')).toBeInTheDocument();
    expect(screen.getAllByText(/subscribe/i).length).toBeGreaterThan(0);
  });
});
