import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { InstallPrompt } from './InstallPrompt';

vi.mock('@/lib/market', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/market')>();
  return {
    ...actual,
    getMarketConfig: vi.fn(() => ({ appName: 'Prospector' })),
  };
});

describe('InstallPrompt', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('returns null if dismissed in localStorage', () => {
    localStorage.setItem('pwa-install-dismissed', '1');
    const { container } = render(<InstallPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null if in standalone mode', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
      })),
    });
    const { container } = render(<InstallPrompt />);
    expect(container.innerHTML).toBe('');
  });
});
