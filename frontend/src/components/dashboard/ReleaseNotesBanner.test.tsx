import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderWithI18n } from '@/test/render-with-i18n';
import { getLocaleStorageKey } from '@/lib/locale';
import { getWhatsNewSeenKey } from '@/lib/app-version';
import { markCheckoutDone } from '@/lib/post-auth-redirect';
import { markWelcomeTourDone } from '@/lib/tour-steps';

vi.mock('@/lib/app-version', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/app-version')>();
  return {
    ...actual,
    APP_VERSION: '2.2.0',
  };
});

import { ReleaseNotesBanner } from './ReleaseNotesBanner';

describe('ReleaseNotesBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(getLocaleStorageKey(), 'pt');
  });

  it('renders current release highlights once for unseen version', () => {
    markWelcomeTourDone();

    renderWithI18n(<ReleaseNotesBanner />);

    expect(screen.getByText(/novidades da versão 2\.2\.0/i)).toBeInTheDocument();
    expect(screen.getByText(/tour guiado redesenhado/i)).toBeInTheDocument();
    expect(screen.getByText(/banner de novidades por versão/i)).toBeInTheDocument();
  });

  it('dismisses and persists current version', () => {
    markWelcomeTourDone();

    renderWithI18n(<ReleaseNotesBanner />);

    fireEvent.click(screen.getByRole('button', { name: /fechar novidades/i }));

    expect(localStorage.getItem(getWhatsNewSeenKey('2.2.0'))).toBe('1');
    expect(screen.queryByText(/novidades da versão 2\.2\.0/i)).not.toBeInTheDocument();
  });

  it('does not render when current version was already dismissed', () => {
    localStorage.setItem(getWhatsNewSeenKey('2.2.0'), '1');

    renderWithI18n(<ReleaseNotesBanner />);

    expect(screen.queryByText(/novidades da versão 2\.2\.0/i)).not.toBeInTheDocument();
  });

  it('defers until checkout credits tour is cleared', () => {
    markCheckoutDone();

    renderWithI18n(<ReleaseNotesBanner />);

    expect(screen.queryByText(/novidades da versão 2\.2\.0/i)).not.toBeInTheDocument();
  });

  it('defers until welcome tour is completed', () => {
    renderWithI18n(<ReleaseNotesBanner />);

    expect(screen.queryByText(/novidades da versão 2\.2\.0/i)).not.toBeInTheDocument();
  });

  it('renders after welcome tour was completed and no checkout tour pending', () => {
    markWelcomeTourDone();

    renderWithI18n(<ReleaseNotesBanner />);

    expect(screen.getByText(/novidades da versão 2\.2\.0/i)).toBeInTheDocument();
  });
});
