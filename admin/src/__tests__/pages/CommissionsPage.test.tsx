import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CommissionsPage } from '@/pages/CommissionsPage';

const mockCommissions = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: {
    commissions: (...args: unknown[]) => mockCommissions(...args),
  },
}));

describe('CommissionsPage', () => {
  beforeEach(() => {
    mockCommissions.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it('loads and shows commissions section', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CommissionsPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText(/comissões/i, {}, { timeout: 3000 });
    expect(mockCommissions).toHaveBeenCalled();
  });
});
