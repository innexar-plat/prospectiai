import { useState, useCallback } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { AlertCircle, Download, Loader2 } from 'lucide-react';
import type { SessionUser } from '@/lib/api';
import { searchApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { cn } from '@/lib/utils';
import { exportToCSV, flattenForExport } from '@/lib/exportService';
import { useSearchResults } from '@/contexts/SearchResultsContext';

/** Results passed via location state (error/loading only; list comes from context). */
interface ResultadosState {
  error?: string;
  loading?: boolean;
}

export default function ResultadosPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lastSearchResults, appendSearchResults } = useSearchResults();
  const state = (location.state ?? {}) as ResultadosState;
  const error = state.error;
  const loading = state.loading;
  const [loadingMore, setLoadingMore] = useState(false);

  const places = lastSearchResults?.places ?? [];
  const nextPageToken = lastSearchResults?.params ? lastSearchResults.nextPageToken : undefined;
  const searchParams = lastSearchResults?.params;

  const handleLoadMore = useCallback(async () => {
    if (!searchParams || !nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await searchApi.search({
        textQuery: searchParams.textQuery,
        includedType: searchParams.includedType,
        city: searchParams.city,
        state: searchParams.state,
        radiusKm: searchParams.radiusKm,
        hasWebsite: searchParams.hasWebsite,
        hasPhone: searchParams.hasPhone,
        pageToken: nextPageToken,
        pageSize: 20,
      });
      appendSearchResults(res.places ?? [], res.nextPageToken);
    } finally {
      setLoadingMore(false);
    }
  }, [searchParams, nextPageToken, loadingMore, appendSearchResults]);

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto w-full">
        <div className="rounded-2xl bg-card border border-border p-12 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" aria-hidden />
          <p className="text-muted font-medium">Carregando resultados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-6xl mx-auto w-full">
        <div className="rounded-2xl bg-red-500/15 border-2 border-red-500/40 p-8 flex flex-col items-center gap-4">
          <AlertCircle size={40} className="text-red-600 dark:text-red-400 shrink-0" aria-hidden />
          <h2 className="text-xl font-bold text-foreground">Erro na busca</h2>
          <p className="text-sm font-medium text-red-800 dark:text-red-200 text-center max-w-md">{error}</p>
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            Voltar e tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!loading && !error && !places.length) {
    return (
      <div className="p-8 max-w-6xl mx-auto w-full">
        <div className="rounded-2xl bg-card border border-border p-12 flex flex-col items-center gap-4">
          <p className="text-muted">Nenhum resultado para exibir. Faça uma nova busca.</p>
          <Button variant="primary" onClick={() => navigate('/dashboard')}>
            Nova busca
          </Button>
        </div>
      </div>
    );
  }

  const { user } = useOutletContext<{ user: SessionUser }>();
  const isFree = user.plan === 'FREE';
  const displayLimit = isFree ? 10 : places.length;
  const displayedPlaces = places.slice(0, displayLimit);

  return (
    <>
      <HeaderDashboard
        title="Resultados da busca"
        subtitle={`${places.length} resultado(s) encontrado(s).`}
        breadcrumb="Prospecção Ativa / Resultados"
      />
      <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">

        {/* Export + Actions */}
        <div className="flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
            Nova busca
          </Button>
          {user.plan !== 'FREE' ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => exportToCSV(flattenForExport(displayedPlaces as unknown as Record<string, unknown>[]), `resultados-${Date.now()}`)}
            >
              Exportar CSV
            </Button>
          ) : (
            <span className="text-[10px] text-muted bg-surface px-3 py-1.5 rounded-lg border border-border">Exportação disponível no Starter+</span>
          )}
        </div>

        {isFree && places.length > 10 && (
          <div className="rounded-2xl p-4 bg-violet-600/10 border border-violet-500/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div>
              <p className="text-sm font-bold text-violet-400">Plano Gratuito</p>
              <p className="text-xs text-muted mt-1">Exibindo apenas os 10 primeiros resultados de {places.length}. Faça upgrade para ver todos.</p>
            </div>
            <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/configuracoes')}>
              Fazer Upgrade
            </Button>
          </div>
        )}

        <div className="rounded-[2.4rem] bg-card border border-border overflow-hidden shadow-sm">
          <ul className="divide-y divide-border" role="list">
            {displayedPlaces.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/lead/${encodeURIComponent(p.id)}`, { state: { place: p } })}
                  className={cn(
                    'w-full text-left p-4 sm:p-5 hover:bg-surface/70 active:bg-surface transition-colors rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:ring-inset'
                  )}
                >
                  <p className="font-bold text-foreground">{p.displayName?.text ?? p.id}</p>
                  <p className="text-sm text-muted mt-0.5">{p.formattedAddress ?? '—'}</p>
                  <p className="text-xs text-violet-500 mt-2 font-medium">Clique para ver detalhes e analisar com IA →</p>
                </button>
              </li>
            ))}
          </ul>
          {!isFree && nextPageToken && (
            <div className="p-4 border-t border-border flex justify-center">
              <Button
                variant="secondary"
                size="sm"
                disabled={loadingMore}
                icon={loadingMore ? <Loader2 size={14} className="animate-spin" /> : undefined}
                onClick={handleLoadMore}
              >
                {loadingMore ? 'Carregando...' : 'Exibir mais'}
              </Button>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
            Nova busca
          </Button>
        </div>
      </div>
    </>
  );
}
