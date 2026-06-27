import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '@/test/render-with-i18n';
import { getLocaleStorageKey } from '@/lib/locale';
import {
  FIRST_SEARCH_HINT_DISMISSED_KEY,
  FIRST_SEARCH_HINT_DELAY_MS,
  POST_ONBOARDING_VISIT_KEY,
} from '@/lib/first-search-hint';
import { FirstSearchHintBanner } from './FirstSearchHintBanner';

describe('FirstSearchHintBanner', () => {
  const onApplyExample = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(getLocaleStorageKey(), 'pt');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderBanner(overrides: Partial<Parameters<typeof FirstSearchHintBanner>[0]> = {}) {
    return renderWithI18n(
      <FirstSearchHintBanner
        isNewUser
        trialExpired={false}
        searchInProgress={false}
        onApplyExample={onApplyExample}
        {...overrides}
      />,
    );
  }

  it('shows immediately after post-onboarding visit', () => {
    sessionStorage.setItem(POST_ONBOARDING_VISIT_KEY, '1');
    renderBanner();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/experimente:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /barbearia em são paulo/i })).toBeInTheDocument();
    expect(sessionStorage.getItem(POST_ONBOARDING_VISIT_KEY)).toBeNull();
  });

  it('shows after delay for idle new users', () => {
    renderBanner();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(FIRST_SEARCH_HINT_DELAY_MS);
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not show when dismissed', () => {
    localStorage.setItem(FIRST_SEARCH_HINT_DISMISSED_KEY, '1');
    sessionStorage.setItem(POST_ONBOARDING_VISIT_KEY, '1');
    renderBanner();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('dismisses and persists flag', () => {
    sessionStorage.setItem(POST_ONBOARDING_VISIT_KEY, '1');
    renderBanner();

    fireEvent.click(screen.getByRole('button', { name: /fechar dica de busca/i }));

    expect(localStorage.getItem(FIRST_SEARCH_HINT_DISMISSED_KEY)).toBe('1');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('applies example and dismisses', () => {
    sessionStorage.setItem(POST_ONBOARDING_VISIT_KEY, '1');
    renderBanner();

    fireEvent.click(screen.getByRole('button', { name: /barbearia em são paulo/i }));

    expect(onApplyExample).toHaveBeenCalledWith(
      expect.objectContaining({
        country: 'BR',
        state: 'SP',
        niches: ['barbearia'],
        includedType: 'barber_shop',
      }),
    );
    expect(localStorage.getItem(FIRST_SEARCH_HINT_DISMISSED_KEY)).toBe('1');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows US example on US market', () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
    localStorage.setItem(getLocaleStorageKey(), 'en');
    sessionStorage.setItem(POST_ONBOARDING_VISIT_KEY, '1');
    renderBanner();

    expect(screen.getByRole('button', { name: /barbershop in florida/i })).toBeInTheDocument();
  });

  it('does not show for returning users', () => {
    renderBanner({ isNewUser: false });

    act(() => {
      vi.advanceTimersByTime(FIRST_SEARCH_HINT_DELAY_MS);
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
