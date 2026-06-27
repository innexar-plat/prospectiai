import { useEffect, useState, useMemo, useCallback } from 'react';
import { Target, Loader2, ArrowRight, ExternalLink, Download, Star, Copy, Check, MessageCircle, X } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { leadsApi, type LeadAnalysisListItem, type SessionUser } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';
import { exportToCSV } from '@/lib/exportService';
import { useI18n } from '@/lib/i18n';
import { getActiveMarket } from '@/lib/market';

type LeadStatus = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'LOST';
type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: 'text-muted',
  CONTACTED: 'text-blue-600 dark:text-blue-400',
  CONVERTED: 'text-emerald-600 dark:text-emerald-400',
  LOST: 'text-rose-600 dark:text-rose-400',
};

function getStatusOptions(t: TranslateFn) {
  return ([
    ['NEW', 'common.status.new'],
    ['CONTACTED', 'common.status.contacted'],
    ['CONVERTED', 'common.status.converted'],
    ['LOST', 'common.status.lost'],
  ] as const).map(([value, key]) => ({
    value,
    label: t(key),
    color: STATUS_COLORS[value],
  }));
}

function CopyBtn({ text, t }: { text: string; t: TranslateFn }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      title={t('page.leads.copyWhatsApp')}
      className="p-2 rounded-lg border border-border hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-colors"
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

function LeadsPageToolbar({
  user,
  leads,
  favoriteOnly,
  onFavoriteOnlyChange,
  t,
}: {
  user: SessionUser;
  leads: LeadAnalysisListItem[];
  favoriteOnly: boolean;
  onFavoriteOnlyChange: (value: boolean) => void;
  t: TranslateFn;
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
        <span className="text-sm text-muted">{t('page.leads.favoritesOnly')}</span>
      </label>
      {user.plan !== 'FREE' && (
        <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExport}>
          {t('page.leads.exportCsv')}
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
  onStatusChange,
  t,
  statusOptions,
}: {
  loading: boolean;
  filteredLeads: LeadAnalysisListItem[];
  favoriteOnly: boolean;
  onShowAll: () => void;
  onGoSearch: () => void;
  onToggleFavorite: (item: LeadAnalysisListItem, e: React.MouseEvent) => void;
  onGoDetail: (placeId: string) => void;
  onStatusChange: (item: LeadAnalysisListItem, status: LeadStatus) => void;
  t: TranslateFn;
  statusOptions: ReturnType<typeof getStatusOptions>;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-violet-600 dark:text-violet-400" />
      </div>
    );
  }
  if (filteredLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <Target size={48} className="text-muted/40" />
        <p className="text-muted">
          {favoriteOnly ? t('page.leads.emptyFavorites') : t('page.leads.empty')}
        </p>
        {favoriteOnly ? (
          <Button variant="secondary" onClick={onShowAll}>{t('page.leads.seeAll')}</Button>
        ) : (
          <Button variant="primary" onClick={onGoSearch} className="mt-4">
            {t('page.leads.doSearch')}
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
                  className="p-2 rounded-lg border border-border hover:bg-violet-500/10 text-amber-600 dark:text-amber-400"
                  title={record.isFavorite ? t('common.unfavorite') : t('common.favorite')}
                  aria-label={record.isFavorite ? t('common.unfavorite') : t('common.favorite')}
                >
                  <Star size={18} className={record.isFavorite ? 'fill-current' : ''} />
                </button>
                {record.score != null && (
                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full border border-violet-500 bg-violet-500/10">
                    <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{record.score}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {leadData?.rating != null && (
                <span className="px-3 py-1 bg-surface border border-border rounded-lg text-xs font-medium text-muted">
                  ⭐ {leadData.rating}
                </span>
              )}
              {record.score != null && (
                <span className="px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-lg text-xs font-bold text-violet-600 dark:text-violet-400">
                  {t('page.leads.score', { score: record.score })}
                </span>
              )}
            </div>

            <div className="w-full mb-4">
              <select
                value={record.status ?? 'NEW'}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  onStatusChange(record, e.target.value as LeadStatus);
                }}
                className={`w-full h-8 px-3 rounded-lg border border-border bg-surface text-xs font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                  statusOptions.find((s) => s.value === (record.status ?? 'NEW'))?.color ?? 'text-muted'
                }`}
              >
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="mt-auto w-full pt-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-1">
                {leadData?.website ? (
                  <a href={leadData.website} target="_blank" rel="noreferrer" className="text-muted hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors" onClick={(e) => e.stopPropagation()}>
                    {t('page.leads.site')} <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="text-xs text-muted/50">{t('page.leads.noWebsite')}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {record.suggestedWhatsAppMessage && (
                  <CopyBtn text={record.suggestedWhatsAppMessage} t={t} />
                )}
                {!record.suggestedWhatsAppMessage && leadData?.phone && (
                  <a
                    href={`https://wa.me/${leadData.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={t('page.leads.openWhatsApp')}
                    className="p-2 rounded-lg border border-border hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-colors"
                  >
                    <MessageCircle size={15} />
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-violet-500/10 -mr-2"
                  icon={<ArrowRight size={16} />}
                  onClick={() => leadData?.placeId && onGoDetail(leadData.placeId)}
                >
                  {t('page.leads.details')}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LeadsPage() {
  const { t } = useI18n();
  const statusOptions = useMemo(() => getStatusOptions(t), [t]);
  const dealValueLabel = getActiveMarket() === 'US'
    ? t('page.leads.modal.dealValue.us')
    : t('page.leads.modal.dealValue.br');

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
        if (!cancelled) addToast('error', t('page.leads.toast.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [addToast, t]);

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
      addToast('error', t('page.leads.toast.favoriteError'));
    }
  };

  const handleStatusChange = async (item: LeadAnalysisListItem, status: LeadStatus) => {
    if (status === 'CONVERTED' || status === 'LOST') {
      setFeedbackModal({ item, status });
      return;
    }
    try {
      await leadsApi.updateStatus(item.id, status);
      setLeads((prev) => prev.map((r) => (r.id === item.id ? { ...r, status } : r)));
    } catch {
      addToast('error', t('page.leads.toast.statusError'));
    }
  };

  const [feedbackModal, setFeedbackModal] = useState<{ item: LeadAnalysisListItem; status: 'CONVERTED' | 'LOST' } | null>(null);
  const [feedbackReason, setFeedbackReason] = useState('');
  const [feedbackDealValue, setFeedbackDealValue] = useState('');
  const [feedbackLostReason, setFeedbackLostReason] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  const submitFeedback = useCallback(async () => {
    if (!feedbackModal) return;
    setFeedbackSaving(true);
    try {
      const extra: { conversionReason?: string; dealValue?: number; lostReason?: string } = {};
      if (feedbackReason.trim()) extra.conversionReason = feedbackReason.trim();
      if (feedbackModal.status === 'CONVERTED' && feedbackDealValue) extra.dealValue = parseFloat(feedbackDealValue);
      if (feedbackModal.status === 'LOST' && feedbackLostReason) extra.lostReason = feedbackLostReason;
      await leadsApi.updateStatus(feedbackModal.item.id, feedbackModal.status, extra);
      setLeads((prev) => prev.map((r) => (r.id === feedbackModal.item.id ? { ...r, status: feedbackModal.status } : r)));
      addToast('success', feedbackModal.status === 'CONVERTED' ? t('page.leads.toast.converted') : t('page.leads.toast.lost'));
      setFeedbackModal(null);
      setFeedbackReason('');
      setFeedbackDealValue('');
      setFeedbackLostReason('');
    } catch {
      addToast('error', t('page.leads.toast.statusError'));
    } finally {
      setFeedbackSaving(false);
    }
  }, [feedbackModal, feedbackReason, feedbackDealValue, feedbackLostReason, addToast, t]);

  const { user } = useOutletContext<{ user: SessionUser }>();

  return (
    <>
      <HeaderDashboard title={t('page.leads.title')} subtitle={t('page.leads.subtitle')} breadcrumb={t('page.leads.breadcrumb')} />
      <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">

        {!loading && leads.length > 0 && (
          <LeadsPageToolbar
            user={user}
            leads={leads}
            favoriteOnly={favoriteOnly}
            onFavoriteOnlyChange={setFavoriteOnly}
            t={t}
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
          onStatusChange={handleStatusChange}
          t={t}
          statusOptions={statusOptions}
        />
      </div>

      {feedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setFeedbackModal(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">
                {feedbackModal.status === 'CONVERTED' ? t('page.leads.modal.convertedTitle') : t('page.leads.modal.lostTitle')}
              </h3>
              <button type="button" onClick={() => setFeedbackModal(null)} className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-muted">{feedbackModal.item.lead.name}</p>

            {feedbackModal.status === 'CONVERTED' && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{dealValueLabel}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={feedbackDealValue}
                  onChange={(e) => setFeedbackDealValue(e.target.value)}
                  placeholder={t('page.leads.modal.placeholder.dealValue')}
                  className="w-full h-10 bg-surface border border-border rounded-xl px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            )}

            {feedbackModal.status === 'LOST' && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t('page.leads.modal.lostReason')}</label>
                <select
                  value={feedbackLostReason}
                  onChange={(e) => setFeedbackLostReason(e.target.value)}
                  className="w-full h-10 bg-surface border border-border rounded-xl px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                >
                  <option value="">{t('page.leads.modal.select')}</option>
                  <option value="PRICE">{t('page.leads.lostReason.price')}</option>
                  <option value="NO_NEED">{t('page.leads.lostReason.noNeed')}</option>
                  <option value="COMPETITOR">{t('page.leads.lostReason.competitor')}</option>
                  <option value="NO_RESPONSE">{t('page.leads.lostReason.noResponse')}</option>
                  <option value="OTHER">{t('page.leads.lostReason.other')}</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                {feedbackModal.status === 'CONVERTED' ? t('page.leads.modal.whatWorked') : t('page.leads.modal.details')}
              </label>
              <textarea
                value={feedbackReason}
                onChange={(e) => setFeedbackReason(e.target.value)}
                placeholder={feedbackModal.status === 'CONVERTED' ? t('page.leads.modal.placeholder.converted') : t('page.leads.modal.placeholder.lost')}
                rows={3}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
              />
            </div>

            <p className="text-[10px] text-muted/60">{t('page.leads.modal.feedbackHint')}</p>

            <div className="flex gap-3">
              <button type="button" onClick={() => setFeedbackModal(null)} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium text-muted hover:bg-surface transition-colors">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={submitFeedback}
                disabled={feedbackSaving}
                className={`flex-1 h-10 rounded-xl text-sm font-bold text-white transition-colors ${
                  feedbackModal.status === 'CONVERTED'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                } disabled:opacity-50`}
              >
                {feedbackSaving
                  ? t('page.leads.modal.saving')
                  : feedbackModal.status === 'CONVERTED'
                    ? t('page.leads.modal.confirmConversion')
                    : t('page.leads.modal.confirmLoss')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
