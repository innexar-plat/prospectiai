import { useEffect, useState, useMemo } from 'react';
import { Clock, Loader2, Search, CalendarDays, ChevronRight, ArrowLeft, Star, Phone, Globe, MapPin, FileText, User, BarChart3 } from 'lucide-react';
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

type TabId = 'buscas' | 'lead' | 'intelligence';

const MODULE_LABELS: Record<string, string> = {
  VIABILITY: 'Viabilidade',
  COMPETITORS: 'Concorrência',
  MARKET: 'Mercado',
  MY_COMPANY: 'Análise da minha empresa',
};

function getHistoricoSubtitle(activeTab: TabId, searchTotal: number, intelTotal: number): string {
  if (activeTab === 'buscas' && searchTotal) return `Suas buscas anteriores (${searchTotal} registros).`;
  if (activeTab === 'lead') return 'Relatórios de análise de lead.';
  if (activeTab === 'intelligence' && intelTotal !== 0) return `Relatórios de inteligência (${intelTotal}).`;
  return 'Buscas, relatórios de lead e relatórios de inteligência.';
}

export default function HistoricoPage() {
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
        if (!cancelled) addToast('error', 'Falha ao carregar o histórico.');
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => { cancelled = true; };
  }, [addToast]);

  useEffect(() => {
    if (activeTab !== 'lead') return;
    let cancelled = false;
    setLeadLoading(true);
    leadsApi.list()
      .then((data) => {
        if (!cancelled) setLeadItems(data);
      })
      .catch(() => {
        if (!cancelled) addToast('error', 'Falha ao carregar relatórios de lead.');
      })
      .finally(() => {
        if (!cancelled) setLeadLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab, addToast]);

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
        if (!cancelled) addToast('error', 'Falha ao carregar relatórios de inteligência.');
      })
      .finally(() => {
        if (!cancelled) setIntelLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab, intelModule, intelFavoriteOnly, addToast]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  const setTab = (t: TabId) => {
    setActiveTab(t);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', t);
      if (t !== 'intelligence') next.delete('module');
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
      addToast('error', 'Falha ao carregar os resultados desta busca.');
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
      addToast('error', 'Falha ao carregar o relatório.');
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
      addToast('error', 'Falha ao atualizar favorito.');
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
      addToast('error', 'Falha ao atualizar favorito.');
    }
  };

  if (selectedSearchItem) {
    const places = selectedSearchItem.resultsData ?? [];
    return (
      <>
        <HeaderDashboard
          title={selectedSearchItem.textQuery}
          subtitle={`Resultados da busca em ${formatDate(selectedSearchItem.createdAt)} — ${selectedSearchItem.resultsCount} resultados`}
          breadcrumb="Prospecção Ativa / Histórico / Detalhes"
        />
        <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
          <Button
            variant="ghost"
            onClick={() => setSelectedSearchItem(null)}
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft size={16} /> Voltar ao histórico
          </Button>
          {places.length === 0 ? (
            <div className="rounded-2xl bg-card border border-border p-12 flex flex-col items-center justify-center gap-4 min-h-[240px]">
              <Search size={48} className="text-muted" aria-hidden />
              <h2 className="text-xl font-bold text-foreground">Resultados não disponíveis</h2>
              <p className="text-sm text-muted text-center max-w-md">
                Os resultados desta busca não foram armazenados.
              </p>
              <Button variant="primary" onClick={() => navigate('/dashboard')} className="mt-2">
                Realizar nova busca
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {places.map((place, idx) => {
                const name = place.displayName?.text || '—';
                const address = place.formattedAddress || '';
                const phone = place.nationalPhoneNumber || place.internationalPhoneNumber || '';
                const website = place.websiteUri || '';
                const rating = place.rating;
                const reviews = place.userRatingCount ?? 0;
                return (
                  <div
                    key={place.id || idx}
                    className="bg-card border border-border rounded-2xl p-4 sm:px-6 hover:border-violet-500/30 transition-colors"
                  >
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
                              <Star size={12} className="text-amber-400" /> {rating}/5
                              {reviews > 0 && <span className="text-muted">({reviews})</span>}
                            </span>
                          )}
                          {phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone size={12} /> {phone}
                            </span>
                          )}
                          {website && (
                            <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300">
                              <Globe size={12} /> Website
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  }

  if (selectedIntelItem) {
    const rd = selectedIntelItem.resultsData as Record<string, unknown> | undefined;
    const moduleLabel = MODULE_LABELS[selectedIntelItem.module] || selectedIntelItem.module;
    return (
      <>
        <HeaderDashboard
          title={`Relatório — ${moduleLabel}`}
          subtitle={(() => {
          const cityPart = selectedIntelItem.inputCity ? ` · ${selectedIntelItem.inputCity}` : '';
          return `${selectedIntelItem.inputQuery}${cityPart} — ${formatDate(selectedIntelItem.createdAt)}`;
        })()}
          breadcrumb="Prospecção Ativa / Histórico / Relatório de inteligência"
        />
        <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              onClick={() => setSelectedIntelItem(null)}
              className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
            >
              <ArrowLeft size={16} /> Voltar ao histórico
            </Button>
            <button
              type="button"
              onClick={(e) => handleIntelFavorite(selectedIntelItem, e)}
              className="p-2 rounded-lg border border-border hover:bg-violet-500/10 text-amber-400"
              title={selectedIntelItem?.isFavorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
              aria-label={selectedIntelItem?.isFavorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
            >
              <Star size={18} className={selectedIntelItem?.isFavorite ? 'fill-current' : ''} />
            </button>
          </div>
          <div className="rounded-2xl bg-card border border-border p-6">
            {rd && typeof rd === 'object' && (
              <div className="prose prose-invert max-w-none text-sm">
                {selectedIntelItem.module === 'VIABILITY' && 'score' in rd && (
                  <div className="space-y-2">
                    <p><strong>Score:</strong> {String(rd.score)}/10</p>
                    {'verdict' in rd && <p><strong>Veredito:</strong> {String(rd.verdict)}</p>}
                    {'summary' in rd && <p className="text-muted">{String(rd.summary)}</p>}
                  </div>
                )}
                {selectedIntelItem.module === 'COMPETITORS' && 'totalCount' in rd && (
                  <div className="space-y-2">
                    <p><strong>Concorrentes mapeados:</strong> {String(rd.totalCount)}</p>
                    {'avgRating' in rd && <p><strong>Rating médio:</strong> {String(rd.avgRating)}</p>}
                  </div>
                )}
                {selectedIntelItem.module === 'MARKET' && 'totalBusinesses' in rd && (
                  <div className="space-y-2">
                    <p><strong>Total de negócios:</strong> {String(rd.totalBusinesses)}</p>
                  </div>
                )}
                {selectedIntelItem.module === 'MY_COMPANY' && ('summary' in rd || (typeof rd.socialNetworks === 'object' && rd.socialNetworks && 'presence' in rd.socialNetworks)) && (
                  <div className="space-y-2">
                    {'summary' in rd && <p className="text-muted">{String(rd.summary)}</p>}
                    {typeof rd.socialNetworks === 'object' && rd.socialNetworks && 'presence' in rd.socialNetworks && (
                      <p className="text-muted"><strong>Redes sociais:</strong> {String((rd.socialNetworks as Record<string, unknown>).presence ?? '')}</p>
                    )}
                  </div>
                )}
                {(!('score' in rd && selectedIntelItem.module === 'VIABILITY') && !('totalCount' in rd && selectedIntelItem.module === 'COMPETITORS') && !('totalBusinesses' in rd && selectedIntelItem.module === 'MARKET') && !(selectedIntelItem.module === 'MY_COMPANY' && 'summary' in rd)) && (
                  <p className="text-muted">Relatório salvo em {formatDate(selectedIntelItem.createdAt)}. Dados completos disponíveis na geração do relatório.</p>
                )}
              </div>
            )}
            {(!rd || typeof rd !== 'object') && (
              <p className="text-muted">Relatório salvo em {formatDate(selectedIntelItem.createdAt)}.</p>
            )}
          </div>
        </div>
      </>
    );
  }

  const tabs = [
    { id: 'buscas' as const, label: 'Buscas', icon: Search },
    { id: 'lead' as const, label: 'Relatórios de lead', icon: User },
    { id: 'intelligence' as const, label: 'Relatórios de inteligência', icon: FileText },
  ];

  return (
    <>
      <HeaderDashboard
        title="Histórico"
        subtitle={getHistoricoSubtitle(activeTab, searchTotal, intelTotal)}
        breadcrumb="Prospecção Ativa / Histórico"
      />
      <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
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
              <Loader2 size={24} className="animate-spin text-violet-400" />
              <span className="text-foreground font-medium">Carregando...</span>
            </div>
          </div>
        )}

        {activeTab === 'buscas' && (
          <>
            {searchLoading ? (
              <div className="flex items-center justify-center p-12 text-muted gap-3">
                <Loader2 size={24} className="animate-spin" />
                <span>Carregando histórico...</span>
              </div>
            ) : searchItems.length === 0 ? (
              <div className="rounded-[2.4rem] bg-card border border-border p-12 flex flex-col items-center justify-center gap-4 min-h-[320px]">
                <Clock size={48} className="text-muted" aria-hidden />
                <h2 className="text-xl font-bold text-foreground">Nenhuma busca no histórico</h2>
                <p className="text-sm text-muted text-center max-w-md">Suas buscas aparecerão aqui conforme você usa a plataforma.</p>
                <Button variant="primary" onClick={() => navigate('/dashboard')} className="mt-4">
                  Realizar uma busca
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {searchItems.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSearchItemClick(item)}
                    className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border rounded-2xl p-4 sm:px-6 hover:border-violet-500/30 hover:bg-violet-500/5 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                        <Search size={18} className="text-violet-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{item.textQuery}</p>
                          {idx === 0 && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
                              Mais recente
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted">
                          <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {formatDate(item.createdAt)}</span>
                          <span>{item.resultsCount} resultados</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-muted group-hover:text-violet-400 transition-colors shrink-0 hidden sm:block" />
                  </button>
                ))}
              </div>
            )}
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
                <span className="text-sm text-muted">Só favoritos</span>
              </label>
            </div>
            {leadLoading ? (
              <div className="flex items-center justify-center p-12 text-muted gap-3">
                <Loader2 size={24} className="animate-spin" />
                <span>Carregando relatórios de lead...</span>
              </div>
            ) : leadFiltered.length === 0 ? (
              <div className="rounded-[2.4rem] bg-card border border-border p-12 flex flex-col items-center justify-center gap-4 min-h-[320px]">
                <User size={48} className="text-muted" aria-hidden />
                <h2 className="text-xl font-bold text-foreground">
                  {leadFavoriteOnly ? 'Nenhum relatório de lead favorito' : 'Nenhum relatório de lead'}
                </h2>
                <p className="text-sm text-muted text-center max-w-md">
                  {leadFavoriteOnly ? 'Marque leads como favoritos na listagem para filtrar aqui.' : 'Os relatórios de análise de lead aparecerão aqui.'}
                </p>
                {leadFavoriteOnly && (
                  <Button variant="secondary" onClick={() => setLeadFavoriteOnly(false)}>Ver todos</Button>
                )}
              </div>
            ) : (
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
                          <User size={18} className="text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{leadData?.name ?? '—'}</p>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted">
                            <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {formatDate(item.createdAt)}</span>
                            {item.score != null && <span>Score: {item.score}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleLeadFavorite(item, e)}
                          className="p-2 rounded-lg border border-border hover:bg-violet-500/10 text-amber-400"
                          title={item.isFavorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
                          aria-label={item.isFavorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
                        >
                          <Star size={18} className={item.isFavorite ? 'fill-current' : ''} />
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-violet-400 hover:text-violet-300"
                          onClick={() => placeId && navigate(`/dashboard/lead/${placeId}`)}
                        >
                          Abrir relatório
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                <option value="">Todos os módulos</option>
                <option value="VIABILITY">Viabilidade</option>
                <option value="COMPETITORS">Concorrência</option>
                <option value="MARKET">Mercado</option>
                <option value="MY_COMPANY">Análise da minha empresa</option>
              </select>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={intelFavoriteOnly}
                  onChange={(e) => setIntelFavoriteOnly(e.target.checked)}
                  className="rounded border-border bg-surface text-violet-500 focus:ring-violet-500/50"
                />
                <span className="text-sm text-muted">Só favoritos</span>
              </label>
            </div>
            {intelLoading ? (
              <div className="flex items-center justify-center p-12 text-muted gap-3">
                <Loader2 size={24} className="animate-spin" />
                <span>Carregando relatórios de inteligência...</span>
              </div>
            ) : intelItems.length === 0 ? (
              <div className="rounded-[2.4rem] bg-card border border-border p-12 flex flex-col items-center justify-center gap-4 min-h-[320px]">
                <BarChart3 size={48} className="text-muted" aria-hidden />
                <h2 className="text-xl font-bold text-foreground">
                  {intelFavoriteOnly ? 'Nenhum relatório de inteligência favorito' : 'Nenhum relatório de inteligência'}
                </h2>
                <p className="text-sm text-muted text-center max-w-md">
                  Gere relatórios em Viabilidade, Concorrência ou Mercado para ver o histórico aqui.
                </p>
                {intelFavoriteOnly && (
                  <Button variant="secondary" onClick={() => setIntelFavoriteOnly(false)}>Ver todos</Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {intelItems.map((item) => (
                  <div
                    key={item.id}
                    className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border rounded-2xl p-4 sm:px-6 hover:border-violet-500/30 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                        <FileText size={18} className="text-violet-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {item.inputQuery}{item.inputCity ? ` · ${item.inputCity}` : ''}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted">
                          <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {formatDate(item.createdAt)}</span>
                          <span>{MODULE_LABELS[item.module] || item.module}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleIntelFavorite(item, e)}
                        className="p-2 rounded-lg border border-border hover:bg-violet-500/10 text-amber-400"
                        title={item.isFavorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
                        aria-label={item.isFavorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
                      >
                        <Star size={18} className={item.isFavorite ? 'fill-current' : ''} />
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-violet-400 hover:text-violet-300"
                        onClick={() => handleIntelItemClick(item)}
                      >
                        Abrir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
