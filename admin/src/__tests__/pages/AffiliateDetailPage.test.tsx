import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AffiliateDetailPage } from '@/pages/AffiliateDetailPage';

const mockAffiliate = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: {
    affiliate: (id: string) => mockAffiliate(id),
  },
}));

describe('AffiliateDetailPage', () => {
  beforeEach(() => {
    mockAffiliate.mockResolvedValue({
      id: 'a1',
      code: 'ABC',
      status: 'APPROVED',
      commissionRatePercent: 20,
      email: 'aff@x.com',
      name: 'Affiliate',
      approvedAt: '',
      createdAt: '',
      referralCount: 0,
      userId: null,
      referrals: [],
      commissions: [],
      commissionPendingCents: 0,
      commissionPaidCents: 0,
    });
  });

  it('loads and shows affiliate when id present', async () => {
    render(
      <MemoryRouter initialEntries={['/affiliates/a1']}>
        <Routes>
          <Route path="/affiliates/:id" element={<AffiliateDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole('button', { name: /salvar/i }, { timeout: 3000 });
    expect(mockAffiliate).toHaveBeenCalledWith('a1');
  });
});
