import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { getLocaleStorageKey } from '@/lib/locale';
import EmpresaPerfilPage from './EmpresaPerfilPage';

const mockGet = vi.fn();
const mockUpdate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useOutletContext: () => ({ user: { id: 'user-1', plan: 'BUSINESS' } }),
  };
});

vi.mock('@/lib/api', () => ({
  searchApi: {
    citySuggestions: vi.fn().mockResolvedValue({ cities: [] }),
  },
  workspaceProfileApi: {
    get: (...args: unknown[]) => mockGet(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    lookupCnpj: vi.fn(),
  },
}));

const mockIsMarketFeatureEnabled = vi.fn().mockReturnValue(true);

vi.mock('@/lib/market', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/market')>();
  return {
    ...actual,
    isMarketFeatureEnabled: (feature: string) => mockIsMarketFeatureEnabled(feature),
    getActiveMarket: () => (mockIsMarketFeatureEnabled('cnae') ? 'BR' : 'US'),
    getMarketConfig: (market?: 'BR' | 'US') =>
      market === 'US' || !mockIsMarketFeatureEnabled('cnae')
        ? { market: 'US' as const, defaultCountry: 'US', defaultLocale: 'en' as const, currency: 'USD' as const, appName: 'Precision', features: { cnae: false } }
        : actual.getMarketConfig('BR'),
  };
});

const emptyProfile = {
  companyName: 'Acme LLC',
  legalName: null,
  tradeName: null,
  cnpj: null,
  primaryCnaeCode: null,
  primaryCnaeDescription: null,
  companySize: null,
  foundingDate: null,
  productService: 'Marketing',
  targetAudience: null,
  mainBenefit: null,
  address: null,
  postalCode: null,
  street: null,
  number: null,
  complement: null,
  neighborhood: null,
  city: 'Orlando',
  state: 'FL',
  linkedInUrl: null,
  instagramUrl: null,
  facebookUrl: null,
  websiteUrl: null,
  logoUrl: null,
  serviceModel: null,
  averageTicket: null,
  operationRadiusKm: 48,
  knownCompetitors: null,
};

describe('EmpresaPerfilPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature === 'cnae');
    mockGet.mockResolvedValue(emptyProfile);
    mockUpdate.mockResolvedValue(emptyProfile);
  });

  it('shows CNPJ and CNAE fields in BR market', async () => {
    localStorage.setItem(getLocaleStorageKey(), 'pt');
    renderWithProviders(<EmpresaPerfilPage />, { route: '/dashboard/empresa' });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme LLC')).toBeInTheDocument();
    });
    expect(screen.getByText('CNPJ')).toBeInTheDocument();
    expect(screen.getByText('CNAE principal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cep$/i })).toBeInTheDocument();
  });

  it('hides CNPJ, CNAE and CEP lookup in US market', async () => {
    localStorage.setItem(getLocaleStorageKey(), 'en');
    mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature !== 'cnae');

    renderWithProviders(<EmpresaPerfilPage />, { route: '/dashboard/empresa' });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme LLC')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/^cnpj$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/primary cnae/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^zip$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/enter your company name, product\/service and address/i)).toBeInTheDocument();
  });

  it('lists US states in state selector for US market', async () => {
    localStorage.setItem(getLocaleStorageKey(), 'en');
    mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature !== 'cnae');

    renderWithProviders(<EmpresaPerfilPage />, { route: '/dashboard/empresa' });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme LLC')).toBeInTheDocument();
    });

    expect(screen.getByRole('option', { name: 'Florida (FL)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /goiás/i })).not.toBeInTheDocument();

    const stateSelect = screen.getByRole('option', { name: 'Florida (FL)' }).closest('select');
    expect(stateSelect).toHaveValue('FL');
  });

  it('saves profile without CNPJ fields in US market', async () => {
    localStorage.setItem(getLocaleStorageKey(), 'en');
    mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature !== 'cnae');

    renderWithProviders(<EmpresaPerfilPage />, { route: '/dashboard/empresa' });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme LLC')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.not.objectContaining({
          cnpj: expect.anything(),
          primaryCnaeCode: expect.anything(),
          primaryCnaeDescription: expect.anything(),
        }),
      );
    });
  });
});
