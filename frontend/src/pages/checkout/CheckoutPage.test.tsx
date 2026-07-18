import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
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
    leadsLimit: 50,
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
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.cookie = `${MARKET_COOKIE}=;path=/;max-age=0`;
    sessionStorage.clear();
    fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/plans')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPlans),
        } as Response);
      }
      if (url.includes('/api/billing/checkout')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url: 'https://checkout.stripe.com/test' }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);
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
    expect(screen.getByText(/secure checkout via stripe/i)).toBeInTheDocument();
    expect(screen.queryByText(/mercado pago/i)).not.toBeInTheDocument();
    expect(await screen.findByText('Starter')).toBeInTheDocument();
    expect(screen.getAllByText(/subscribe/i).length).toBeGreaterThan(0);
  });

  it('displays USD prices from plans API on US host', async () => {
    vi.stubGlobal('location', {
      ...window.location,
      hostname: 'precisionai.innexar.app',
      protocol: 'https:',
    });
    renderCheckout();

    expect(await screen.findByText('$19')).toBeInTheDocument();
    expect(screen.getByText('$49')).toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it('does not show BR starter promo banner on US host', async () => {
    vi.stubGlobal('location', {
      ...window.location,
      hostname: 'precisionai.innexar.app',
      protocol: 'https:',
    });
    renderCheckout({
      ...baseUser,
      starterPromoEligible: true,
      starterPromo: {
        eligible: true,
        id: 'starter-6m',
        planId: 'STARTER_PROMO_BR',
        planKey: 'BASIC',
        priceMonthlyBrl: 59,
        regularPriceMonthlyBrl: 99,
        months: 6,
      },
    });

    await screen.findByText('Starter');
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/promo/i)).not.toBeInTheDocument();
  });

  it('starts Stripe checkout with en locale for US market', async () => {
    vi.stubGlobal('location', {
      ...window.location,
      hostname: 'precisionai.innexar.app',
      protocol: 'https:',
      href: 'https://precisionai.innexar.app/checkout',
      assign: vi.fn(),
    });
    renderCheckout();

    const subscribeButtons = await screen.findAllByRole('button', { name: /subscribe/i });
    fireEvent.click(subscribeButtons[0]!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/billing/checkout'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"locale":"en"'),
        }),
      );
    });
    const checkoutBody = JSON.parse(
      (fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/billing/checkout'))?.[1] as RequestInit)?.body as string,
    );
    expect(checkoutBody).toMatchObject({ planId: 'BASIC', interval: 'monthly', locale: 'en' });
    expect(checkoutBody.promoCode).toBeUndefined();
  });
});
