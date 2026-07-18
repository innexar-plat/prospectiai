import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import PricingPage from './PricingPage';
import { renderWithProviders } from '@/test/test-utils';
import { MARKET_COOKIE } from '@/lib/market';
import { getLocaleStorageKey } from '@/lib/locale';

vi.mock('@/components/legal/CookieConsent', () => ({
  default: () => null,
}));

function renderPricing(locale = 'en') {
  localStorage.setItem(getLocaleStorageKey(), locale);
  return renderWithProviders(<PricingPage locale={locale} />, { route: '/en/pricing' });
}

describe('PricingPage — US funnel isolation', () => {
  const originalHostname = window.location.hostname;

  beforeEach(() => {
    document.cookie = `${MARKET_COOKIE}=;path=/;max-age=0`;
  });

  afterEach(() => {
    vi.stubGlobal('location', { ...window.location, hostname: originalHostname, protocol: 'https:' });
    document.cookie = `${MARKET_COOKIE}=;path=/;max-age=0`;
  });

  it('shows starter badge and subscribe CTA without trial copy on US host', async () => {
    vi.stubGlobal('location', {
      ...window.location,
      hostname: 'precisionai.innexar.app',
      protocol: 'https:',
    });
    renderPricing('en');

    expect(await screen.findByText(/starter plan — \$19 · 50 credits\/month/i)).toBeInTheDocument();
    expect(screen.getAllByText(/subscribe now/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/7-day trial/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/start free trial/i)).not.toBeInTheDocument();
    expect(screen.getByText(/secure checkout via stripe/i)).toBeInTheDocument();
  });

  it('shows starter badge in BRL and subscribe CTA on BR host', async () => {
    vi.stubGlobal('location', {
      ...window.location,
      hostname: 'precisionia.com.br',
      protocol: 'https:',
    });
    localStorage.setItem(getLocaleStorageKey(), 'pt');
    renderWithProviders(<PricingPage locale="pt" />, { route: '/pt/pricing' });

    expect(await screen.findByText(/plano inicial — r\$ 99 · 100 créditos\/mês/i)).toBeInTheDocument();
    expect(screen.getAllByText(/assinar agora/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\$19/)).not.toBeInTheDocument();
  });
});
