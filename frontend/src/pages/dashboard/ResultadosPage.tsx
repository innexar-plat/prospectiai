import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { AlertCircle, Download, Loader2, BookmarkPlus, BookmarkCheck, Sparkles, GitCompare, Star, Globe, Phone, MapPin } from 'lucide-react';
import type { LeadAnalysisListItem, SessionUser } from '@/lib/api';
import { searchApi, leadsApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { cn } from '@/lib/utils';
import { exportToCSV, flattenForExport } from '@/lib/exportService';
import { useSearchResults } from '@/contexts/SearchResultsContext';
import { useToast } from '@/contexts/ToastContext';

/** Results passed via location state (error/loading only; list comes from context). */
interface ResultadosState {
  error?: string;
  loading?: boolean;
}

export default function ResultadosPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const outletContext = useOutletContext<{ user: SessionUser }>();
  const { lastSearchResults, appendSearchResults } = useSearchResults();
  const { addToast } = useToast();
  const state = (location.state ?? {}) as ResultadosState;
  const error = state.error;
  const loading = state.loading;
  const [loadingMore, setLoadingMore] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [leadIndex, setLeadIndex] = useState<Record<string, LeadAnalysisListItem>>({});
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<{ status: string; total: number; processed: number; succeeded: number; failed: number } | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [resultFilter, setResultFilter] = useState<'all' | 'withSite' | 'withPhone' | 'highScore' | 'highRating'>('all');

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

  const handleSaveLead = useCallback(async (e: React.MouseEvent, p: (typeof places)[number]) => {
    e.stopPropagation();
    if (savingId === p.id || savedIds.has(p.id)) return;
    setSavingId(p.id);
    try {
      await leadsApi.save({
        placeId: p.id,
        name: p.displayName?.text ?? p.id,
        address: p.formattedAddress,
        phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber,
        website: p.websiteUri,
        rating: p.rating,
        reviewCount: p.userRatingCount,
        types: p.types,
        businessStatus: p.businessStatus,
      });
      setSavedIds((prev) => new Set(prev).add(p.id));
      addToast('success', `"${p.displayName?.text ?? p.id}" salvo nos leads.`);
    } catch {
      addToast('error', 'Não foi possível salvar o lead.');
    } finally {
      setSavingId(null);
    }
  }, [savingId, savedIds, addToast]);

  useEffect(() => {
    let cancelled = false;
    leadsApi.list()
      .then((list) => {
        if (cancelled) return;
        const map: Record<string, LeadAnalysisListItem> = {};
        const ids = new Set<string>();
        for (const item of list) {
          const pid = item.lead?.placeId;
          if (!pid) continue;
          if (!map[pid]) map[pid] = item;
          ids.add(pid);
        }
        setLeadIndex(map);
        setSavedIds(ids);
      })
      .catch(() => {
        if (!cancelled) {
          setLeadIndex({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!batchJobId) return;
    let cancelled = false;
    const interval = window.setInterval(() => {
      searchApi.analyzeBatchStatus(batchJobId)
        .then((job) => {
          if (cancelled) return;
          setBatchStatus({
            status: job.status,
            total: job.total,
            processed: job.processed,
            succeeded: job.succeeded,
            failed: job.failed,
          });
          if (job.status === 'completed' || job.status === 'failed') {
            window.clearInterval(interval);
            window.dispatchEvent(new Event('refresh-user'));
            leadsApi.list().then((list) => {
              if (cancelled) return;
              const map: Record<string, LeadAnalysisListItem> = {};
              const ids = new Set<string>();
              for (const item of list) {
                const pid = item.lead?.placeId;
                if (!pid) continue;
                if (!map[pid]) map[pid] = item;
                ids.add(pid);
              }
              setLeadIndex(map);
              setSavedIds(ids);
            }).catch(() => {});
            addToast(job.failed > 0 ? 'error' : 'success', job.failed > 0
              ? `Lote finalizado com falhas (${job.succeeded}/${job.total}).`
              : `Lote finalizado com sucesso (${job.succeeded}/${job.total}).`);
            setBatchJobId(null);
          }
        })
        .catch(() => {
          if (!cancelled) {
            window.clearInterval(interval);
            setBatchJobId(null);
            setBatchStatus(null);
          }
        });
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [batchJobId, addToast]);

  const sortedPlaces = useMemo(() => {
    let filtered = [...places];
    if (resultFilter === 'withSite') filtered = filtered.filter((p) => !!p.websiteUri);
    else if (resultFilter === 'withPhone') filtered = filtered.filter((p) => !!(p.nationalPhoneNumber || p.internationalPhoneNumber));
    else if (resultFilter === 'highScore') filtered = filtered.filter((p) => (p.opportunityScore ?? 0) >= 60);
    else if (resultFilter === 'highRating') filtered = filtered.filter((p) => (p.rating ?? 0) >= 4.0);
    return filtered.sort((a, b) => Number(b.opportunityScore ?? 0) - Number(a.opportunityScore ?? 0));
  }, [places, resultFilter]);

  const { user } = outletContext;
  const isFree = user.plan === 'FREE';
  const displayLimit = isFree ? 10 : sortedPlaces.length;
  const displayedPlaces = sortedPlaces.slice(0, displayLimit);

  const handleAnalyzeAll = useCallback(async () => {
    if (batchLoading || displayedPlaces.length === 0) return;
    setBatchLoading(true);
    try {
      const items = displayedPlaces.map((p) => ({
        placeId: p.id,
        name: p.displayName?.text ?? p.id,
        formattedAddress: p.formattedAddress,
        nationalPhoneNumber: p.nationalPhoneNumber,
        internationalPhoneNumber: p.internationalPhoneNumber,
        websiteUri: p.websiteUri,
        rating: p.rating,
        userRatingCount: p.userRatingCount,
        types: p.types,
        primaryType: p.primaryType,
        businessStatus: p.businessStatus,
        reviews: p.reviews,
        currentOpeningHours: p.currentOpeningHours,
      }));
      const job = await searchApi.analyzeBatch(items);
      setBatchJobId(job.jobId);
      setBatchStatus({ status: job.status, total: job.total, processed: job.processed, succeeded: job.succeeded, failed: job.failed });
      addToast('success', 'Análise em lote iniciada em background.');
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Falha ao iniciar análise em lote.');
    } finally {
      setBatchLoading(false);
    }
  }, [batchLoading, displayedPlaces, addToast]);

  const toggleCompare = useCallback((placeId: string) => {
    setSelectedForCompare((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) {
        next.delete(placeId);
        return next;
      }
      if (next.size >= 3) return next;
      next.add(placeId);
      return next;
    });
  }, []);

  const handleCompare = useCallback(() => {
    const ids = Array.from(selectedForCompare);
    if (ids.length < 2) {
      addToast('error', 'Selecione pelo menos 2 leads para comparar.');
      return;
    }
    const selectedPlaces = displayedPlaces.filter((p) => ids.includes(p.id));
    navigate(`/dashboard/comparar?ids=${encodeURIComponent(ids.join(','))}`, { state: { places: selectedPlaces } });
  }, [selectedForCompare, displayedPlaces, navigate, addToast]);

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

  return (
    <>
      <HeaderDashboard
        title="Resultados da busca"
        subtitle={resultFilter === 'all' ? `${places.length} resultado(s) encontrado(s).` : `${sortedPlaces.length} de ${places.length} resultado(s) (filtro ativo).`}
        breadcrumb="Prospecção Ativa / Resultados"
      />
      <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">

        {/* Export + Actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
              Nova busca
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={batchLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              disabled={batchLoading || displayedPlaces.length === 0 || batchJobId != null}
              onClick={handleAnalyzeAll}
            >
              {batchJobId ? 'Lote em andamento...' : 'Analisar todos (background)'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<GitCompare size={14} />}
              disabled={selectedForCompare.size < 2}
              onClick={handleCompare}
            >
              Comparar ({selectedForCompare.size})
            </Button>
          </div>
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

        {batchStatus && (
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-xs text-foreground">
            Lote: {batchStatus.processed}/{batchStatus.total} processados · {batchStatus.succeeded} sucesso · {batchStatus.failed} falhas
          </div>
        )}

        {/* Quick filter chips */}
        {places.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Filtrar:</span>
            {([
              { key: 'all', label: `Todos (${places.length})` },
              { key: 'withSite', label: `Com site (${places.filter((p) => !!p.websiteUri).length})` },
              { key: 'withPhone', label: `Com tel. (${places.filter((p) => !!(p.nationalPhoneNumber || p.internationalPhoneNumber)).length})` },
              { key: 'highScore', label: `Score ≥60 (${places.filter((p) => (p.opportunityScore ?? 0) >= 60).length})` },
              { key: 'highRating', label: `Rating ≥4⭐ (${places.filter((p) => (p.rating ?? 0) >= 4.0).length})` },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setResultFilter(key)}
                className={cn(
                  'h-7 px-3 rounded-full text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/30',
                  resultFilter === key
                    ? 'bg-violet-600 text-white'
                    : 'bg-surface border border-border text-muted hover:border-violet-500/30 hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {isFree && places.length > 10 && (
          <div className="rounded-2xl p-4 bg-violet-600/10 border border-violet-500/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div>
              <p className="text-sm font-bold text-violet-600 dark:text-violet-400">Plano Gratuito</p>
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
              <li key={p.id} className="flex items-stretch">
                <div className="pl-3 flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedForCompare.has(p.id)}
                    onChange={() => toggleCompare(p.id)}
                    disabled={!selectedForCompare.has(p.id) && selectedForCompare.size >= 3}
                    className="w-4 h-4 accent-violet-500"
                    aria-label="Selecionar para comparar"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/lead/${encodeURIComponent(p.id)}`, { state: { place: p } })}
                  className={cn(
                    'flex-1 text-left p-4 sm:p-5 hover:bg-surface/70 active:bg-surface transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:ring-inset'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-foreground">{p.displayName?.text ?? p.id}</p>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className="text-[10px] px-2 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300">
                        Opp {p.opportunityScore ?? 0}
                      </span>
                      {leadIndex[p.id]?.score != null && (
                        <span className="text-[10px] px-2 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                          IA {leadIndex[p.id].score}
                        </span>
                      )}
                      {savedIds.has(p.id) && (
                        <span className="text-[10px] px-2 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                          <BookmarkCheck size={10} /> Salvo
                        </span>
                      )}
                      {leadIndex[p.id]?.isFavorite && (
                        <span className="text-[10px] px-2 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
                          <Star size={10} /> Favorito
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-muted">
                    <MapPin size={12} className="shrink-0" aria-hidden />
                    <span className="truncate">{p.formattedAddress ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {p.rating != null && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                        <Star size={11} className="fill-amber-400" aria-hidden /> {p.rating.toFixed(1)}
                        {p.userRatingCount != null && <span className="text-muted">({p.userRatingCount})</span>}
                      </span>
                    )}
                    {p.websiteUri ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                        <Globe size={11} aria-hidden /> Tem site
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400/70">
                        <Globe size={11} aria-hidden /> Sem site
                      </span>
                    )}
                    {(p.nationalPhoneNumber || p.internationalPhoneNumber) ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                        <Phone size={11} aria-hidden /> {p.nationalPhoneNumber || p.internationalPhoneNumber}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400/70">
                        <Phone size={11} aria-hidden /> Sem telefone
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-violet-500 mt-2 font-medium">Clique para ver detalhes e analisar com IA →</p>
                </button>
                <div className="flex items-center pr-4">
                  <button
                    type="button"
                    title={savedIds.has(p.id) ? 'Lead salvo' : 'Salvar lead'}
                    onClick={(e) => handleSaveLead(e, p)}
                    disabled={savingId === p.id || savedIds.has(p.id)}
                    className="p-2 rounded-lg text-muted hover:text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-60"
                  >
                    {savingId === p.id
                      ? <Loader2 size={18} className="animate-spin" />
                      : savedIds.has(p.id)
                        ? <BookmarkCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
                        : <BookmarkPlus size={18} />}
                  </button>
                </div>
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
