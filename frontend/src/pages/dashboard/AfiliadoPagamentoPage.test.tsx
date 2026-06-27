import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type { SessionUser } from '@/lib/api';
import AfiliadoPagamentoPage from './AfiliadoPagamentoPage';

const mockUser: SessionUser = {
  id: 'user-1',
  plan: 'PRO',
  leadsUsed: 0,
  leadsLimit: 100,
  email: 'test@example.com',
};

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useOutletContext: () => ({ user: mockUser }),
  };
});

vi.mock('@/lib/api', () => ({
  affiliateApi: {
    me: vi.fn().mockResolvedValue({ payoutType: 'PIX' }),
    updatePayout: vi.fn(),
  },
}));

const mockIsMarketFeatureEnabled = vi.fn().mockReturnValue(true);

vi.mock('@/lib/market', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/market')>();
  return {
    ...actual,
    isMarketFeatureEnabled: (feature: string) => mockIsMarketFeatureEnabled(feature),
  };
});

describe('AfiliadoPagamentoPage market gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature === 'mercadoPago');
  });

  it('shows PIX payout option on BR market', async () => {
    renderWithProviders(<AfiliadoPagamentoPage />, { route: '/dashboard/afiliado/pagamento' });

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /pix/i })).toBeInTheDocument();
    });
  });

  it('hides PIX payout option on US market', async () => {
    mockIsMarketFeatureEnabled.mockReturnValue(false);

    renderWithProviders(<AfiliadoPagamentoPage />, { route: '/dashboard/afiliado/pagamento' });

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /bank transfer|transferência bancária/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('option', { name: /^pix$/i })).not.toBeInTheDocument();
  });
});
