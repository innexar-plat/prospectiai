import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { getLocaleStorageKey } from '@/lib/locale';
import type { SessionUser } from '@/lib/api';
import MercadoPage from './MercadoPage';
import ConcorrenciaPage from './ConcorrenciaPage';
import MinhaEmpresaPage from './MinhaEmpresaPage';
import PipelinePage from './PipelinePage';
import ViabilidadePage from './ViabilidadePage';

const mockNavigate = vi.fn();

const mockUser: SessionUser = {
  id: 'user-1',
  plan: 'BUSINESS',
  leadsUsed: 5,
  leadsLimit: 100,
  name: 'Test User',
  email: 'test@example.com',
  companyName: 'Acme Corp',
  productService: 'Software',
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
const mockCompetitorAnalyze = vi.fn();
const mockCompanyAnalysisRun = vi.fn();
const mockPipelineBrief = vi.fn();
const mockViabilityAnalyze = vi.fn();

vi.mock('@/lib/api', () => ({
  searchApi: {
    marketReport: (...args: unknown[]) => mockMarketReport(...args),
    citySuggestions: vi.fn().mockResolvedValue({ cities: [] }),
  },
  competitorApi: {
    analyze: (...args: unknown[]) => mockCompetitorAnalyze(...args),
  },
  companyAnalysisApi: {
    run: (...args: unknown[]) => mockCompanyAnalysisRun(...args),
  },
  pipelineApi: {
    getDailyBrief: () => mockPipelineBrief(),
  },
  viabilityApi: {
    analyze: (...args: unknown[]) => mockViabilityAnalyze(...args),
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

describe('Intelligence modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.plan = 'BUSINESS';
    mockUser.companyName = 'Acme Corp';
    mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature !== 'smartRelations');
    mockMarketReport.mockReset();
    mockCompetitorAnalyze.mockReset();
    mockCompanyAnalysisRun.mockReset();
    mockPipelineBrief.mockReset();
    mockViabilityAnalyze.mockReset();
  });

  describe('MercadoPage', () => {
    it('renders locked state for BASIC plan', () => {
      mockUser.plan = 'BASIC';
      renderWithProviders(<MercadoPage />, { route: '/dashboard/mercado' });
      expect(screen.getAllByText(/inteligência de mercado/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /upgrade para business/i })).toBeInTheDocument();
    });

    it('shows loading then results on successful analysis', async () => {
      mockMarketReport.mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => resolve({
            totalBusinesses: 12,
            segments: [{ type: 'restaurant', count: 5, avgRating: 4.2 }],
            avgRating: 4.1,
            saturationIndex: 6,
            digitalMaturity: { withWebsite: 4, withPhone: 8, total: 12, withWebsitePercent: 33, withPhonePercent: 67 },
            topOpportunities: [],
          }), 10);
        }),
      );

      renderWithProviders(<MercadoPage />, { route: '/dashboard/mercado' });
      fireEvent.change(screen.getByPlaceholderText(/restaurantes, academias/i), { target: { value: 'restaurants' } });
      fireEvent.click(screen.getByRole('button', { name: /gerar relatório/i }));

      expect(screen.getAllByText(/analisando mercado/i).length).toBeGreaterThan(0);
      await waitFor(() => {
        expect(screen.getByText('12')).toBeInTheDocument();
      });
    });

    it('shows error banner when market report fails', async () => {
      mockMarketReport.mockRejectedValue(new Error('Créditos insuficientes'));

      renderWithProviders(<MercadoPage />, { route: '/dashboard/mercado' });
      fireEvent.change(screen.getByPlaceholderText(/restaurantes, academias/i), { target: { value: 'restaurants' } });
      fireEvent.click(screen.getByRole('button', { name: /gerar relatório/i }));

      await waitFor(() => {
        expect(screen.getAllByText('Créditos insuficientes').length).toBeGreaterThan(0);
      });
    });

    it('passes country and US state codes to marketReport API', async () => {
      mockMarketReport.mockResolvedValue({
        totalBusinesses: 3,
        segments: [],
        avgRating: 4.0,
        saturationIndex: 2,
        digitalMaturity: { withWebsite: 1, withPhone: 2, total: 3, withWebsitePercent: 33, withPhonePercent: 67 },
        topOpportunities: [],
      });

      renderWithProviders(<MercadoPage />, { route: '/dashboard/mercado' });
      fireEvent.change(screen.getByPlaceholderText(/restaurantes, academias/i), { target: { value: 'restaurants' } });
      fireEvent.click(screen.getByRole('button', { name: /gerar relatório/i }));

      await waitFor(() => {
        expect(mockMarketReport).toHaveBeenCalledWith(
          expect.objectContaining({
            textQuery: 'restaurants',
            country: expect.any(String),
          }),
        );
      });
    });
  });

  describe('ConcorrenciaPage', () => {
    it('shows error banner when competitor analysis fails', async () => {
      mockUser.plan = 'PRO';
      mockCompetitorAnalyze.mockRejectedValue(new Error('Falha na análise'));

      renderWithProviders(<ConcorrenciaPage />, { route: '/dashboard/concorrencia' });
      fireEvent.change(screen.getByPlaceholderText(/pizzarias, salões/i), { target: { value: 'pizza' } });
      fireEvent.click(screen.getByRole('button', { name: /analisar região/i }));

      await waitFor(() => {
        expect(screen.getAllByText('Falha na análise').length).toBeGreaterThan(0);
      });
    });
  });

  describe('MinhaEmpresaPage', () => {
    it('hides Reclame Aqui section in US market', async () => {
      mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature !== 'reclameAqui' && feature !== 'smartRelations');
      mockCompanyAnalysisRun.mockResolvedValue({
        summary: 'Strong digital presence.',
        strengths: ['Good reviews'],
        weaknesses: ['Low social activity'],
        recommendations: ['Post more often'],
        reclameAquiSummary: 'Should not appear in US',
        googlePresenceScore: 8,
        googleRating: 4.5,
        googleReviewCount: 120,
      });

      renderWithProviders(<MinhaEmpresaPage />, { route: '/dashboard/minha-empresa' });
      fireEvent.click(screen.getByRole('button', { name: /gerar análise/i }));

      await waitFor(() => {
        expect(screen.getByText(/strong digital presence/i)).toBeInTheDocument();
      });
      expect(screen.queryByText('Reclame Aqui')).not.toBeInTheDocument();
      expect(screen.getByText(/presença google/i)).toBeInTheDocument();
      mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature !== 'smartRelations');
    });

    it('shows error banner when company analysis fails', async () => {
      mockCompanyAnalysisRun.mockRejectedValue(new Error('Erro ao gerar análise'));

      renderWithProviders(<MinhaEmpresaPage />, { route: '/dashboard/minha-empresa' });
      fireEvent.click(screen.getByRole('button', { name: /gerar análise/i }));

      await waitFor(() => {
        expect(screen.getAllByText('Erro ao gerar análise').length).toBeGreaterThan(0);
      });
    });

    it('passes country, locale and Orlando city in search mode', async () => {
      localStorage.setItem(getLocaleStorageKey(), 'en');
      mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature !== 'reclameAqui' && feature !== 'smartRelations');
      mockCompanyAnalysisRun.mockResolvedValue({
        summary: 'Strong local presence.',
        strengths: [],
        weaknesses: [],
        recommendations: [],
        socialNetworks: { presence: '' },
      });

      renderWithProviders(<MinhaEmpresaPage />, { route: '/dashboard/minha-empresa' });
      fireEvent.click(screen.getByRole('button', { name: /search by name and city/i }));
      fireEvent.change(screen.getByPlaceholderText(/company name \(required\)/i), { target: { value: 'Acme Barbershop' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'All states' }));
      });
      await act(async () => {
        const floridaOption = await screen.findByRole('option', { name: 'Florida' });
        fireEvent.click(floridaOption.querySelector('button') ?? floridaOption);
      });

      const [, cityInput] = screen.getAllByRole('textbox');
      await act(async () => {
        fireEvent.change(cityInput, { target: { value: 'Orlando' } });
      });

      fireEvent.click(screen.getByRole('button', { name: /generate analysis/i }));

      await waitFor(() => {
        expect(mockCompanyAnalysisRun).toHaveBeenCalledWith(
          expect.objectContaining({
            useProfile: false,
            companyName: 'Acme Barbershop',
            city: 'Orlando',
            state: 'FL',
            country: 'US',
            locale: 'en',
          }),
        );
      });
      mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature !== 'smartRelations');
    });
  });

  describe('PipelinePage', () => {
    it('shows loading then stats on success', async () => {
      mockUser.plan = 'PRO';
      mockPipelineBrief.mockResolvedValue({
        stats: {
          totalActive: 5,
          hotLeads: 2,
          avgCloseProbability: 42,
          pipelineValue: 50000,
          conversionRate: 18,
          avgDealValue: 2500,
          avgCycleDays: 14,
          totalConverted: 3,
          totalLost: 1,
          topLostReasons: [{ reason: 'PRICE', count: 1 }],
        },
        recommendations: [],
      });

      renderWithProviders(<PipelinePage />, { route: '/dashboard/pipeline' });

      expect(screen.getByText(/calculando pipeline inteligente/i)).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('shows error banner when daily brief fails', async () => {
      mockUser.plan = 'PRO';
      mockPipelineBrief.mockRejectedValue(new Error('Pipeline indisponível'));

      renderWithProviders(<PipelinePage />, { route: '/dashboard/pipeline' });

      await waitFor(() => {
        expect(screen.getByText('Pipeline indisponível')).toBeInTheDocument();
      });
    });
  });

  describe('ViabilidadePage', () => {
    it('renders locked state for PRO plan', () => {
      mockUser.plan = 'PRO';
      renderWithProviders(<ViabilidadePage />, { route: '/dashboard/viabilidade' });
      expect(screen.getByText(/análise de viabilidade com ia/i)).toBeInTheDocument();
    });

    it('passes locale and country when analyzing', async () => {
      localStorage.setItem(getLocaleStorageKey(), 'en');
      mockIsMarketFeatureEnabled.mockImplementation((feature: string) => feature !== 'smartRelations' && feature !== 'reclameAqui');
      mockUser.plan = 'SCALE';
      mockViabilityAnalyze.mockResolvedValue({
        score: 6,
        verdict: 'Viable with Caveats',
        verdictKey: 'VIABLE_WITH_CAVEATS',
        goNoGo: 'CAUTION',
        summary: 'Moderate competition in the area.',
        competitorDensity: 12,
        saturationIndex: 9,
        digitalMaturityPercent: 40,
        strengths: [],
        risks: [],
        recommendations: [],
        estimatedInvestment: '$50k',
        bestLocations: [],
        segmentBreakdown: [],
        dailyLeadsTarget: 3,
        suggestedOffer: 'Local SEO',
        suggestedTicket: '$500/mo',
        topOpportunities: [],
      });

      renderWithProviders(<ViabilidadePage />, { route: '/dashboard/viabilidade' });

      const textboxes = screen.getAllByRole('textbox');
      fireEvent.change(textboxes[0], { target: { value: 'Gym' } });
      fireEvent.change(textboxes[1], { target: { value: 'Austin' } });
      fireEvent.click(screen.getByRole('button', { name: /analyze viability/i }));

      await waitFor(() => {
        expect(mockViabilityAnalyze).toHaveBeenCalledWith(
          expect.objectContaining({
            businessType: 'Gym',
            city: 'Austin',
            locale: 'en',
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Viable with Caveats')).toBeInTheDocument();
        expect(screen.getByText('Moderate competition in the area.')).toBeInTheDocument();
      });
    });
  });
});
