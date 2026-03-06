import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import CookieConsent from './CookieConsent';

const t = (key: string) => key;

describe('CookieConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows dialog when no consent stored', async () => {
    renderWithProviders(<CookieConsent t={t} />);
    const dialog = await screen.findByRole('dialog', { name: 'cookie.bannerLabel' });
    expect(dialog).toBeInTheDocument();
  });

  it('hides when accept clicked', async () => {
    renderWithProviders(<CookieConsent t={t} />);
    const buttons = await screen.findAllByRole('button', { name: 'cookie.accept' });
    buttons[0].click();
    expect(localStorage.getItem('prospector_cookie_consent')).toBe('accepted');
  });
});
