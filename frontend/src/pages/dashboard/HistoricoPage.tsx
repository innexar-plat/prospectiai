import { useEffect, useState, useMemo } from 'react';
import { Clock, Search, CalendarDays, ChevronRight, ArrowLeft, Star, Phone, Globe, MapPin, FileText, User, BarChart3, Loader2, RotateCw } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import {
  searchApi,
  leadsApi,
  intelligenceApi,
  type SearchHistoryItem,
  type Place,
  type LeadAnalysisListItem,
  type IntelligenceReportItem,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';
import { LoadingState, EmptyState } from '@/components/dashboard/shared/DashboardUI';
import { formatDate } from '@/lib/date-utils';
import { useI18n } from '@/lib/i18n';

type TabId = 'buscas' | 'lead' | 'intelligence';
type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const MODULE_KEYS: Record<string, string> = {
  VIABILITY: 'page.historico.module.viability',
  COMPETITORS: 'page.historico.module.competitors',
  MARKET: 'page.historico.module.market',
  MY_COMPANY: 'page.historico.module.myCompany',
};

function getModuleLabel(t: TranslateFn, key: string): string {
  const messageKey = MODULE_KEYS[key];
  return messageKey ? t(messageKey) : key;
}

function getHistoricoSubtitle(t: TranslateFn, activeTab: TabId, searchTotal: number, intelTotal: number): string {
  if (activeTab === 'buscas' && searchTotal) return t('page.historico.subtitleSearches', { count: searchTotal });
  if (activeTab === 'lead') return t('page.historico.subtitleLead');
  if (activeTab === 'intelligence' && intelTotal !== 0) return t('page.historico.subtitleIntel', { count: intelTotal });
  return t('page.historico.subtitleDefault');
}

function HistoricoSearchDetail({
  item,
  onBack,
  onNavigate,
  formatDateFn,
  t,
}: {
  item: SearchHistoryItem & { resultsData?: Place[] };
  onBack: () => void;
  onNavigate: (path: string) => void;
  formatDateFn: (iso: string) => string;
  t: TranslateFn;
}) {
  const places = item.resultsData ?? [];
  return (
    <>
      <HeaderDashboard
        title={item.textQuery}
        subtitle={t('page.historico.detail.subtitle', { date: formatDateFn(item.createdAt), count: item.resultsCount })}
        breadcrumb={t('page.historico.detail.breadcrumb')}
      />
      <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
        <Button variant="ghost" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={16} /> {t('page.historico.back')}
        </Button>
        <EmptyState
          icon={Search}
          title={t('page.historico.detail.noResults')}
          description={t('page.historico.detail.noResultsDesc')}
          actionLabel={t('page.historico.detail.newSearch')}
          onAction={() => onNavigate('/dashboard')}
        />
        <div className="space-y-3">
          {places.map((place, idx) => {
            const name = place.displayName?.text || '—';
            const address = place.formattedAddress || '';
            const phone = place.nationalPhoneNumber || place.internationalPhoneNumber || '';
            const website = place.websiteUri || '';
            const rating = place.rating;
            const reviews = place.userRatingCount ?? 0;
            return (
              <div key={place.id || idx} className="bg-card border border-border rounded-2xl p-4 sm:px-6 hover:border-violet-500/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{name}</p>
                    {address && (
                      <p className="text-xs text-muted mt-1 flex items-center gap-1 truncate">
                        <MapPin size={12} className="shrink-0" /> {address}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted">
                      {rating != null && (
                        <span className="inline-flex items-center gap-1">
                          <Star size={12} className="text-amber-600 dark:text-amber-400" /> {rating}/5
                          {reviews > 0 && <span className="text-muted">({reviews})</span>}
                        </span>
                      )}
                      {phone && (
                        <span className="inline-flex items-center gap-1"><Phone size={12} /> {phone}</span>
                      )}
                      {website && (
                        <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300">
                          <Globe size={12} /> {t('page.historico.website')}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function HistoricoIntelDetail({
  item,
  onBack,
  onFavorite,
  formatDateFn,
  t,
}: {
  item: IntelligenceReportItem & { resultsData?: unknown };
  onBack: () => void;
  onFavorite: (e: React.MouseEvent) => void;
  formatDateFn: (iso: string) => string;
  t: TranslateFn;
}) {
  const rd = item.resultsData as Record<string, unknown> | undefined;
  const moduleLabel = getModuleLabel(t, item.module);
  const cityPart = item.inputCity ? ' · ' + item.inputCity : '';
  const subtitle = item.inputQuery + cityPart + ' — ' + formatDateFn(item.createdAt);
  return (
    <>
      <HeaderDashboard
        title={t('page.historico.intel.reportTitle', { module: moduleLabel })}
        subtitle={subtitle}
        breadcrumb={t('page.historico.intel.breadcrumb')}
      />
      <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
            <ArrowLeft size={16} /> {t('page.historico.back')}
          </Button>
          <button
            type="button"
            onClick={onFavorite}
            className="p-2 rounded-lg border border-border hover:bg-violet-500/10 text-amber-600 dark:text-amber-400"
            title={item.isFavorite ? t('common.unfavorite') : t('common.favorite')}
            aria-label={item.isFavorite ? t('common.unfavorite') : t('common.favorite')}
          >
            <Star size={18} className={item.isFavorite ? 'fill-current' : ''} />
          </button>
        </div>
        <div className="rounded-2xl bg-card border border-border p-6">
          {rd && typeof rd === 'object' && (
            <div className="prose prose-invert max-w-none text-sm">
              {item.module === 'VIABILITY' && 'score' in rd && (
                <div className="space-y-2">
                  <p><strong>{t('page.historico.intel.score')}</strong> {String(rd.score)}/10</p>
                  {'verdict' in rd && <p><strong>{t('page.historico.intel.verdict')}</strong> {String(rd.verdict)}</p>}
                  {'summary' in rd && <p className="text-muted">{String(rd.summary)}</p>}
                </div>
              )}
              {item.module === 'COMPETITORS' && 'totalCount' in rd && (
                <div className="space-y-2">
                  <p><strong>{t('page.historico.intel.competitorsMapped')}</strong> {String(rd.totalCount)}</p>
                  {'avgRating' in rd && <p><strong>{t('page.historico.intel.avgRating')}</strong> {String(rd.avgRating)}</p>}
                </div>
              )}
              {item.module === 'MARKET' && 'totalBusinesses' in rd && (
                <div className="space-y-2">
                  <p><strong>{t('page.historico.intel.totalBusinesses')}</strong> {String(rd.totalBusinesses)}</p>
                </div>
              )}
              {item.module === 'MY_COMPANY' && ('summary' in rd || (typeof rd.socialNetworks === 'object' && rd.socialNetworks && 'presence' in rd.socialNetworks)) && (
                <div className="space-y-2">
                  {'summary' in rd && <p className="text-muted">{String(rd.summary)}</p>}
                  {typeof rd.socialNetworks === 'object' && rd.socialNetworks && 'presence' in rd.socialNetworks && (
                    <p className="text-muted"><strong>{t('page.historico.intel.socialNetworks')}</strong> {String((rd.socialNetworks as Record<string, unknown>).presence ?? '')}</p>
                  )}
                </div>
              )}
              {(!('score' in rd && item.module === 'VIABILITY') && !('totalCount' in rd && item.module === 'COMPETITORS') && !('totalBusinesses' in rd && item.module === 'MARKET') && !(item.module === 'MY_COMPANY' && 'summary' in rd)) && (
                <p className="text-muted">{t('page.historico.intel.reportSavedFull', { date: formatDateFn(item.createdAt) })}</p>
              )}
            </div>
          )}
          {(!rd || typeof rd !== 'object') && (
            <p className="text-muted">{t('page.historico.intel.reportSaved', { date: formatDateFn(item.createdAt) })}</p>
          )}
        </div>
      </div>
    </>
  );
}

export default function HistoricoPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = (searchParams.get('tab') as TabId) || 'buscas';
  const moduleFromUrl = searchParams.get('module') || '';

  const [activeTab, setActiveTab] = useState<TabId>(tabFromUrl);

  const [searchItems, setSearchItems] = useState<SearchHistoryItem[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(true);

  const [leadItems, setLeadItems] = useState<LeadAnalysisListItem[]>([]);
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadFavoriteOnly, setLeadFavoriteOnly] = useState(false);

  const [intelItems, setIntelItems] = useState<IntelligenceReportItem[]>([]);
  const [intelTotal, setIntelTotal] = useState(0);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelModule, setIntelModule] = useState(moduleFromUrl || '');
  const [intelFavoriteOnly, setIntelFavoriteOnly] = useState(false);

  const [selectedSearchItem, setSelectedSearchItem] = useState<(SearchHistoryItem & { resultsData?: Place[] }) | null>(null);
  const [selectedIntelItem, setSelectedIntelItem] = useState<(IntelligenceReportItem & { resultsData?: unknown }) | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    setActiveTab(tabFromUrl);
    if (moduleFromUrl) setIntelModule(moduleFromUrl);
  }, [tabFromUrl, moduleFromUrl]);

  useEffect(() => {
    let cancelled = false;
    setSearchLoading(true);
    searchApi.history({ limit: 50 })
      .then((res) => {
        if (!cancelled) {
          setSearchItems(res.items);
          setSearchTotal(res.total);
        }
      })
      .catch(() => {
        if (!cancelled) addToast('error', t('page.historico.toast.loadError'));
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => { cancelled = true; };
  }, [addToast, t]);

  useEffect(() => {
    if (activeTab !== 'lead') return;
    let cancelled = false;
    setLeadLoading(true);
    leadsApi.list()
      .then((data) => {
        if (!cancelled) setLeadItems(data);
      })
      .catch(() => {
        if (!cancelled) addToast('error', t('page.historico.toast.leadLoadError'));
      })
      .finally(() => {
        if (!cancelled) setLeadLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab, addToast, t]);

  useEffect(() => {
    if (activeTab !== 'intelligence') return;
    let cancelled = false;
    setIntelLoading(true);
    intelligenceApi.history({
      module: intelModule || undefined,
      favoriteOnly: intelFavoriteOnly || undefined,
      limit: 50,
    })
      .then((res) => {
        if (!cancelled) {
          setIntelItems(res.items);
          setIntelTotal(res.total);
        }
      })
      .catch(() => {
        if (!cancelled) addToast('error', t('page.historico.toast.intelLoadError'));
      })
      .finally(() => {
        if (!cancelled) setIntelLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab, intelModule, intelFavoriteOnly, addToast, t]);


  const setTab = (tabId: TabId) => {
    setActiveTab(tabId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tabId);
      if (tabId !== 'intelligence') next.delete('module');
      return next;
    });
  };

  const leadFiltered = useMemo(() => {
    if (!leadFavoriteOnly) return leadItems;
    return leadItems.filter((r) => r.isFavorite);
  }, [leadItems, leadFavoriteOnly]);

  const handleSearchItemClick = async (item: SearchHistoryItem) => {
    setLoadingDetail(true);
    try {
      const detail = await searchApi.historyDetail(item.id);
      setSelectedSearchItem(detail);
    } catch {
      addToast('error', t('page.historico.toast.searchDetailError'));
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleIntelItemClick = async (item: IntelligenceReportItem) => {
    setLoadingDetail(true);
    try {
      const detail = await intelligenceApi.detail(item.id);
      setSelectedIntelItem(detail);
    } catch {
      addToast('error', t('page.historico.toast.reportError'));
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleLeadFavorite = async (item: LeadAnalysisListItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const next = !item.isFavorite;
      await leadsApi.toggleFavorite(item.id, next);
      setLeadItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, isFavorite: next } : r)));
    } catch {
      addToast('error', t('page.historico.toast.favoriteError'));
    }
  };

  const handleIntelFavorite = async (item: IntelligenceReportItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const next = !item.isFavorite;
      await intelligenceApi.toggleFavorite(item.id, next);
      setIntelItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, isFavorite: next } : r)));
      if (selectedIntelItem?.id === item.id) setSelectedIntelItem((s) => (s ? { ...s, isFavorite: next } : null));
    } catch {
      addToast('error', t('page.historico.toast.favoriteError'));
    }
  };

  if (selectedSearchItem) {
    return (
      <HistoricoSearchDetail
        item={selectedSearchItem}
        onBack={() => setSelectedSearchItem(null)}
        onNavigate={(path) => navigate(path)}
        formatDateFn={formatDate}
        t={t}
      />
    );
  }

  if (selectedIntelItem) {
    return (
      <HistoricoIntelDetail
        item={selectedIntelItem}
        onBack={() => setSelectedIntelItem(null)}
        onFavorite={(e) => handleIntelFavorite(selectedIntelItem, e)}
        formatDateFn={formatDate}
        t={t}
      />
    );
  }

  const tabs = [
    { id: 'buscas' as const, label: t('page.historico.tab.searches'), icon: Search },
    { id: 'lead' as const, label: t('page.historico.tab.lead'), icon: User },
    { id: 'intelligence' as const, label: t('page.historico.tab.intelligence'), icon: FileText },
  ];

  return (
    <>
      <HeaderDashboard
        title={t('page.historico.title')}
        subtitle={getHistoricoSubtitle(t, activeTab, searchTotal, intelTotal)}
        breadcrumb={t('page.historico.breadcrumb')}
      />
      <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === id
                ? 'bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/30'
                : 'bg-card border border-border text-muted hover:text-foreground hover:border-violet-500/30'
                }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {loadingDetail && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-3 shadow-xl">
              <Loader2 size={24} className="animate-spin text-violet-600 dark:text-violet-400" />
              <span className="text-foreground font-medium">{t('page.historico.loading')}</span>
            </div>
          </div>
        )}

        {activeTab === 'buscas' && (
          <>
            {(() => {
              if (searchLoading) return <LoadingState message={t('page.historico.loadingHistory')} />;
              if (searchItems.length === 0) return (
                <EmptyState
                  icon={Clock}
                  title={t('page.historico.emptySearches')}
                  description={t('page.historico.emptySearchesDesc')}
                  actionLabel={t('common.doSearch')}
                  onAction={() => navigate('/dashboard')}
                />
              );
              return (
                <div className="space-y-3">
                  {searchItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border rounded-2xl p-4 sm:px-6 hover:border-violet-500/30 hover:bg-violet-500/5 transition-colors group"
                    >
                      <button
                        type="button"
                        onClick={() => handleSearchItemClick(item)}
                        className="flex items-start gap-3 flex-1 min-w-0 text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                          <Search size={18} className="text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-foreground truncate">{item.textQuery}</p>
                            {idx === 0 && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">
                                {t('page.historico.mostRecent')}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted">
                            <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {formatDate(item.createdAt)}</span>
                            <span>{t('page.historico.resultsCount', { count: item.resultsCount })}</span>
                            {(item.city || item.country) && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={12} />
                                {[item.city, item.state, item.country].filter(Boolean).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 px-3 text-xs font-semibold"
                          icon={<RotateCw size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            const params = new URLSearchParams();
                            params.set('q', item.textQuery);
                            if (item.city) params.set('city', item.city);
                            if (item.state) params.set('state', item.state);
                            if (item.country) params.set('country', item.country);
                            const filters = item.filters as Record<string, string> | undefined;
                            if (filters?.includedType) params.set('type', filters.includedType);
                            navigate(`/dashboard?${params.toString()}`);
                          }}
                        >
                          {t('page.historico.research')}
                        </Button>
                        <ChevronRight size={20} className="text-muted group-hover:text-violet-600 dark:text-violet-400 transition-colors hidden sm:block" />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </>
        )}

        {activeTab === 'lead' && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={leadFavoriteOnly}
                  onChange={(e) => setLeadFavoriteOnly(e.target.checked)}
                  className="rounded border-border bg-surface text-violet-500 focus:ring-violet-500/50"
                />
                <span className="text-sm text-muted">{t('common.favoritesOnly')}</span>
              </label>
            </div>
            {(() => {
              if (leadLoading) {
                return <LoadingState message={t('page.historico.loadingLeadReports')} />;
              }
              if (leadFiltered.length === 0) {
                return (
                  <EmptyState
                    icon={User}
                    title={leadFavoriteOnly ? t('page.historico.emptyLeadFav') : t('page.historico.emptyLead')}
                    description={leadFavoriteOnly ? t('page.historico.emptyLeadFavDesc') : t('page.historico.emptyLeadDesc')}
                    actionLabel={leadFavoriteOnly ? t('common.seeAll') : undefined}
                    onAction={leadFavoriteOnly ? () => setLeadFavoriteOnly(false) : undefined}
                  />
                );
              }
              return (
                <div className="space-y-3">
                  {leadFiltered.map((item) => {
                    const leadData = item.lead;
                    const placeId = leadData?.placeId ?? '';
                    return (
                      <div
                        key={item.id}
                        className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border rounded-2xl p-4 sm:px-6 hover:border-violet-500/30 transition-colors"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                            <User size={18} className="text-violet-600 dark:text-violet-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{leadData?.name ?? '—'}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted">
                              <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {formatDate(item.createdAt)}</span>
                              {item.score != null && <span>{t('page.historico.leadScore', { score: item.score })}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleLeadFavorite(item, e)}
                            className="p-2 rounded-lg border border-border hover:bg-violet-500/10 text-amber-600 dark:text-amber-400"
                            title={item.isFavorite ? t('common.unfavorite') : t('common.favorite')}
                            aria-label={item.isFavorite ? t('common.unfavorite') : t('common.favorite')}
                          >
                            <Star size={18} className={item.isFavorite ? 'fill-current' : ''} />
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
                            onClick={() => placeId && navigate(`/dashboard/lead/${placeId}`)}
                          >
                            {t('page.historico.openReport')}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}

        {activeTab === 'intelligence' && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <select
                value={intelModule}
                onChange={(e) => setIntelModule(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="">{t('page.historico.allModules')}</option>
                <option value="VIABILITY">{getModuleLabel(t, 'VIABILITY')}</option>
                <option value="COMPETITORS">{getModuleLabel(t, 'COMPETITORS')}</option>
                <option value="MARKET">{getModuleLabel(t, 'MARKET')}</option>
                <option value="MY_COMPANY">{getModuleLabel(t, 'MY_COMPANY')}</option>
              </select>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={intelFavoriteOnly}
                  onChange={(e) => setIntelFavoriteOnly(e.target.checked)}
                  className="rounded border-border bg-surface text-violet-500 focus:ring-violet-500/50"
                />
                <span className="text-sm text-muted">{t('common.favoritesOnly')}</span>
              </label>
            </div>
            {(() => {
              if (intelLoading) {
                return <LoadingState message={t('page.historico.loadingIntelReports')} />;
              }
              if (intelItems.length === 0) {
                return (
                  <EmptyState
                    icon={BarChart3}
                    title={intelFavoriteOnly ? t('page.historico.emptyIntelFav') : t('page.historico.emptyIntel')}
                    description={t('page.historico.emptyIntelDesc')}
                    actionLabel={intelFavoriteOnly ? t('common.seeAll') : undefined}
                    onAction={intelFavoriteOnly ? () => setIntelFavoriteOnly(false) : undefined}
                  />
                );
              }
              return (
                <div className="space-y-3">
                  {intelItems.map((item) => (
                    <div
                      key={item.id}
                      className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border rounded-2xl p-4 sm:px-6 hover:border-violet-500/30 transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                          <FileText size={18} className="text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">
                            {item.inputQuery}{item.inputCity ? ` · ${item.inputCity}` : ''}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted">
                            <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {formatDate(item.createdAt)}</span>
                            <span>{getModuleLabel(t, item.module)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleIntelFavorite(item, e)}
                          className="p-2 rounded-lg border border-border hover:bg-violet-500/10 text-amber-600 dark:text-amber-400"
                          title={item.isFavorite ? t('common.unfavorite') : t('common.favorite')}
                          aria-label={item.isFavorite ? t('common.unfavorite') : t('common.favorite')}
                        >
                          <Star size={18} className={item.isFavorite ? 'fill-current' : ''} />
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
                          onClick={() => handleIntelItemClick(item)}
                        >
                          {t('page.historico.open')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </>
  );
}
