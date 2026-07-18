import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import ResultadosPage from './ResultadosPage';
import type { SessionUser } from '@/lib/api';
import { leadsApi, searchApi, analyzeStream } from '@/lib/api';
import { getLocaleStorageKey } from '@/lib/locale';

const mockNavigate = vi.fn();
const mockUseSearchResults = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => ({ user: mockUser }),
    useLocation: () => ({ state: mockLocationState }),
  };
});

vi.mock('@/contexts/SearchResultsContext', () => ({
  useSearchResults: () => mockUseSearchResults(),
}));

vi.mock('@/lib/api', () => ({
  leadsApi: {
    list: vi.fn().mockResolvedValue([]),
  },
  searchApi: {
    search: vi.fn(),
    analyzeBatch: vi.fn(),
    analyzeBatchStatus: vi.fn(),
  },
  analyzeStream: vi.fn(),
}));

const mockUser: SessionUser = {
  id: 'user-1',
  plan: 'PRO',
  leadsUsed: 5,
  leadsLimit: 100,
  name: 'Test User',
  email: 'test@example.com',
};

let mockLocationState: Record<string, unknown> = {};

const samplePlace = {
  id: 'place-1',
  displayName: { text: 'Acme Corp' },
  formattedAddress: '123 Main St',
  opportunityScore: 75,
  rating: 4.5,
  userRatingCount: 12,
};

const samplePlace2 = {
  id: 'place-2',
  displayName: { text: 'Beta LLC' },
  formattedAddress: '456 Oak Ave',
  opportunityScore: 60,
  rating: 4.0,
  userRatingCount: 8,
};

function mockSearchResults(places: typeof samplePlace[]) {
  mockUseSearchResults.mockReturnValue({
    lastSearchResults: {
      places,
      nextPageToken: undefined,
      params: { textQuery: 'restaurants' },
    },
    appendSearchResults: vi.fn(),
  });
}

describe('ResultadosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationState = {};
    mockUseSearchResults.mockReturnValue({
      lastSearchResults: null,
      appendSearchResults: vi.fn(),
    });
  });

  it('renders empty state when there are no results', () => {
    renderWithProviders(<ResultadosPage />, { route: '/dashboard/resultados' });
    expect(screen.getByText(/nenhum resultado para exibir/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nova busca/i })).toBeInTheDocument();
  });

  it('shows US empty-state search tips on US market', () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
    localStorage.setItem(getLocaleStorageKey(), 'en');
    renderWithProviders(<ResultadosPage />, { route: '/dashboard/resultados' });
    expect(screen.getByText(/tips for us searches/i)).toBeInTheDocument();
    expect(screen.getByText(/pick a google business category/i)).toBeInTheDocument();
  });

  it('renders error state from navigation state', () => {
    mockLocationState = { error: 'Limite de créditos atingido' };
    renderWithProviders(<ResultadosPage />, { route: '/dashboard/resultados' });
    expect(screen.getByText(/erro na busca/i)).toBeInTheDocument();
    expect(screen.getByText('Limite de créditos atingido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /voltar e tentar novamente/i })).toBeInTheDocument();
  });

  it('renders loading state', () => {
    mockLocationState = { loading: true };
    const { container } = renderWithProviders(<ResultadosPage />, { route: '/dashboard/resultados' });
    // Loading state now renders skeleton placeholders instead of a text message.
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders results list with analyze hint for new searches', async () => {
    mockUseSearchResults.mockReturnValue({
      lastSearchResults: {
        places: [samplePlace],
        nextPageToken: undefined,
        params: { textQuery: 'restaurants' },
      },
      appendSearchResults: vi.fn(),
    });

    renderWithProviders(<ResultadosPage />, { route: '/dashboard/resultados' });

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText(/use o botão "analisar com ia"/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analisar com ia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /score heurístico instantâneo/i })).toBeInTheDocument();
  });

  it('renders empty filter state with reset action', () => {
    mockUseSearchResults.mockReturnValue({
      lastSearchResults: {
        places: [{ ...samplePlace, websiteUri: undefined }],
        params: { textQuery: 'cafes' },
      },
      appendSearchResults: vi.fn(),
    });

    renderWithProviders(<ResultadosPage />, { route: '/dashboard/resultados' });

    const withSiteFilter = screen.getByRole('button', { name: /com site \(0\)/i });
    fireEvent.click(withSiteFilter);

    expect(screen.getByText(/nenhum resultado com este filtro/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /todos \(1\)/i })).toBeInTheDocument();
  });

  it('shows truncated pain and approach when AI analysis exists', async () => {
    vi.mocked(leadsApi.list).mockResolvedValue([
      {
        id: 'analysis-1',
        score: 82,
        summary: 'Resumo geral do lead',
        painPoints: ['Atendimento lento nos horários de pico'],
        approach: 'Abordar com foco em automação de atendimento',
        createdAt: '2026-01-01T00:00:00.000Z',
        lead: {
          id: 'lead-1',
          placeId: 'place-1',
          name: 'Acme Corp',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
    ]);

    mockSearchResults([samplePlace]);

    renderWithProviders(<ResultadosPage />, { route: '/dashboard/resultados' });

    await waitFor(() => {
      expect(screen.getByText(/atendimento lento nos horários de pico/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/abordar com foco em automação de atendimento/i)).toBeInTheDocument();
    expect(screen.getByText(/^dor$/i)).toBeInTheDocument();
    expect(screen.getByText(/^abordagem$/i)).toBeInTheDocument();
  });

  it('navigates to lead detail when single card analysis completes', async () => {
    mockSearchResults([samplePlace]);

    vi.mocked(analyzeStream).mockImplementation((_payload, callbacks) => {
      callbacks.onResult({ score: 88, placeId: 'place-1' });
      return { abort: vi.fn() };
    });

    renderWithProviders(<ResultadosPage />, { route: '/dashboard/resultados' });

    fireEvent.click(screen.getByRole('button', { name: /analisar com ia/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/dashboard/lead/place-1',
        expect.objectContaining({ state: { place: samplePlace } }),
      );
    });
  });

  it('navigates to first analyzed lead when batch completes', async () => {
    mockSearchResults([samplePlace, samplePlace2]);

    vi.mocked(searchApi.analyzeBatch).mockResolvedValue({
      jobId: 'batch-job-1',
      status: 'processing',
      total: 2,
      processed: 0,
      succeeded: 0,
      failed: 0,
      startedAt: '2026-01-01T00:00:00.000Z',
    });

    vi.mocked(searchApi.analyzeBatchStatus).mockResolvedValue({
      id: 'batch-job-1',
      status: 'completed',
      total: 2,
      processed: 2,
      succeeded: 2,
      failed: 0,
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:05:00.000Z',
      errors: [],
    });

    vi.mocked(leadsApi.list).mockResolvedValue([
      {
        id: 'analysis-2',
        score: 70,
        createdAt: '2026-01-01T00:00:00.000Z',
        lead: {
          id: 'lead-2',
          placeId: 'place-2',
          name: 'Beta LLC',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
      {
        id: 'analysis-1',
        score: 85,
        createdAt: '2026-01-01T00:00:00.000Z',
        lead: {
          id: 'lead-1',
          placeId: 'place-1',
          name: 'Acme Corp',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
    ]);

    renderWithProviders(<ResultadosPage />, { route: '/dashboard/resultados' });

    fireEvent.click(screen.getByRole('button', { name: /analisar todos/i }));

    await waitFor(() => {
      expect(searchApi.analyzeBatch).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/dashboard/lead/place-1',
        expect.objectContaining({ state: { place: samplePlace } }),
      );
    }, { timeout: 5000 });
  });
});
