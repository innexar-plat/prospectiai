import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { SearchResultsProvider } from '@/contexts/SearchResultsContext';
import DashboardIndex from './DashboardIndex';
import type { SessionUser } from '@/lib/api';
import { getLocaleStorageKey } from '@/lib/locale';
import { FIRST_SEARCH_HINT_DISMISSED_KEY, POST_ONBOARDING_VISIT_KEY } from '@/lib/first-search-hint';

const mockNavigate = vi.fn();
let outletUser: SessionUser = {
  id: 'user-1',
  plan: 'FREE',
  leadsUsed: 0,
  leadsLimit: 0,
  name: 'Maria Silva',
  email: 'maria@example.com',
};

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => ({ user: outletUser }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/lib/api', () => ({
  leadsApi: {
    stats: vi.fn().mockResolvedValue({ total: 0, highScore: 0, favorites: 0, searchesThisMonth: 0 }),
  },
  searchApi: {
    history: vi.fn().mockResolvedValue({ items: [] }),
    citySuggestions: vi.fn().mockResolvedValue({ cities: [] }),
  },
}));

vi.mock('@/lib/searchService', () => ({
  startSearch: vi.fn(),
  validateSearchPayload: vi.fn().mockReturnValue({ ok: false, message: 'validation' }),
  buildTextQuery: vi.fn().mockReturnValue(''),
}));

function renderDashboard() {
  return renderWithProviders(
    <SearchResultsProvider>
      <DashboardIndex />
    </SearchResultsProvider>,
    { route: '/dashboard' },
  );
}

describe('DashboardIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    outletUser = {
      id: 'user-1',
      plan: 'FREE',
      leadsUsed: 0,
      leadsLimit: 0,
      name: 'Maria Silva',
      email: 'maria@example.com',
    };
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(getLocaleStorageKey(), 'pt');
  });

  it('renders search UI with greeting and primary CTA', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('search')).toBeInTheDocument();
    });

    expect(screen.getByText(/maria/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buscar leads$/i })).toBeInTheDocument();
    expect(screen.getByText(/sua primeira prospecção em 3 passos/i)).toBeInTheDocument();
  });

  it('uses localized aria labels for key sections', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByLabelText('Barra de busca')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Primeiros passos')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtros')).toBeInTheDocument();
  });

  it('shows localized aria labels in English locale', async () => {
    localStorage.setItem(getLocaleStorageKey(), 'en');
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByLabelText('Search bar')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Quick start')).toBeInTheDocument();
    expect(screen.getByLabelText('Filters')).toBeInTheDocument();
  });

  it('shows US onboarding copy without trial mention on US market', async () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
    localStorage.setItem(getLocaleStorageKey(), 'en');
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/starter \(\$19\/mo\) includes 50 credits/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/7-day trial/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/no cnae needed/i).length).toBeGreaterThan(0);
  });

  it('shows persistent US search hint banner', async () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
    localStorage.setItem(getLocaleStorageKey(), 'en');
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('note', { name: /search by google category \+ city/i })).toBeInTheDocument();
    });
  });

  it('shows US quickstart steps on US market', async () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
    localStorage.setItem(getLocaleStorageKey(), 'en');
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Choose a Google category')).toBeInTheDocument();
    });

    expect(screen.getByText(/pick a us state and city/i)).toBeInTheDocument();
  });

  it('shows US category groups in English on US market', async () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
    localStorage.setItem(getLocaleStorageKey(), 'en');
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('HEALTH & WELLNESS')).toBeInTheDocument();
    });

    expect(screen.queryByText('SAÚDE & BEM-ESTAR')).not.toBeInTheDocument();
  });

  it('renders credits strip without duplicated count', async () => {
    outletUser = {
      ...outletUser,
      plan: 'BASIC',
      leadsUsed: 8,
      leadsLimit: 100,
    };
    localStorage.setItem(getLocaleStorageKey(), 'en');
    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByText(/92 credits remaining/i).length).toBeGreaterThan(0);
    });

    expect(screen.queryByText(/92 92 credits remaining/i)).not.toBeInTheDocument();
    expect(screen.getByText(/8\/100 used/i)).toBeInTheDocument();
  });

  it('shows first search hint after post-onboarding visit', async () => {
    sessionStorage.setItem(POST_ONBOARDING_VISIT_KEY, '1');
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('status', { name: /dica para primeira busca/i })).toBeInTheDocument();
    });
  });

  it('fills form when first search example is applied', async () => {
    sessionStorage.setItem(POST_ONBOARDING_VISIT_KEY, '1');
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /barbearia em são paulo/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /barbearia em são paulo/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('barbearia')).toBeInTheDocument();
    });
  });

  it('does not show first search hint when dismissed', async () => {
    localStorage.setItem(FIRST_SEARCH_HINT_DISMISSED_KEY, '1');
    sessionStorage.setItem(POST_ONBOARDING_VISIT_KEY, '1');
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('search')).toBeInTheDocument();
    });

    expect(screen.queryByRole('status', { name: /dica para primeira busca/i })).not.toBeInTheDocument();
  });
});
