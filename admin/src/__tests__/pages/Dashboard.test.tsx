import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dashboard } from '@/pages/Dashboard';
import { adminApi } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  adminApi: {
    stats: vi.fn(),
    statsHistory: vi.fn(),
  },
}));

const mockStats = {
  users: 10,
  workspaces: 5,
  searchHistory: 100,
  leadAnalyses: 50,
  googlePlacesSearchTotal: 200,
  googlePlacesDetailsTotal: 80,
  serperRequestsTotal: 0,
  aiInputTokensTotal: 1000,
  aiOutputTokensTotal: 500,
  usersByMarket: { BR: 8, US: 2, unknown: 0 },
  revenueByMarket: {
    BR: { total: 500, mrr: 297, currency: 'BRL' as const, paidWorkspaces: 1 },
    US: { total: 49, mrr: 49, currency: 'USD' as const, paidWorkspaces: 1 },
  },
};

const mockHistory = {
  days: 7,
  series: [
    { date: '2026-04-04', users: 1, analyses: 5, searches: 10, googleSearch: 20, googleDetails: 8, serper: 0 },
    { date: '2026-04-05', users: 2, analyses: 8, searches: 15, googleSearch: 25, googleDetails: 10, serper: 1 },
  ],
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(adminApi.stats).mockReset();
    vi.mocked(adminApi.statsHistory).mockReset();
  });

  it('renders dashboard heading when loaded', async () => {
    vi.mocked(adminApi.stats).mockResolvedValue(mockStats);
    vi.mocked(adminApi.statsHistory).mockResolvedValue(mockHistory);
    render(<Dashboard />);
    const heading = await screen.findByRole('heading', { name: /dashboard/i }, { timeout: 3000 });
    expect(heading).toBeInTheDocument();
  });

  it('shows loading skeleton initially', async () => {
    vi.mocked(adminApi.stats).mockImplementation(() => new Promise(() => {}));
    vi.mocked(adminApi.statsHistory).mockImplementation(() => new Promise(() => {}));
    render(<Dashboard />);
    const skeletons = screen.getAllByTestId('dashboard-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error when stats fail', async () => {
    vi.mocked(adminApi.stats).mockRejectedValue(new Error('API error'));
    vi.mocked(adminApi.statsHistory).mockRejectedValue(new Error('API error'));
    render(<Dashboard />);
    const errorText = await screen.findByText(/API error/i, {}, { timeout: 3000 });
    expect(errorText).toBeInTheDocument();
  });

  it('renders market comparison section', async () => {
    vi.mocked(adminApi.stats).mockResolvedValue(mockStats);
    vi.mocked(adminApi.statsHistory).mockResolvedValue(mockHistory);
    render(<Dashboard />);
    await screen.findByRole('heading', { name: /mercados/i }, { timeout: 3000 });
    expect(screen.getByRole('heading', { name: /usuários por mercado/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /receita por mercado/i })).toBeInTheDocument();
  });

  it('renders sparklines when history is available', async () => {
    vi.mocked(adminApi.stats).mockResolvedValue(mockStats);
    vi.mocked(adminApi.statsHistory).mockResolvedValue(mockHistory);
    const { container } = render(<Dashboard />);
    await screen.findByRole('heading', { name: /dashboard/i }, { timeout: 3000 });
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });
});
