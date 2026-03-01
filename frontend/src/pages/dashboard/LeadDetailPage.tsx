import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, ExternalLink, Phone, MapPin, Globe, Tag, Plus, X, MessageCircle, Copy, Check, Star } from 'lucide-react';
import type { Place, PlaceDetail, Analysis, LeadTagItem, LeadAnalysisListItem } from '@/lib/api';
import { searchApi, activityApi, tagsApi, leadsApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useToast } from '@/contexts/ToastContext';

/** Rótulo amigável do provedor de IA (não expõe Cloudflare ao usuário). */
function getAnalysisProviderLabel(provider: string | undefined): string | undefined {
  if (!provider) return undefined;
  if (provider === 'CLOUDFLARE') return 'Análise inteligente';
  return provider;
}

const TAG_COLORS: Record<string, string> = {
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  red: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  violet: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  gray: 'bg-surface text-muted border-border',
};

function LeadContactActions({
  place,
  copiedPhone,
  onCopyPhone,
  trackAction,
}: {
  place: PlaceDetail | Place;
  copiedPhone: boolean;
  onCopyPhone: () => void;
  trackAction: (action: string) => void;
}) {
  const phoneRaw = place.nationalPhoneNumber || place.internationalPhoneNumber || '';
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  const whatsappNumber = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
  const hasPhone = !!phoneDigits;
  const websiteUrl = place.websiteUri ?? (place as PlaceDetail).website;
  const hasWebsite = !!websiteUrl;
  const hasAddress = !!(place.formattedAddress);
  if (!hasPhone && !hasWebsite && !hasAddress) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
        <Phone size={14} className="text-violet-400" /> Ações de Contato
      </h2>
      <div className="flex flex-wrap gap-2">
        {hasPhone && (
          <>
            <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" onClick={() => trackAction('WHATSAPP_CLICK')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-lg shadow-emerald-600/25">
              <MessageCircle size={18} /> WhatsApp
            </a>
            <a href={`tel:${place.internationalPhoneNumber ?? place.nationalPhoneNumber}`} onClick={() => trackAction('CALL_CLICK')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-600/25">
              <Phone size={16} /> Ligar
            </a>
            <button type="button" onClick={onCopyPhone} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-surface border border-border text-foreground hover:bg-violet-500/10 transition-colors">
              {copiedPhone ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              {copiedPhone ? 'Copiado!' : 'Copiar Nº'}
            </button>
          </>
        )}
        {hasWebsite && websiteUrl && (
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackAction('WEBSITE_CLICK')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white transition-colors shadow-lg shadow-violet-600/25">
            <Globe size={16} /> Abrir Site
          </a>
        )}
        {hasAddress && (
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.formattedAddress ?? '')}`} target="_blank" rel="noopener noreferrer" onClick={() => trackAction('MAPS_CLICK')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-surface border border-border text-foreground hover:bg-violet-500/10 transition-colors">
            <MapPin size={16} /> Ver no Mapa
          </a>
        )}
      </div>
    </section>
  );
}

export default function LeadDetailPage() {
  const { placeId } = useParams<{ placeId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  const placeFromState = (location.state as { place?: Place } | null)?.place;
  const [place, setPlace] = useState<PlaceDetail | Place | null>(placeFromState ?? null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(!placeFromState && !!placeId);
  const [analyzing, setAnalyzing] = useState(false);
  const [tags, setTags] = useState<LeadTagItem[]>([]);
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [leadAnalysisItem, setLeadAnalysisItem] = useState<LeadAnalysisListItem | null>(null);
  const [togglingFavorite, setTogglingFavorite] = useState(false);

  // Load saved lead (analysis) for this place to show favorite state
  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    leadsApi.list().then((list) => {
      if (!cancelled) {
        const found = list.find((a) => a.lead?.placeId === placeId);
        setLeadAnalysisItem(found ?? null);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [placeId]);

  // After analyzing, refetch to get the new analysis id and favorite state
  useEffect(() => {
    if (!placeId || !analysis) return;
    let cancelled = false;
    leadsApi.list().then((list) => {
      if (!cancelled) {
        const found = list.find((a) => a.lead?.placeId === placeId);
        setLeadAnalysisItem((prev) => found ?? prev);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [placeId, analysis]);

  const handleToggleFavorite = async () => {
    if (!leadAnalysisItem || togglingFavorite) return;
    const next = !leadAnalysisItem.isFavorite;
    const prevFavorite = leadAnalysisItem.isFavorite;
    setTogglingFavorite(true);
    setLeadAnalysisItem((prev) => (prev ? { ...prev, isFavorite: next } : null));
    try {
      const updated = await leadsApi.toggleFavorite(leadAnalysisItem.id, next);
      const newFavorite = Boolean(updated?.isFavorite ?? next);
      setLeadAnalysisItem((prev) => (prev?.id === updated?.id ? { ...prev, isFavorite: newFavorite } : prev));
      addToast('success', newFavorite ? 'Lead adicionado aos favoritos.' : 'Lead removido dos favoritos.');
    } catch {
      setLeadAnalysisItem((prev) => (prev ? { ...prev, isFavorite: prevFavorite } : null));
      addToast('error', 'Falha ao atualizar favorito.');
    } finally {
      setTogglingFavorite(false);
    }
  };

  // Load tags for this lead
  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    tagsApi.list(placeId).then((data) => {
      if (!cancelled) setTags(data.tags);
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [placeId]);

  const trackAction = (action: string) => {
    activityApi.track({ action, metadata: { placeId, leadName: place?.displayName?.text || placeId } }).catch(() => { });
  };

  const handleCopyPhone = () => {
    const phoneRaw = place?.nationalPhoneNumber || place?.internationalPhoneNumber || '';
    if (!phoneRaw) return;
    navigator.clipboard.writeText(phoneRaw).then(() => {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    });
    trackAction('COPY_PHONE');
  };

  const handleAddTag = async (label: string, color: string) => {
    if (!placeId || !label.trim()) return;
    try {
      const { tag } = await tagsApi.add({ leadId: placeId, label: label.trim(), color });
      setTags((prev) => [...prev.filter((t) => t.label !== tag.label), tag]);
      setNewTag('');
      setShowTagInput(false);
    } catch { /* */ }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await tagsApi.remove(tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch { /* */ }
  };

  useEffect(() => {
    if (placeFromState?.id && placeFromState.id === placeId) {
      setPlace(placeFromState);
      return;
    }
    if (!placeId) {
      navigate('/dashboard/resultados', { replace: true });
      return;
    }
    let cancelled = false;
    setLoadingDetails(true);
    searchApi
      .details(placeId)
      .then((detail) => {
        if (!cancelled) setPlace(detail);
      })
      .catch(() => {
        if (!cancelled) {
          addToast('error', 'Não foi possível carregar os detalhes do lead.');
          setPlace(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [placeId, placeFromState, navigate, addToast]);

  const handleAnalyze = async () => {
    if (!place?.id) return;
    const name = place.displayName?.text ?? place.id;
    setAnalyzing(true);
    try {
      const result = await searchApi.analyze({
        placeId: place.id,
        name,
        locale: 'pt-BR',
        websiteUri: place.websiteUri ?? undefined,
        website: place.website ?? undefined,
        formattedAddress: place.formattedAddress ?? undefined,
        nationalPhoneNumber: place.nationalPhoneNumber ?? undefined,
        internationalPhoneNumber: place.internationalPhoneNumber ?? undefined,
        rating: place.rating ?? undefined,
        userRatingCount: place.userRatingCount ?? undefined,
        types: place.types ?? undefined,
        primaryType: place.primaryType ?? undefined,
        businessStatus: place.businessStatus ?? undefined,
        reviews: place.reviews ?? undefined,
      });
      setAnalysis(result);
      window.dispatchEvent(new Event('refresh-user'));
      addToast('success', result.aiProvider ? `Análise concluída (${getAnalysisProviderLabel(result.aiProvider)}).` : 'Análise concluída.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao analisar';
      addToast('error', msg);
    } finally {
      setAnalyzing(false);
    }
  };

  if (!placeId) return null;

  if (loadingDetails && !place) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 text-muted">
          <Loader2 size={24} className="animate-spin" />
          <span>Carregando detalhes do lead...</span>
        </div>
      </div>
    );
  }

  if (!place) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-muted mb-4">Lead não encontrado.</p>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Voltar aos resultados
        </Button>
      </div>
    );
  }

  const name = place.displayName?.text ?? place.id;

  return (
    <>
      <HeaderDashboard
        title={name}
        subtitle="Detalhes e análise com IA"
        breadcrumb="Prospecção Ativa / Resultados / Lead"
      />
      <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted hover:text-foreground -ml-2"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate(-1)}
          >
            Voltar aos resultados
          </Button>
          {leadAnalysisItem && (
            <button
              type="button"
              onClick={handleToggleFavorite}
              disabled={togglingFavorite}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-surface border border-border text-foreground hover:bg-violet-500/10 hover:border-violet-500/30 transition-colors disabled:opacity-50"
              title={leadAnalysisItem.isFavorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
              aria-label={leadAnalysisItem.isFavorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
            >
              {togglingFavorite ? (
                <Loader2 size={18} className="animate-spin shrink-0" />
              ) : (
                <Star size={18} className={leadAnalysisItem.isFavorite ? 'fill-amber-400 text-amber-400' : 'shrink-0'} />
              )}
              {leadAnalysisItem.isFavorite ? 'Favorito' : 'Favoritar'}
            </button>
          )}
        </div>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Informações do lead</h2>
          <div className="grid gap-3 text-sm">
            {place.formattedAddress && (
              <div className="flex items-start gap-2 text-muted">
                <MapPin size={16} className="shrink-0 mt-0.5" />
                <span>{place.formattedAddress}</span>
              </div>
            )}
            {(place.nationalPhoneNumber || place.internationalPhoneNumber) && (
              <div className="flex items-center gap-2">
                <Phone size={16} className="shrink-0 text-muted" />
                <a
                  href={`tel:${place.internationalPhoneNumber ?? place.nationalPhoneNumber}`}
                  className="text-violet-500 hover:underline"
                  onClick={() => trackAction('CALL_CLICK')}
                >
                  {place.nationalPhoneNumber ?? place.internationalPhoneNumber}
                </a>
              </div>
            )}
            {place.websiteUri && (
              <div className="flex items-center gap-2">
                <Globe size={16} className="shrink-0 text-muted" />
                <a
                  href={place.websiteUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-500 hover:underline inline-flex items-center gap-1"
                >
                  Abrir site <ExternalLink size={12} />
                </a>
              </div>
            )}
            {(place.rating != null || place.userRatingCount != null) && (
              <p className="text-muted mt-2">
                {place.rating != null && <>Avaliação: {place.rating}</>}
                {place.userRatingCount != null && <> · {place.userRatingCount} avaliações</>}
              </p>
            )}
          </div>
        </section>

        <LeadContactActions place={place} copiedPhone={copiedPhone} onCopyPhone={handleCopyPhone} trackAction={trackAction} />

        {/* Smart Tags */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Tag size={14} className="text-violet-400" /> Tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t.id} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${TAG_COLORS[t.color] || TAG_COLORS.gray}`}>
                {t.label}
                <button type="button" onClick={() => handleRemoveTag(t.id)} className="hover:opacity-70"><X size={12} /></button>
              </span>
            ))}
            {/* Preset Tags */}
            {!tags.find((t) => t.label === 'Quente') && (
              <button type="button" onClick={() => handleAddTag('Quente', 'green')} className="px-3 py-1 rounded-full text-xs font-bold border border-dashed border-emerald-500/30 text-emerald-400/60 hover:bg-emerald-500/10 transition-colors">+ Quente</button>
            )}
            {!tags.find((t) => t.label === 'Morno') && (
              <button type="button" onClick={() => handleAddTag('Morno', 'amber')} className="px-3 py-1 rounded-full text-xs font-bold border border-dashed border-amber-500/30 text-amber-400/60 hover:bg-amber-500/10 transition-colors">+ Morno</button>
            )}
            {!tags.find((t) => t.label === 'Frio') && (
              <button type="button" onClick={() => handleAddTag('Frio', 'blue')} className="px-3 py-1 rounded-full text-xs font-bold border border-dashed border-blue-500/30 text-blue-400/60 hover:bg-blue-500/10 transition-colors">+ Frio</button>
            )}
            {/* Custom Tag */}
            {showTagInput ? (
              <form onSubmit={(e) => { e.preventDefault(); handleAddTag(newTag, 'violet'); }} className="flex items-center gap-1">
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Nova tag..."
                  className="h-7 w-28 px-2 bg-surface border border-border rounded-lg text-xs text-foreground placeholder:text-muted focus:outline-none"
                  autoFocus
                />
                <button type="submit" className="text-violet-400 hover:text-violet-300 text-xs font-bold">OK</button>
                <button type="button" onClick={() => setShowTagInput(false)} className="text-muted hover:text-foreground"><X size={14} /></button>
              </form>
            ) : (
              <button type="button" onClick={() => setShowTagInput(true)} className="px-3 py-1 rounded-full text-xs font-bold border border-dashed border-violet-500/30 text-violet-400/60 hover:bg-violet-500/10 transition-colors inline-flex items-center gap-1">
                <Plus size={12} /> Custom
              </button>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={16} className="text-violet-500" />
            Análise Estratégica
          </h2>

          {!analysis ? (
            <div className="flex flex-col items-start gap-4 pb-2">
              <p className="text-sm text-muted">
                Descubra oportunidades ocultas, pontos fracos da concorrência e receba um relatório completo
                de como abordar este lead de forma imbatível usando nossa Inteligência Artificial Mapeadora.
              </p>
              <Button
                variant="primary"
                onClick={handleAnalyze}
                disabled={analyzing}
                icon={analyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                className="w-full sm:w-auto mt-2 min-h-[52px] px-8 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/25 border-0 transition-all hover:-translate-y-0.5"
              >
                {analyzing ? 'Gerando inteligência avançada...' : 'Mapear Lead com IA'}
              </Button>
            </div>
          ) : (
            (() => {
              const scoreLabel = String(analysis.scoreLabel ?? 'Analítico');
              const summary = String(analysis.summary ?? '');
              const strengths = Array.isArray(analysis.strengths) ? analysis.strengths as string[] : [];
              const gaps = Array.isArray(analysis.gaps) ? analysis.gaps as string[] : [];
              const painPoints = Array.isArray(analysis.painPoints) ? analysis.painPoints as string[] : [];
              const approach = analysis.approach != null ? String(analysis.approach) : '';
              const socialMedia = analysis.socialMedia && typeof analysis.socialMedia === 'object' && !Array.isArray(analysis.socialMedia)
                ? (analysis.socialMedia as Record<string, unknown>)
                : {};
              const suggestedWhatsAppMessage = analysis.suggestedWhatsAppMessage != null ? String(analysis.suggestedWhatsAppMessage) : '';
              const firstContactMessage = analysis.firstContactMessage != null ? String(analysis.firstContactMessage) : '';
              const fullReport = analysis.fullReport != null ? String(analysis.fullReport) : '';
              return (
            <div className="space-y-8 pt-2">
              {/* Score Header */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <div className="w-16 h-16 rounded-full border-4 border-violet-500 flex items-center justify-center shrink-0">
                  <span className="text-2xl font-black text-violet-500">{analysis.score || 0}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-foreground">
                    Chance de Fechamento: <span className="text-violet-400">{scoreLabel}</span>
                  </h3>
                  {analysis.aiProvider && (
                    <p className="text-[10px] text-muted uppercase tracking-wider mt-0.5">IA: {getAnalysisProviderLabel(analysis.aiProvider)}</p>
                  )}
                  <p className="text-xs text-muted mt-1 leading-relaxed">{summary}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {strengths.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> O que eles fazem bem
                    </h3>
                    <ul className="space-y-1.5">
                      {strengths.map((s) => (
                        <li key={`strength-${s.slice(0, 80)}`} className="text-sm text-foreground bg-surface p-2.5 rounded-lg border border-border/50 shadow-sm leading-relaxed">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {gaps.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Lacunas & Fragilidades
                    </h3>
                    <ul className="space-y-1.5">
                      {gaps.map((w) => (
                        <li key={`gap-${w.slice(0, 80)}`} className="text-sm text-foreground bg-surface p-2.5 rounded-lg border border-border/50 shadow-sm leading-relaxed">{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {painPoints.length > 0 && (
                <div className="space-y-2 pb-2">
                  <h3 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Dores Frequentes de Clientes
                  </h3>
                  <div className="flex flex-wrap gap-2 text-sm text-foreground border border-border/50 bg-surface rounded-lg p-4">
                    <ul className="list-disc pl-5 space-y-1.5">
                      {painPoints.map((p) => (
                        <li key={`pain-${p.slice(0, 80)}`} className="leading-relaxed">{p}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Approach and Social */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-border pt-6">
                {approach && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-muted uppercase tracking-widest">Estratégia de Abordagem</h3>
                    <div className="text-sm text-foreground p-4 bg-surface rounded-xl border border-border leading-relaxed border-l-4 border-l-cyan-500">
                      {approach}
                    </div>
                  </div>
                )}
                {Object.keys(socialMedia).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-muted uppercase tracking-widest">Redes Sociais Sugeridas/Encontradas</h3>
                    <div className="flex flex-col gap-2">
                      {Object.entries(socialMedia).map(([platform, link]) => {
                        if (!link || String(link).toLowerCase() === 'não encontrado' || String(link).toLowerCase() === 'not found') return null;
                        return (
                          <a key={platform} href={String(link)} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline text-cyan-400 p-2.5 rounded-lg bg-surface border border-border inline-flex items-center justify-between group">
                            <span className="capitalize">{platform}</span>
                            <ExternalLink size={14} className="opacity-50 group-hover:opacity-100" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Messages Textarea */}
              {(firstContactMessage || suggestedWhatsAppMessage) && (
                <div className="space-y-4 border-t border-border pt-6">
                  <h3 className="text-xs font-bold text-foreground">Scripts Sugeridos</h3>

                  {suggestedWhatsAppMessage && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest">WhatsApp Direct (Conversacional)</p>
                      <div className="bg-surface/50 p-4 rounded-xl border border-border/50">
                        <textarea
                          readOnly
                          className="w-full bg-transparent text-sm text-foreground resize-none border-0 focus:ring-0 p-0"
                          rows={4}
                          defaultValue={suggestedWhatsAppMessage}
                        />
                      </div>
                    </div>
                  )}

                  {firstContactMessage && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Email / LinkedIn Cold First Contact</p>
                      <div className="bg-surface/50 p-4 rounded-xl border border-border/50">
                        <textarea
                          readOnly
                          className="w-full bg-transparent text-sm text-foreground resize-none border-0 focus:ring-0 p-0"
                          rows={6}
                          defaultValue={firstContactMessage}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {fullReport && (
                <div className="space-y-4 border-t border-border pt-6">
                  <h3 className="text-xs font-bold text-foreground">Relatório Completo (IA)</h3>
                  <div className="prose prose-sm prose-invert max-w-none text-muted p-6 bg-surface rounded-xl border border-border shadow-inner font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                    {fullReport}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button variant="secondary" size="sm" onClick={handleAnalyze} disabled={analyzing} icon={<Sparkles size={14} />}>
                  Reanalisar
                </Button>
              </div>
            </div>
              );
            })()
          )}
        </section>
      </div>
    </>
  );
}
