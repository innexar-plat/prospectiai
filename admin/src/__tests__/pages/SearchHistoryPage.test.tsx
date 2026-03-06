import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SearchHistoryPage } from '@/pages/SearchHistoryPage';

const mockSearchHistory = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: { searchHistory: (...args: unknown[]) => mockSearchHistory(...args) },
}));

describe('SearchHistoryPage', () => {
  beforeEach(() => {
    mockSearchHistory.mockReset();
  });

  it('shows loading then content when adminApi.searchHistory resolves', async () => {
    mockSearchHistory.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<SearchHistoryPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/Histórico de buscas/i)).toBeInTheDocument();
    await screen.findByRole('table', {}, { timeout: 3000 });
  });
});
