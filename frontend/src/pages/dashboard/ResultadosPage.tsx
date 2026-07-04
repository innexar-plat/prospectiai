import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { AlertCircle, Download, Loader2, BookmarkPlus, BookmarkCheck, Sparkles, GitCompare, Star, Globe, Phone, MapPin, Info, Mail } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import type { LeadAnalysisListItem, SessionUser } from '@/lib/api';
import { searchApi, leadsApi, analyzeStream } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { ProfileCompletenessBanner } from '@/components/dashboard/ProfileCompletenessBanner';
import { ResultCardAnalyzeButton } from '@/components/dashboard/ResultCardAnalyzeButton';
import { ResultCardQuickActions } from '@/components/dashboard/ResultCardQuickActions';
import { AiAnalysisCardPreview } from '@/components/dashboard/AiAnalysisCardPreview';
import { cn } from '@/lib/utils';
import { buildAnalyzePayload } from '@/lib/analyze-payload';
import { exportToCSV, flattenForExport } from '@/lib/exportService';
import { useSearchResults } from '@/contexts/SearchResultsContext';
import { useToast } from '@/contexts/ToastContext';
import { useI18n } from '@/lib/i18n';
import { isMarketFeatureEnabled } from '@/lib/market';

function formatCnpj(value: string | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) return value;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatPorte(value: string | null | undefined, t: (key: string) => string): string | null {
  if (!value) return null;
  if (value === 'ME') return t('page.resultados.porteME');
  if (value === 'EPP') return t('page.resultados.porteEPP');
  return value;
}

function getOpeningHoursLabel(
  weekdayDescriptions: string[] | undefined,
  openNow: boolean | undefined,
  t: (key: string) => string,
): string | null {
  if (!weekdayDescriptions?.length) return null;
  if (openNow == null) return t('page.resultados.hoursAvailable');
  return openNow ? t('page.resultados.hoursOpen') : t('page.resultados.hoursClosed');
}

function stopCardNavigation(e: React.MouseEvent | React.KeyboardEvent) {
  e.stopPropagation();
  e.preventDefault();
}

