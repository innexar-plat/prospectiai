import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type { SessionUser } from '@/lib/api';
import RelatoriosPage from './RelatoriosPage';

const mockNavigate = vi.fn();

const mockUser: SessionUser = {
  id: 'user-1',
  plan: 'BUSINESS',
  leadsUsed: 5,
  leadsLimit: 100,
  name: 'Test User',
  email: 'test@example.com',
};

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => ({ user: mockUser }),
  };
});

const mockMarketReport = vi.fn();

vi.mock('@/lib/api', () => ({
  searchApi: {
    marketReport: (...args: unknown[]) => mockMarketReport(...args),
    citySuggestions: vi.fn().mockResolvedValue({ cities: [] }),
  },
}));

const mockIsMarketFeatureEnabled = vi.fn().mockReturnValue(true);

vi.mock('@/lib/market', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/market')>();
  return {
    ...actual,
    isMarketFeatureEnabled: (feature: string) => mockIsMarketFeatureEnabled(feature),
    getActiveMarket: () => (mockIsMarketFeatureEnabled('reclameAqui') ? 'BR' : 'US'),
    getDefaultSearchCountry: () => (mockIsMarketFeatureEnabled('reclameAqui') ? 'BR' : 'US'),
  };
});

describe('RelatoriosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.plan = 'BUSINESS';
    mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature !== 'smartRelations');
    mockMarketReport.mockResolvedValue({
      totalBusinesses: 8,
      segments: [{ type: 'restaurant', count: 3, avgRating: 4.1 }],
      avgRating: 4.0,
      saturationIndex: 4,
      digitalMaturity: { withWebsite: 2, withPhone: 5, total: 8, withWebsitePercent: 25, withPhonePercent: 63 },
      topOpportunities: [],
    });
  });

  it('renders locked state for BASIC plan', () => {
    mockUser.plan = 'BASIC';
    renderWithProviders(<RelatoriosPage />, { route: '/dashboard/relatorios' });
    expect(screen.getAllByText(/inteligência de mercado/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /upgrade para enterprise/i })).toBeInTheDocument();
  });

  it('shows US states in US market, not Brazilian UFs', async () => {
    mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature !== 'reclameAqui' && feature !== 'smartRelations');

    renderWithProviders(<RelatoriosPage />, { route: '/dashboard/relatorios' });

    fireEvent.click(screen.getByRole('button', { name: 'All states' }));

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Florida' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('option', { name: /espírito santo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /goiás/i })).not.toBeInTheDocument();
  });

  it('passes city and state separately to marketReport API', async () => {
    mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature !== 'reclameAqui' && feature !== 'smartRelations');

    renderWithProviders(<RelatoriosPage />, { route: '/dashboard/relatorios' });

    fireEvent.change(screen.getByPlaceholderText(/tipo de negócio/i), { target: { value: 'restaurants' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'All states' }));
    });
    await act(async () => {
      const floridaOption = await screen.findByRole('option', { name: 'Florida' });
      fireEvent.click(floridaOption.querySelector('button') ?? floridaOption);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Florida' })).toBeInTheDocument();
    });

    const [, cityInput] = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(cityInput, { target: { value: 'Orlando' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /gerar relatório/i }));
    });

    await waitFor(() => {
      expect(mockMarketReport).toHaveBeenCalledWith({
        textQuery: 'restaurants',
        city: 'Orlando',
        state: 'FL',
        country: 'US',
        pageSize: 60,
      });
    });
  });
});
