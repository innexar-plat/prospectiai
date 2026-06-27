import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import PublicEntryClient from './Landing';
import { renderWithProviders } from '@/test/test-utils';
import { MARKET_COOKIE } from '@/lib/market';
import { getLocaleStorageKey } from '@/lib/locale';

vi.mock('@/components/legal/CookieConsent', () => ({
  default: () => null,
}));

vi.mock('@/lib/affiliate-ref', () => ({
  captureRefFromUrl: vi.fn(),
}));

function renderLanding(locale = 'en') {
  localStorage.setItem(getLocaleStorageKey(), locale);
  return renderWithProviders(<PublicEntryClient locale={locale} />, { route: '/' });
}

describe('Public landing — US funnel isolation', () => {
  const originalHostname = window.location.hostname;

  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = `${MARKET_COOKIE}=;path=/;max-age=0`;
  });

  afterEach(() => {
    vi.stubGlobal('location', { ...window.location, hostname: originalHostname, protocol: 'https:' });
    document.cookie = `${MARKET_COOKIE}=;path=/;max-age=0`;
  });

  it('renders US conversion landing without trial copy on US host', async () => {
    vi.stubGlobal('location', {
      ...window.location,
      hostname: 'precisionai.innexar.app',
      protocol: 'https:',
    });
    renderLanding('en');

    const ctas = await screen.findAllByText(/get started — from \$19\/mo/i);
    expect(ctas.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/secure checkout via stripe/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/qualify leads with ai/i)).toBeInTheDocument();
    expect(screen.queryByText(/7-day trial/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/start free trial/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/testar agora — 10 créditos grátis/i)).not.toBeInTheDocument();
  });

  it('keeps US landing on US host even when BR market cookie is set', async () => {
    document.cookie = `${MARKET_COOKIE}=BR;path=/`;
    vi.stubGlobal('location', {
      ...window.location,
      hostname: 'precisionai.innexar.app',
      protocol: 'https:',
    });
    renderLanding('en');

    expect((await screen.findAllByText(/get started — from \$19\/mo/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/testar agora — 10 créditos grátis/i)).not.toBeInTheDocument();
  });

  it('renders BR landing with free-credits CTA, not US conversion hero', async () => {
    vi.stubGlobal('location', {
      ...window.location,
      hostname: 'precisionia.com.br',
      protocol: 'https:',
    });
    renderLanding('pt');

    expect(await screen.findByText(/testar agora — 10 créditos grátis/i)).toBeInTheDocument();
    expect(screen.getByText(/27 milhões de empresas brasileiras/i)).toBeInTheDocument();
    expect(screen.queryByText(/get started — from \$19\/mo/i)).not.toBeInTheDocument();
  });
});