function ScoreBadgeWithInfo({
  label,
  tooltipKey,
  badgeClassName,
  t,
}: {
  label: string;
  tooltipKey: string;
  badgeClassName: string;
  t: (key: string) => string;
}) {
  const tooltip = t(tooltipKey);
  return (
    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-0.5 font-semibold', badgeClassName)}>
      {label}
      <span
        role="img"
        aria-label={tooltip}
        title={tooltip}
        className="inline-flex shrink-0 rounded-full p-0.5 opacity-70"
        onClick={stopCardNavigation}
        onKeyDown={stopCardNavigation}
      >
        <Info size={10} aria-hidden />
      </span>
    </span>
  );
}

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
  const { t, locale } = useI18n();
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
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const streamAbortRef = useRef<Map<string, { abort: () => void }>>(new Map());
  const batchPlacesRef = useRef<(typeof places)[number][]>([]);
  const [resultFilter, setResultFilter] = useState<'all' | 'withSite' | 'withPhone' | 'highScore' | 'highRating'>('all');

  const navigateToLeadDetail = useCallback((place: (typeof places)[number]) => {
    navigate(`/dashboard/lead/${encodeURIComponent(place.id)}`, { state: { place } });
  }, [navigate]);

  const places = useMemo(() => lastSearchResults?.places ?? [], [lastSearchResults]);
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
        country: searchParams.country,
        radiusKm: searchParams.radiusKm,
        hasWebsite: searchParams.hasWebsite,
        hasPhone: searchParams.hasPhone,
        pageToken: nextPageToken,
        pageSize: 20,
      });
      appendSearchResults(res.places ?? [], res.nextPageToken);
    } catch {
      addToast('error', t('page.resultados.toast.loadMoreError'));
    } finally {
      setLoadingMore(false);
    }
  }, [searchParams, nextPageToken, loadingMore, appendSearchResults, addToast, t]);

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
      addToast('success', t('page.resultados.toast.saved', { name: p.displayName?.text ?? p.id }));
    } catch {
      addToast('error', t('page.resultados.toast.saveError'));
    } finally {
      setSavingId(null);
    }
  }, [savingId, savedIds, addToast, t]);

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
              if (job.succeeded > 0) {
                const firstAnalyzed = batchPlacesRef.current.find((place) => map[place.id]?.score != null);
                if (firstAnalyzed) {
                  navigateToLeadDetail(firstAnalyzed);
                }
              }
              batchPlacesRef.current = [];
            }).catch(() => {
              batchPlacesRef.current = [];
            });
            addToast(job.failed > 0 ? 'error' : 'success', job.failed > 0
              ? t('page.resultados.toast.batchPartial', { succeeded: job.succeeded, total: job.total })
              : t('page.resultados.toast.batchSuccess', { succeeded: job.succeeded, total: job.total }));
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
  }, [batchJobId, addToast, t, navigateToLeadDetail]);

  const refreshLeadIndex = useCallback(() => {
    leadsApi.list()
      .then((list) => {
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
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      streamAbortRef.current.forEach((controller) => controller.abort());
      streamAbortRef.current.clear();
    };
  }, []);

  const handleAnalyzeCard = useCallback((e: React.MouseEvent, p: (typeof places)[number]) => {
    e.stopPropagation();
    e.preventDefault();
    if (analyzingIds.has(p.id) || batchJobId != null) return;

    setAnalyzingIds((prev) => new Set(prev).add(p.id));
    const payload = buildAnalyzePayload(p, locale);

    const controller = analyzeStream(payload as unknown as Record<string, unknown>, {
      onProgress: () => {},
      onResult: () => {
        setAnalyzingIds((prev) => {
          const next = new Set(prev);
          next.delete(p.id);
          return next;
        });
        streamAbortRef.current.delete(p.id);
        window.dispatchEvent(new Event('refresh-user'));
        refreshLeadIndex();
        navigateToLeadDetail(p);
      },
      onError: (msg) => {
        setAnalyzingIds((prev) => {
          const next = new Set(prev);
          next.delete(p.id);
          return next;
        });
        streamAbortRef.current.delete(p.id);
        addToast('error', msg);
      },
    }, { locale, t });

    streamAbortRef.current.set(p.id, controller);
  }, [analyzingIds, batchJobId, locale, t, addToast, refreshLeadIndex, navigateToLeadDetail]);

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
  const analyzedCount = useMemo(
    () => displayedPlaces.filter((p) => leadIndex[p.id]?.score != null).length,
    [displayedPlaces, leadIndex],
  );
  const showAnalyzeHint = places.length > 0 && analyzedCount === 0 && !batchJobId;

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
      batchPlacesRef.current = displayedPlaces;
      const job = await searchApi.analyzeBatch(items);
      setBatchJobId(job.jobId);
      setBatchStatus({ status: job.status, total: job.total, processed: job.processed, succeeded: job.succeeded, failed: job.failed });
      addToast('success', t('page.resultados.toast.batchStarted'));
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : t('page.resultados.toast.batchError'));
    } finally {
      setBatchLoading(false);
    }
  }, [batchLoading, displayedPlaces, addToast, t]);

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
      addToast('error', t('page.resultados.toast.compareMin'));
      return;
    }
    const selectedPlaces = displayedPlaces.filter((p) => ids.includes(p.id));
    navigate(`/dashboard/comparar?ids=${encodeURIComponent(ids.join(','))}`, { state: { places: selectedPlaces } });
  }, [selectedForCompare, displayedPlaces, navigate, addToast, t]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto w-full space-y-4">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-4 w-96 rounded-lg mb-6" />
        <div className="rounded-[2.4rem] bg-card border border-border overflow-hidden shadow-sm divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 sm:px-5 sm:py-4 flex items-center gap-4">
              <Skeleton className="w-4 h-4 rounded shrink-0" />
              <div className="flex-1 min-w-0">
                <Skeleton className="h-5 w-3/5 mb-2" />
                <Skeleton className="h-3 w-4/5 mb-2" />
                <div className="flex gap-2 mt-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Skeleton className="w-12 h-12 rounded-full" />
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="rounded-2xl bg-red-500/15 border-2 border-red-500/40 p-8 flex flex-col items-center gap-4">
          <AlertCircle size={40} className="text-red-600 dark:text-red-400 shrink-0" aria-hidden />
          <h2 className="text-xl font-bold text-foreground">{t('page.resultados.errorTitle')}</h2>
          <p className="text-sm font-medium text-red-800 dark:text-red-200 text-center max-w-md">{error}</p>
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            {t('page.resultados.errorBack')}
          </Button>
        </div>
      </div>
    );
  }

  if (!loading && !error && !places.length) {
    const showUsEmptyTips = !isMarketFeatureEnabled('cnae');
    return (
      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="rounded-2xl bg-card border border-border p-12 flex flex-col items-center gap-4">
          <p className="text-muted text-center">{t('page.resultados.empty')}</p>
          {showUsEmptyTips && (
            <div className="w-full max-w-md text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                {t('page.resultados.emptyUsTipsTitle')}
              </p>
              <ul className="text-sm text-muted space-y-1.5 list-disc pl-5">
                <li>{t('page.resultados.emptyUsTip1')}</li>
                <li>{t('page.resultados.emptyUsTip2')}</li>
                <li>{t('page.resultados.emptyUsTip3')}</li>
              </ul>
            </div>
          )}
          <Button variant="primary" onClick={() => navigate('/dashboard')}>
            {t('page.resultados.newSearch')}
          </Button>
        </div>
      </div>
    );
  }

  if (!loading && !error && places.length > 0 && sortedPlaces.length === 0) {
    return (
      <>
        <HeaderDashboard
          compact
          title={t('page.resultados.title')}
          subtitle={t('page.resultados.subtitleFiltered', { filtered: 0, total: places.length })}
          breadcrumb={t('page.resultados.breadcrumb')}
        />
        <div className="p-8 max-w-7xl mx-auto w-full">
          <div className="rounded-2xl bg-card border border-border p-12 flex flex-col items-center gap-4">
            <p className="text-muted text-center max-w-md">{t('page.resultados.emptyFilter')}</p>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button variant="secondary" size="sm" onClick={() => setResultFilter('all')}>
                {t('page.resultados.filter.all', { count: places.length })}
              </Button>
              <Button variant="primary" onClick={() => navigate('/dashboard')}>
                {t('page.resultados.newSearch')}
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderDashboard
        compact
        title={t('page.resultados.title')}
        subtitle={resultFilter === 'all' ? t('page.resultados.subtitleAll', { count: places.length }) : t('page.resultados.subtitleFiltered', { filtered: sortedPlaces.length, total: places.length })}
        breadcrumb={t('page.resultados.breadcrumb')}
      />
      <div className="p-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6 min-w-0">
        <ProfileCompletenessBanner user={user} onPrimaryAction={() => navigate('/dashboard/empresa')} />

        {/* Export + Actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap" data-tour="results-analyze">
            <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
              {t('page.resultados.newSearch')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={batchLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              disabled={batchLoading || displayedPlaces.length === 0 || batchJobId != null}
              onClick={handleAnalyzeAll}
            >
              {batchJobId ? t('page.resultados.batchRunning') : t('page.resultados.analyzeAll')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<GitCompare size={14} />}
              disabled={selectedForCompare.size < 2}
              onClick={handleCompare}
            >
              {t('page.resultados.compare', { count: selectedForCompare.size })}
            </Button>
          </div>
          {user.plan !== 'FREE' ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => exportToCSV(flattenForExport(displayedPlaces as unknown as Record<string, unknown>[]), `resultados-${Date.now()}`)}
            >
              {t('page.resultados.exportCsv')}
            </Button>
          ) : (
            <span className="text-[10px] text-muted bg-surface px-3 py-1.5 rounded-lg border border-border">{t('page.resultados.exportLocked')}</span>
          )}
        </div>

        {showAnalyzeHint && (
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-xs text-foreground flex items-start gap-2">
            <Sparkles size={14} className="text-violet-500 shrink-0 mt-0.5" aria-hidden />
            <p>{t('page.resultados.analyzeHint')}</p>
          </div>
        )}

        {batchStatus && (
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-xs text-foreground">
            {t('page.resultados.batchStatus', {
              processed: batchStatus.processed,
              total: batchStatus.total,
              succeeded: batchStatus.succeeded,
              failed: batchStatus.failed,
            })}
          </div>
        )}

        {/* Quick filter chips */}
        {places.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap" data-tour="results-filters">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{t('page.resultados.filterLabel')}</span>
            {([
              { key: 'all', label: t('page.resultados.filter.all', { count: places.length }) },
              { key: 'withSite', label: t('page.resultados.filter.withSite', { count: places.filter((p) => !!p.websiteUri).length }) },
              { key: 'withPhone', label: t('page.resultados.filter.withPhone', { count: places.filter((p) => !!((p.phones && p.phones.length > 0) || p.nationalPhoneNumber || p.internationalPhoneNumber)).length }) },
              { key: 'highScore', label: t('page.resultados.filter.highScore', { count: places.filter((p) => (p.opportunityScore ?? 0) >= 60).length }) },
              { key: 'highRating', label: t('page.resultados.filter.highRating', { count: places.filter((p) => (p.rating ?? 0) >= 4.0).length }) },
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
              <p className="text-sm font-bold text-violet-600 dark:text-violet-400">{t('page.resultados.freePlanTitle')}</p>
              <p className="text-xs text-muted mt-1">{t('page.resultados.freePlanDesc', { total: places.length })}</p>
            </div>
            <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/configuracoes')}>
              {t('page.resultados.upgrade')}
            </Button>
          </div>
        )}

        <div className="rounded-[2.4rem] bg-card border border-border overflow-hidden shadow-sm">
          <ul className="divide-y divide-border" role="list">
            {displayedPlaces.map((p) => {
              const goToDetail = () => navigateToLeadDetail(p);
              const phone = p.phones?.[0] ?? p.nationalPhoneNumber ?? p.internationalPhoneNumber;
              return (
              <li
                key={p.id}
                className="group flex items-stretch min-w-0 transition-shadow hover:bg-surface/30 hover:shadow-[0_4px_20px_-8px_rgba(124,58,237,0.25)]"
              >
                <div className="pl-3 flex items-center shrink-0">
                  <input
                    type="checkbox"
                    checked={selectedForCompare.has(p.id)}
                    onChange={() => toggleCompare(p.id)}
                    disabled={!selectedForCompare.has(p.id) && selectedForCompare.size >= 3}
                    className="w-4 h-4 accent-violet-500"
                    aria-label={t('page.resultados.selectCompare')}
                  />
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={goToDetail}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      goToDetail();
                    }
                  }}
                  className={cn(
                    'flex-1 text-left p-4 sm:px-5 sm:pt-4 sm:pb-2 cursor-pointer',
                    'focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:ring-inset min-w-0',
                  )}
                >
                  <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-foreground text-sm sm:text-base min-w-0 break-words [overflow-wrap:anywhere]">{p.displayName?.text ?? p.id}</p>
                      {(p.companyTradeName || p.companyLegalName) && (
                        <p className="mt-0.5 text-[10px] text-muted min-w-0 break-words [overflow-wrap:anywhere]">
                          {[p.companyTradeName, p.companyLegalName].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap justify-start sm:justify-end w-full sm:w-auto min-w-0">
                      <ScoreBadgeWithInfo
                        label={t('page.resultados.badgeOpp', { score: p.opportunityScore ?? 0 })}
                        tooltipKey="page.resultados.oppTooltip"
                        badgeClassName="border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                        t={t}
                      />
                      {leadIndex[p.id]?.score != null && (
                        <ScoreBadgeWithInfo
                          label={t('page.resultados.badgeAi', { score: leadIndex[p.id].score ?? 0 })}
                          tooltipKey="page.resultados.aiTooltip"
                          badgeClassName="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                          t={t}
                        />
                      )}
                      {p.rating != null && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          <Star size={10} className="fill-amber-400 shrink-0" aria-hidden />
                          {p.rating.toFixed(1)}
                          {p.userRatingCount != null && <span className="text-muted font-normal">({p.userRatingCount})</span>}
                        </span>
                      )}
                      {savedIds.has(p.id) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1 font-semibold">
                          <BookmarkCheck size={10} /> {t('page.resultados.saved')}
                        </span>
                      )}
                      {leadIndex[p.id]?.isFavorite && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 inline-flex items-center gap-1 font-semibold">
                          <Star size={10} /> {t('page.resultados.favorite')}
                        </span>
                      )}
                      {p.id.startsWith('rf_') && isMarketFeatureEnabled('rfSearch') && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-semibold">
                          {t('page.resultados.federalRegistry')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted min-w-0">
                    <MapPin size={11} className="shrink-0" aria-hidden />
                    <span className="min-w-0 break-words [overflow-wrap:anywhere] line-clamp-1">{p.formattedAddress ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap min-w-0">
                    {p.websiteUri ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        <Globe size={10} aria-hidden /> {t('page.resultados.hasWebsite')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400/80">
                        <Globe size={10} aria-hidden /> {t('page.resultados.noWebsite')}
                      </span>
                    )}
                    {phone ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 break-all">
                        <Phone size={10} aria-hidden /> {phone}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400/80">
                        <Phone size={10} aria-hidden /> {t('page.resultados.noPhone')}
                      </span>
                    )}
                    {p.emails && p.emails.length > 0 && p.emails.slice(0, 1).map((em) => (
                      <span key={em} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300 break-all" title={t('page.resultados.hasEmail')}>
                        <Mail size={10} aria-hidden /> {em}
                      </span>
                    ))}
                    {p.rfData?.porte && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                        {t('page.resultados.porteLabel')}: {formatPorte(p.rfData.porte, t)}
                      </span>
                    )}
                    {p.cnpjStatus && isMarketFeatureEnabled('cnae') && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border border-border bg-surface text-muted">
                        {t('page.resultados.cnpjLabel')}: {p.cnpjStatus}
                      </span>
                    )}
                    {getOpeningHoursLabel(p.currentOpeningHours?.weekdayDescriptions, p.currentOpeningHours?.openNow, t) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border border-border bg-surface text-muted">
                        {getOpeningHoursLabel(p.currentOpeningHours?.weekdayDescriptions, p.currentOpeningHours?.openNow, t)}
                      </span>
                    )}
                  </div>
                  {(p.companyMainCnae || p.cnpj) && isMarketFeatureEnabled('cnae') && (
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap min-w-0">
                      {p.companyMainCnae && (
                        <span className="text-[10px] text-cyan-600 dark:text-cyan-400 min-w-0 break-words [overflow-wrap:anywhere]">
                          CNAE: {p.companyMainCnae}
                        </span>
                      )}
                      {p.cnpj && (
                        <span className="text-[10px] text-muted shrink-0">
                          {t('page.resultados.cnpjLabel')}: {formatCnpj(p.cnpj) ?? p.cnpj}
                        </span>
                      )}
                    </div>
                  )}
                  {(p as { rfData?: { cnaeDescricao?: string | null; porte?: string | null; email?: string | null } }).rfData && isMarketFeatureEnabled('rfSearch') && (
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap min-w-0">
                      {(p as { rfData?: { cnaeDescricao?: string | null } }).rfData?.cnaeDescricao && !p.companyMainCnae && (
                        <span className="text-[10px] text-cyan-600 dark:text-cyan-400 min-w-0 break-words [overflow-wrap:anywhere]">
                          CNAE: {(p as { rfData: { cnaeDescricao: string } }).rfData.cnaeDescricao}
                        </span>
                      )}
                      {(p as { rfData?: { porte?: string | null } }).rfData?.porte && (
                        <span className="text-[10px] text-muted shrink-0">
                          {t('page.resultados.porteLabel')}: {(p as { rfData: { porte: string } }).rfData.porte === 'ME'
                            ? t('page.resultados.porteMicro')
                            : (p as { rfData: { porte: string } }).rfData.porte === 'EPP'
                              ? t('page.resultados.porteSmall')
                              : t('page.resultados.porteLarge')}
                        </span>
                      )}
                    </div>
                  )}
                  {leadIndex[p.id]?.score != null && (
                    <AiAnalysisCardPreview source={leadIndex[p.id]} className="mt-2" />
                  )}
                </div>
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex items-center justify-between gap-2 flex-wrap border-t border-border/40 sm:border-0 sm:-mt-1">
                  <ResultCardQuickActions place={p} onViewDetails={goToDetail} />
                  <ResultCardAnalyzeButton
                    score={leadIndex[p.id]?.score}
                    isAnalyzing={analyzingIds.has(p.id)}
                    disabled={batchJobId != null}
                    onAnalyze={(e) => handleAnalyzeCard(e, p)}
                  />
                </div>
              </div>
                <div className="flex items-center pr-2 sm:pr-4 shrink-0">
                  <button
                    type="button"
                    title={savedIds.has(p.id) ? t('page.resultados.leadSaved') : t('page.resultados.saveLead')}
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
            );})}
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
                {loadingMore ? t('common.loading') : t('page.resultados.showMore')}
              </Button>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
            {t('page.resultados.newSearch')}
          </Button>
        </div>
      </div>
    </>
  );
}
