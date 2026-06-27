import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardTourTrigger } from './DashboardTourTrigger';
import {
  WELCOME_TOUR_STORAGE_KEY,
  markWelcomeTourDone,
} from '@/lib/tour-steps';
import {
  PENDING_CREDITS_TOUR_KEY,
  markCheckoutDone,
} from '@/lib/post-auth-redirect';

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('DashboardTourTrigger', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
  });

  it('shows checkout credits tour when pending flag is set', async () => {
    markCheckoutDone();

    render(<DashboardTourTrigger />);

    await waitFor(() => {
      expect(screen.getByText('common.tour.checkout.1.title')).toBeInTheDocument();
    });
    expect(screen.queryByText('common.tour.welcome.1.title')).not.toBeInTheDocument();
  });

  it('chains welcome tour after checkout credits tour completes', async () => {
    markCheckoutDone();

    render(<DashboardTourTrigger />);

    await waitFor(() => {
      expect(screen.getByText('common.tour.checkout.1.title')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('common.tour.skip'));

    await waitFor(() => {
      expect(sessionStorage.getItem(PENDING_CREDITS_TOUR_KEY)).toBeNull();
      expect(screen.getByText('common.tour.welcome.1.title')).toBeInTheDocument();
    });
  });

  it('shows welcome tour on first dashboard visit when no checkout tour pending', async () => {
    render(<DashboardTourTrigger />);

    await waitFor(() => {
      expect(screen.getByText('common.tour.welcome.1.title')).toBeInTheDocument();
    });
  });

  it('does not show welcome tour when already completed', async () => {
    markWelcomeTourDone();

    render(<DashboardTourTrigger />);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(localStorage.getItem(WELCOME_TOUR_STORAGE_KEY)).toBe('1');
  });
});
