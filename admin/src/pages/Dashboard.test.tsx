import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dashboard } from './Dashboard';
import { adminApi } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  adminApi: {
    stats: vi.fn(),
  },
}));

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(adminApi.stats).mockReset();
  });

  it('renders dashboard heading when loaded', async () => {
    vi.mocked(adminApi.stats).mockResolvedValue({
      users: 10,
      workspaces: 5,
      searchHistory: 100,
      leadAnalyses: 50,
      googlePlacesSearchTotal: 200,
      googlePlacesDetailsTotal: 80,
      serperRequestsTotal: 0,
      aiInputTokensTotal: 1000,
      aiOutputTokensTotal: 500,
    });
    render(<Dashboard />);
    const heading = await screen.findByRole('heading', { name: /dashboard/i }, { timeout: 3000 });
    expect(heading).toBeInTheDocument();
  });

  it('shows loading skeleton initially', async () => {
    vi.mocked(adminApi.stats).mockImplementation(() => new Promise(() => {}));
    render(<Dashboard />);
    const skeletons = screen.getAllByTestId('dashboard-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error when stats fail', async () => {
    vi.mocked(adminApi.stats).mockRejectedValue(new Error('API error'));
    render(<Dashboard />);
    const errorText = await screen.findByText(/API error/i, {}, { timeout: 3000 });
    expect(errorText).toBeInTheDocument();
  });
});
