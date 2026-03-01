import { useEffect, useState, useMemo } from 'react';
import { Target, Loader2, ArrowRight, ExternalLink, Download, Star } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { leadsApi, type LeadAnalysisListItem, type SessionUser } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';
import { exportToCSV } from '@/lib/exportService';

function LeadsPageToolbar({
  user,
  leads,
  favoriteOnly,
  onFavoriteOnlyChange,
}: {
  user: SessionUser;
  leads: LeadAnalysisListItem[];
  favoriteOnly: boolean;
  onFavoriteOnlyChange: (value: boolean) => void;
}) {
  const handleExport = () => {
    const flat = leads.map((r) => {
      const ld = r.lead;
      return {
        nome: ld?.name ?? '',
        endereco: ld?.address ?? '',
        telefone: ld?.phone ?? '',
        site: ld?.website ?? '',
        avaliacao: ld?.rating ?? '',
        score: r.score ?? '',
      };
    });
    exportToCSV(flat, `leads-${Date.now()}`);
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={favoriteOnly}
          onChange={(e) => onFavoriteOnlyChange(e.target.checked)}
          className="rounded border-border bg-surface text-violet-500 focus:ring-violet-500/50"
        />
        <span className="text-sm text-muted">Só favoritos</span>
      </label>
      {user.plan !== 'FREE' && (
        <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExport}>
          Exportar CSV
        </Button>
      )}
    </div>
  );
}

function LeadsListContent({
  loading,
  filteredLeads,
  favoriteOnly,
  onShowAll,
  onGoSearch,
  onToggleFavorite,
  onGoDetail,
}: {
  loading: boolean;
  filteredLeads: LeadAnalysisListItem[];
  favoriteOnly: boolean;
  onShowAll: () => void;
  onGoSearch: () => void;
  onToggleFavorite: (item: LeadAnalysisListItem, e: React.MouseEvent) => void;
  onGoDetail: (placeId: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted gap-3">
        <Loader2 size={24} className="animate-spin" />
        <span>Carregando leads salvas...</span>
      </div>
    );
  }
  if (filteredLeads.length === 0) {
    return (
      <div className="rounded-[2.4rem] bg-card border border-border p-12 flex flex-col items-center justify-center gap-4 min-h-[320px]">
        <Target size={48} className="text-muted" aria-hidden />
        <h2 className="text-xl font-bold text-foreground">
          {favoriteOnly ? 'Nenhum lead favorito' : 'Nenhum lead encontrado'}
        </h2>
        <p className="text-sm text-muted text-center max-w-md">
          {favoriteOnly ? 'Marque leads como favoritos para filtrar aqui.' : 'Os leads que você analisar aparecerão aqui para acompanhamento.'}
        </p>
        {favoriteOnly ? (
          <Button variant="secondary" onClick={onShowAll}>Ver todos</Button>
        ) : (
          <Button variant="primary" onClick={onGoSearch} className="mt-4">
            Realizar uma busca
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredLeads.map((record) => {
        const leadData = record.lead;
        return (
          <div key={record.id} className="bg-card w-full p-6 border border-border rounded-3xl shadow-sm hover:border-violet-500/50 transition-colors flex flex-col items-start text-left">
            <div className="flex justify-between items-start w-full mb-4">
              <div className="flex flex-col flex-1 min-w-0">
                <h3 className="text-lg font-bold text-foreground line-clamp-1" title={leadData?.name}>
                  {leadData?.name}
                </h3>
                {leadData?.address && (
                  <p className="text-xs text-muted mt-1 line-clamp-1">{leadData.address}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={(e) => onToggleFavorite(record, e)}
                  className="p-2 rounded-lg border border-border hover:bg-violet-500/10 text-amber-400"
                  title={record.isFavorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
                  aria-label={record.isFavorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
                >
                  <Star size={18} className={record.isFavorite ? 'fill-current' : ''} />
                </button>
                {record.score != null && (
                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full border border-violet-500 bg-violet-500/10">
                    <span className="text-sm font-bold text-violet-400">{record.score}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {leadData?.rating != null && (
                <span className="px-3 py-1 bg-surface border border-border rounded-lg text-xs font-medium text-muted">
                  Estrelas: {leadData.rating}
                </span>
              )}
            </div>
            <div className="mt-auto w-full pt-4 border-t border-border flex items-center justify-between">
              {leadData?.website ? (
                <a href={leadData.website} target="_blank" rel="noreferrer" className="text-muted hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors" onClick={(e) => e.stopPropagation()}>
                  Site <ExternalLink size={12} />
                </a>
              ) : (
                <span className="text-xs text-muted/50">Sem site</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 -mr-2"
                icon={<ArrowRight size={16} />}
                onClick={() => leadData?.placeId && onGoDetail(leadData.placeId)}
              >
                Detalhes
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadAnalysisListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    leadsApi.list()
      .then((data) => {
        if (!cancelled) setLeads(data);
      })
      .catch(() => {
        if (!cancelled) addToast('error', 'Falha ao carregar os leads.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [addToast]);

  const filteredLeads = useMemo(() => {
    if (!favoriteOnly) return leads;
    return leads.filter((r) => r.isFavorite);
  }, [leads, favoriteOnly]);

  const handleToggleFavorite = async (item: LeadAnalysisListItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const next = !item.isFavorite;
      await leadsApi.toggleFavorite(item.id, next);
      setLeads((prev) => prev.map((r) => (r.id === item.id ? { ...r, isFavorite: next } : r)));
    } catch {
      addToast('error', 'Falha ao atualizar favorito.');
    }
  };

  const { user } = useOutletContext<{ user: SessionUser }>();

  return (
    <>
      <HeaderDashboard title="Leads Salvos" subtitle="Leads que você mapeou e analisou com IA." breadcrumb="Prospecção Ativa / Leads Salvos" />
      <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">

        {!loading && leads.length > 0 && (
          <LeadsPageToolbar
            user={user}
            leads={leads}
            favoriteOnly={favoriteOnly}
            onFavoriteOnlyChange={setFavoriteOnly}
          />
        )}

        <LeadsListContent
          loading={loading}
          filteredLeads={filteredLeads}
          favoriteOnly={favoriteOnly}
          onShowAll={() => setFavoriteOnly(false)}
          onGoSearch={() => navigate('/dashboard')}
          onToggleFavorite={handleToggleFavorite}
          onGoDetail={(placeId) => navigate(`/dashboard/lead/${placeId}`)}
        />
      </div>
    </>
  );
}
