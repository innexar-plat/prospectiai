import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Loader2 } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { SearchFiltersRow } from '@/components/dashboard/SearchFiltersRow';
import { SearchSegmentRow } from '@/components/dashboard/SearchSegmentRow';
import { Button } from '@/components/ui/Button';
import { startSearch, validateSearchPayload, buildTextQuery } from '@/lib/searchService';
import { useToast } from '@/contexts/ToastContext';
import { useSearchResults } from '@/contexts/SearchResultsContext';
import { DEFAULT_SEARCH_VALUES } from '@/lib/searchFormSchema';
import type { SearchFormValues } from '@/lib/searchFormSchema';
import type { LocationFormValues } from '@/components/dashboard/SearchParamsLocationCard';
import type { IntelligenceFormValues } from '@/components/dashboard/SearchParamsIntelligenceCard';
import { getCountryLabel } from '@/lib/locationData';

const MIN_ADVANCED_TERM = 3;

export default function DashboardIndex() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { setLastSearchResults } = useSearchResults();

  const [form, setForm] = useState<SearchFormValues>(DEFAULT_SEARCH_VALUES);
  const [loading, setLoading] = useState(false);
  const [advancedTermError, setAdvancedTermError] = useState<string | null>(null);

  const locationValue: LocationFormValues = useMemo(
    () => ({
      country: form.country,
      state: form.state,
      city: form.city ?? '',
      radiusKm: form.radiusKm,
    }),
    [form.country, form.state, form.city, form.radiusKm]
  );

  const intelligenceValue: IntelligenceFormValues = useMemo(
    () => ({
      niches: form.niches,
      includedType: form.includedType,
      advancedTerm: form.advancedTerm ?? '',
    }),
    [form.niches, form.includedType, form.advancedTerm]
  );

  const updateLocation = useCallback((v: Partial<LocationFormValues>) => {
    setForm((prev) => ({
      ...prev,
      ...v,
      city: v.city !== undefined ? v.city : prev.city,
    }));
  }, []);

  const updateIntelligence = useCallback((v: Partial<IntelligenceFormValues>) => {
    setForm((prev) => ({ ...prev, ...v }));
    if (v.advancedTerm !== undefined) {
      const t = v.advancedTerm.trim();
      setAdvancedTermError(
        t.length > 0 && t.length < MIN_ADVANCED_TERM
          ? `Mínimo ${MIN_ADVANCED_TERM} caracteres`
          : null
      );
    }
  }, []);

  const payload = useMemo(
    () => ({
      textQuery: '',
      country: getCountryLabel(form.country),
      state: form.state,
      city: form.city ?? '',
      radiusKm: form.radiusKm,
      includedType: form.includedType,
      niches: form.niches,
      advancedTerm: form.advancedTerm ?? '',
    }),
    [form]
  );

  const validation = useMemo(() => validateSearchPayload(payload), [payload]);
  const canSearch = validation.ok;

  const runSearch = useCallback(async () => {
    if (!validation.ok) {
      addToast('error', validation.message);
      return;
    }
    if ((form.advancedTerm?.trim().length ?? 0) > 0 && (form.advancedTerm?.trim().length ?? 0) < MIN_ADVANCED_TERM) {
      addToast('error', `Termo avançado deve ter no mínimo ${MIN_ADVANCED_TERM} caracteres.`);
      return;
    }
    setLoading(true);
    try {
      const result = await startSearch(payload);
      const textQuery = buildTextQuery(payload);
      setLastSearchResults({
        places: result.places ?? [],
        nextPageToken: result.nextPageToken,
        params: {
          textQuery,
          includedType: payload.includedType?.trim() || undefined,
          city: payload.city?.trim() || undefined,
          state: payload.state?.trim() || undefined,
          radiusKm: payload.radiusKm,
        },
      });
      window.dispatchEvent(new Event('refresh-user'));
      addToast('success', `${result.places.length} resultado(s) encontrado(s).`);
      navigate('/dashboard/resultados');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao buscar';
      addToast('error', message);
      navigate('/dashboard/resultados', { state: { error: message } });
    } finally {
      setLoading(false);
    }
  }, [payload, validation, form.advancedTerm, addToast, navigate]);

  const goToHistorico = useCallback(() => navigate('/dashboard/historico'), [navigate]);

  return (
    <>
      <HeaderDashboard
        title="Parâmetros de Busca"
        subtitle="Configure seu público-alvo e nossa IA fará o resto."
        breadcrumb="Prospecção Ativa / Nova Busca"
        onHistórico={goToHistorico}
        onIniciarBusca={runSearch}
        searchLoading={loading}
        primaryDisabled={!canSearch}
      />

      <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6" data-tour="nova-busca">
        {/* Linha 1 – Filtros primários */}
        <section className="pb-4 border-b border-border" aria-label="Filtros de localização">
          <SearchFiltersRow value={locationValue} onChange={updateLocation} disabled={loading} />
        </section>

        {/* Linha 2 – Segmentação */}
        <section className="pb-4 border-b border-border" aria-label="Segmentação e volume">
          <SearchSegmentRow
            value={intelligenceValue}
            onChange={updateIntelligence}
            disabled={loading}
            advancedTermError={advancedTermError ?? undefined}
          />
        </section>

        {/* Linha 3 – Ação principal */}
        <section className="flex justify-center pt-2" aria-label="Iniciar prospecção">
          <Button
            variant="primary"
            size="lg"
            className="min-w-[240px] h-12 px-8 text-base font-bold shadow-lg shadow-violet-600/25"
            icon={
              loading ? (
                <Loader2 size={20} className="animate-spin" aria-hidden />
              ) : (
                <Zap size={20} aria-hidden />
              )
            }
            onClick={runSearch}
            disabled={!canSearch || loading}
            aria-label={loading ? 'Buscando...' : 'Iniciar Prospecção'}
          >
            {loading ? 'Buscando...' : 'Iniciar Prospecção'}
          </Button>
        </section>
      </div>
    </>
  );
}
