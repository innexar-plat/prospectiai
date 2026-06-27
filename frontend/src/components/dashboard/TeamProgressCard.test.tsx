import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { renderWithI18n } from '@/test/render-with-i18n';
import { TeamProgressCard } from './TeamProgressCard';

function mockConfigFetch() {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response);
}

describe('TeamProgressCard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => mockConfigFetch()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when plan is not SCALE', async () => {
    const { container } = renderWithI18n(<TeamProgressCard plan="PRO" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.firstChild).toBeNull();
  });

  it('shows loading then content when plan is SCALE', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/config/public')) return mockConfigFetch();
      if (url.includes('/api/team/progress')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              goals: { dailyLeadsGoal: 10, dailyAnalysesGoal: 5, monthlyConversionsGoal: null },
              limits: { dailyLeadsLimit: 20, weeklyLeadsLimit: 100, monthlyLeadsLimit: 400 },
              usage: { today: 2, week: 10, month: 30 },
              today: { searches: 2, analyses: 1 },
              month: { searches: 10, analyses: 5, actions: 0 },
              streak: 3,
              ranking: { position: 2, total: 5, top5: [{ userId: 'u1', name: 'Alice', monthlySearches: 50 }] },
            }),
        } as Response);
      }
      return Promise.reject(new Error(`Unmocked fetch: ${url}`));
    });

    renderWithI18n(<TeamProgressCard plan="SCALE" />);
    expect(screen.getByText(/Carregando suas metas/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Suas metas/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Sequência:/)).toBeInTheDocument();
  });

  it('shows error when fetch fails', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/config/public')) return mockConfigFetch();
      if (url.includes('/api/team/progress')) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Forbidden' }),
        } as Response);
      }
      return Promise.reject(new Error(`Unmocked fetch: ${url}`));
    });

    renderWithI18n(<TeamProgressCard plan="SCALE" />);
    await waitFor(() => {
      expect(screen.getByText(/Forbidden/)).toBeInTheDocument();
    });
  });
});
