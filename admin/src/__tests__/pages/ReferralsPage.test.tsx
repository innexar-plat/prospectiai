import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReferralsPage } from '@/pages/ReferralsPage';

const mockReferrals = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: {
    referrals: (...args: unknown[]) => mockReferrals(...args),
  },
}));

describe('ReferralsPage', () => {
  beforeEach(() => {
    mockReferrals.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it('loads and shows referrals section', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<ReferralsPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText(/Funil de Referrals|Referrals/i, {}, { timeout: 3000 });
    expect(mockReferrals).toHaveBeenCalled();
  });
});
