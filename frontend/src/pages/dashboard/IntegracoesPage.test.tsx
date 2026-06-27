import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type { SessionUser } from '@/lib/api';
import IntegracoesPage from './IntegracoesPage';

const mockUser: SessionUser = {
  id: 'user-1',
  plan: 'PRO',
  leadsUsed: 5,
  leadsLimit: 100,
  name: 'Test User',
  email: 'test@example.com',
};

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useOutletContext: () => ({ user: mockUser }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

const mockRdTest = vi.fn();
const mockAgendorTest = vi.fn();
const mockHubspotTest = vi.fn();

vi.mock('@/lib/api', () => ({
  integrationsApi: {
    rdStationTest: () => mockRdTest(),
    agendorTest: () => mockAgendorTest(),
    hubspotTest: () => mockHubspotTest(),
    rdStationOauthConnectUrl: vi.fn(),
    rdStationDisconnect: vi.fn(),
    hubspotOauthConnectUrl: vi.fn(),
    hubspotDisconnect: vi.fn(),
    agendorSaveToken: vi.fn(),
    agendorDisconnect: vi.fn(),
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

describe('IntegracoesPage market gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRdTest.mockResolvedValue({ ok: false });
    mockAgendorTest.mockResolvedValue({ ok: false });
    mockHubspotTest.mockResolvedValue({ ok: false });
    mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature === 'crmBr');
  });

  it('shows RD Station and Agendor cards on BR market', async () => {
    renderWithProviders(<IntegracoesPage />, { route: '/dashboard/integracoes' });

    await waitFor(() => {
      expect(mockRdTest).toHaveBeenCalled();
      expect(mockAgendorTest).toHaveBeenCalled();
    });

    expect(screen.getByAltText('RD Station')).toBeInTheDocument();
    expect(screen.getByAltText('Agendor')).toBeInTheDocument();
    expect(screen.getByText('HubSpot CRM')).toBeInTheDocument();
  });

  it('hides BR CRM cards on US market and skips their status checks', async () => {
    mockIsMarketFeatureEnabled.mockReturnValue(false);

    renderWithProviders(<IntegracoesPage />, { route: '/dashboard/integracoes' });

    await waitFor(() => {
      expect(mockHubspotTest).toHaveBeenCalled();
    });

    expect(mockRdTest).not.toHaveBeenCalled();
    expect(mockAgendorTest).not.toHaveBeenCalled();
    expect(screen.queryByAltText('RD Station')).not.toBeInTheDocument();
    expect(screen.queryByAltText('Agendor')).not.toBeInTheDocument();
    expect(screen.getByText('HubSpot CRM')).toBeInTheDocument();
  });
});
