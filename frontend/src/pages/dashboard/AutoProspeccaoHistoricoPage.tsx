import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { EmptyState } from '@/components/dashboard/shared/DashboardUI';
import type { AutoProspRun } from '@/lib/api';
import { autoProspApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/locale';

const DATE_LOCALE: Record<SupportedLocale, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

const STATUS_ICONS: Record<string, React.ReactNode> = {
    RUNNING: <Loader2 className="w-4 h-4 animate-spin text-sky-400" />,
    COMPLETED: <CheckCircle className="w-4 h-4 text-green-400" />,
    FAILED: <XCircle className="w-4 h-4 text-red-400" />,
    PARTIAL: <AlertCircle className="w-4 h-4 text-orange-400" />,
};

export default function AutoProspeccaoHistoricoPage() {
    const { t, locale } = useI18n();
    const dateLocale = DATE_LOCALE[locale];
    const [runs, setRuns] = useState<AutoProspRun[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchRuns = useCallback(async () => {
        setLoading(true);
        try {
            const res = await autoProspApi.listRuns(page, 20);
            setRuns(res.items);
            setTotal(res.total);
            setTotalPages(res.totalPages);
        } catch (e) {
            setError(e instanceof Error ? e.message : t('page.autoProspeccaoHistorico.loadError'));
        } finally {
            setLoading(false);
        }
    }, [page, t]);

    useEffect(() => { fetchRuns(); }, [fetchRuns]);

    const triggerLabel = (triggeredBy: string) => {
        if (triggeredBy === 'cron') return t('page.autoProspeccaoHistorico.trigger.cron');
        if (triggeredBy === 'manual') return t('page.autoProspeccaoHistorico.trigger.manual');
        return t('page.autoProspeccaoHistorico.trigger.manualUser');
    };

    const metrics = [
        { labelKey: 'page.autoProspeccaoHistorico.metric.found', getValue: (run: AutoProspRun) => run.leadsFound },
        { labelKey: 'page.autoProspeccaoHistorico.metric.analyzed', getValue: (run: AutoProspRun) => run.leadsAnalyzed },
        { labelKey: 'page.autoProspeccaoHistorico.metric.hot', getValue: (run: AutoProspRun) => run.leadsHot },
        { labelKey: 'page.autoProspeccaoHistorico.metric.emails', getValue: (run: AutoProspRun) => run.emailsQueued },
        { labelKey: 'page.autoProspeccaoHistorico.metric.crm', getValue: (run: AutoProspRun) => run.crmPushed },
    ] as const;

    return (
        <>
            <HeaderDashboard
                title={t('page.autoProspeccaoHistorico.title')}
                subtitle={t('page.autoProspeccaoHistorico.subtitle')}
                breadcrumb={t('page.autoProspeccaoHistorico.breadcrumb')}
            />
            <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-4">
                <div className="text-xs text-muted-foreground">{t('page.autoProspeccaoHistorico.totalRuns', { count: total })}</div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <EmptyState icon={AlertCircle} title={t('common.error')} description={error} />
                ) : runs.length === 0 ? (
                    <EmptyState
                        icon={Clock}
                        title={t('page.autoProspeccaoHistorico.emptyTitle')}
                        description={t('page.autoProspeccaoHistorico.emptyDesc')}
                    />
                ) : (
                    <div className="space-y-3">
                        {runs.map((run) => (
                            <div key={run.id} className="rounded-xl border border-border bg-card p-4 hover:bg-muted/20 transition">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        {STATUS_ICONS[run.status] ?? <Clock className="w-4 h-4 text-muted-foreground" />}
                                        <div>
                                            <div className="text-sm font-medium">
                                                {triggerLabel(run.triggeredBy)}
                                                {run.searchProfile && <span className="text-muted-foreground"> — {run.searchProfile.name}</span>}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(run.startedAt).toLocaleString(dateLocale)}
                                                {run.completedAt && ` → ${new Date(run.completedAt).toLocaleString(dateLocale)}`}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        run.status === 'COMPLETED' ? 'bg-green-500/15 text-green-400' :
                                        run.status === 'RUNNING' ? 'bg-sky-500/15 text-sky-400' :
                                        run.status === 'FAILED' ? 'bg-red-500/15 text-red-400' :
                                        'bg-muted/40 text-muted-foreground'
                                    }`}>{run.status}</span>
                                </div>

                                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-1 text-xs">
                                    {metrics.map(({ labelKey, getValue }) => (
                                        <div key={labelKey}>
                                            <span className="text-muted-foreground">{t(labelKey)}: </span>
                                            <span className="font-medium">{getValue(run)}</span>
                                        </div>
                                    ))}
                                </div>

                                {run.errorLog && (
                                    <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded p-2 font-mono">{run.errorLog}</div>
                                )}
                            </div>
                        ))}
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
