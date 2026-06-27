import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Target, Send, Trash2, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { EmptyState } from '@/components/dashboard/shared/DashboardUI';
import type { AutoProspLead } from '@/lib/api';
import { autoProspApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const STATUS_COLORS: Record<string, string> = {
    NEW: 'bg-muted/40 text-muted-foreground',
    ANALYZING: 'bg-sky-500/15 text-sky-400',
    COLD: 'bg-muted/40 text-muted-foreground',
    WARM: 'bg-orange-500/15 text-orange-400',
    HOT: 'bg-red-500/15 text-red-400',
    EMAILING: 'bg-purple-500/15 text-purple-400',
    CRM_SENT: 'bg-green-500/15 text-green-400',
    ENGAGED: 'bg-emerald-500/15 text-emerald-400',
    CONVERTED: 'bg-emerald-600/15 text-emerald-300',
};

const FILTER_STATUSES = ['', 'HOT', 'WARM', 'COLD', 'CRM_SENT', 'EMAILING', 'CONVERTED'] as const;

export default function AutoProspeccaoLeadsPage() {
    const { t } = useI18n();
    const [leads, setLeads] = useState<AutoProspLead[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const statusLabel = (status: string) => t(`page.autoProspeccaoLeads.status.${status}`) || status;

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        try {
            const res = await autoProspApi.listLeads({
                page,
                limit: 20,
                status: statusFilter || undefined,
            });
            setLeads(res.items);
            setTotal(res.total);
            setTotalPages(res.totalPages);
        } catch (e) {
            setError(e instanceof Error ? e.message : t('page.autoProspeccaoLeads.loadError'));
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, t]);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    async function handlePushCrm(id: string) {
        setActionLoading(id + '_crm');
        try {
            await autoProspApi.pushLeadToCrm(id);
            fetchLeads();
        } catch (e) {
            alert(e instanceof Error ? e.message : t('page.autoProspeccaoLeads.pushCrmError'));
        } finally {
            setActionLoading(null);
        }
    }

    async function handleDiscard(id: string) {
        if (!confirm(t('page.autoProspeccaoLeads.discardConfirm'))) return;
        setActionLoading(id + '_discard');
        try {
            await autoProspApi.discardLead(id);
            fetchLeads();
        } catch { /* ignored */ } finally {
            setActionLoading(null);
        }
    }

    return (
        <>
            <HeaderDashboard
                title={t('page.autoProspeccaoLeads.title')}
                subtitle={t('page.autoProspeccaoLeads.subtitle')}
                breadcrumb={t('page.autoProspeccaoLeads.breadcrumb')}
            />
            <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-4">

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Filter className="w-4 h-4" />
                        <span>{t('page.autoProspeccaoLeads.filterByStatus')}</span>
                    </div>
                    {FILTER_STATUSES.map((s) => (
                        <button
                            key={s || 'all'}
                            onClick={() => { setStatusFilter(s); setPage(1); }}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}
                        >
                            {s ? statusLabel(s) : t('common.all')}
                        </button>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground">{t('page.autoProspeccaoLeads.leadsCount', { count: total })}</span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <EmptyState icon={AlertCircle} title={t('common.error')} description={error} />
                ) : leads.length === 0 ? (
                    <EmptyState
                        icon={Target}
                        title={t('page.autoProspeccaoLeads.emptyTitle')}
                        description={t('page.autoProspeccaoLeads.emptyDesc')}
                    />
                ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('page.autoProspeccaoLeads.col.company')}</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('page.autoProspeccaoLeads.col.state')}</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('page.autoProspeccaoLeads.col.score')}</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('page.autoProspeccaoLeads.col.status')}</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('page.autoProspeccaoLeads.col.email')}</th>
                                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('page.autoProspeccaoLeads.col.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leads.map((lead) => (
                                        <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition">
                                            <td className="px-4 py-3">
                                                <div className="font-medium truncate max-w-[200px]">{lead.razaoSocial}</div>
                                                {lead.nomeFantasia && (
                                                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{lead.nomeFantasia}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{lead.uf ?? '—'}</td>
                                            <td className="px-4 py-3">
                                                {lead.score != null ? (
                                                    <span className={`font-bold ${lead.score >= 70 ? 'text-red-400' : lead.score >= 40 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                                                        {lead.score}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status] ?? 'bg-muted/40 text-muted-foreground'}`}>
                                                    {statusLabel(lead.status)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[140px]">
                                                {lead.email ?? '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 justify-end">
                                                    {!lead.crmPushedAt && lead.status !== 'COLD' && (
                                                        <button
                                                            onClick={() => handlePushCrm(lead.id)}
                                                            disabled={actionLoading === lead.id + '_crm'}
                                                            title={t('page.autoProspeccaoLeads.pushCrm')}
                                                            className="p-1.5 rounded hover:bg-muted transition text-muted-foreground hover:text-foreground disabled:opacity-40"
                                                        >
                                                            {actionLoading === lead.id + '_crm' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                        </button>
                                                    )}
                                                    {lead.status !== 'COLD' && lead.status !== 'CONVERTED' && (
                                                        <button
                                                            onClick={() => handleDiscard(lead.id)}
                                                            disabled={actionLoading === lead.id + '_discard'}
                                                            title={t('page.autoProspeccaoLeads.discard')}
                                                            className="p-1.5 rounded hover:bg-red-500/15 transition text-muted-foreground hover:text-red-400 disabled:opacity-40"
                                                        >
                                                            {actionLoading === lead.id + '_discard' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="flex items-center gap-1 px-3 py-1.5 rounded border border-border hover:bg-muted/60 disabled:opacity-40 transition"
                        >
                            <ChevronLeft className="w-4 h-4" /> {t('common.previous')}
                        </button>
                        <span className="text-muted-foreground">{t('common.pageOf', { page, total: totalPages })}</span>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="flex items-center gap-1 px-3 py-1.5 rounded border border-border hover:bg-muted/60 disabled:opacity-40 transition"
                        >
                            {t('common.next')} <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
