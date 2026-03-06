import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AffiliateSettingsPage } from '@/pages/AffiliateSettingsPage';

const mockGet = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: {
    affiliateSettings: {
      get: () => mockGet(),
    },
  },
}));

describe('AffiliateSettingsPage', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue({
      id: 's1',
      defaultCommissionRatePercent: 20,
      cookieDurationDays: 30,
      commissionRule: 'FIRST_PAYMENT_ONLY',
      approvalHoldDays: 15,
      minPayoutCents: 10000,
      allowSelfSignup: true,
      updatedAt: '',
    });
  });

  it('loads and shows settings form', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<AffiliateSettingsPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText(/Configurações de Afiliados|configurações/i, {}, { timeout: 3000 });
    expect(mockGet).toHaveBeenCalled();
  });
});
