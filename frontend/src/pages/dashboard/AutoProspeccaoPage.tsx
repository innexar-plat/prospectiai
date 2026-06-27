import { useState, useEffect } from 'react';
import { Bot, TrendingUp, Target, Mail, Zap, Play, Settings, Clock, AlertCircle, Loader2, FlaskConical, CheckCircle2 } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useNavigate } from 'react-router-dom';
import type { AutoProspStats } from '@/lib/api';
import { autoProspApi } from '@/lib/api';
import { StatCard, EmptyState } from '@/components/dashboard/shared/DashboardUI';
import { useI18n } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/locale';

const DATE_LOCALE: Record<SupportedLocale, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

export default function AutoProspeccaoPage() {
    const { t, locale } = useI18n();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<AutoProspStats | null>(null);
    const [error, setError] = useState('');
    const [triggering, setTriggering] = useState(false);
    const [triggerMsg, setTriggerMsg] = useState('');
    const [dryRunLoading, setDryRunLoading] = useState(false);
    const [dryRunResult, setDryRunResult] = useState<{
        totalWouldFind: number;
        profiles: Array<{ profileId: string; profileName: string; wouldFind: number; dedupSkip: number }>;
    } | null>(null);
    const [dryRunError, setDryRunError] = useState('');

    const dateLocale = DATE_LOCALE[locale];

    useEffect(() => {
        autoProspApi.getStats()
            .then((res) => setStats(res.data))
            .catch((err) => setError(err instanceof Error ? err.message : t('page.autoProspeccao.loadError')))
            .finally(() => setLoading(false));
    }, [t]);

    async function handleTrigger() {
        setTriggering(true);
        setTriggerMsg('');
        try {
            const res = await autoProspApi.trigger();
            setTriggerMsg(t('page.autoProspeccao.triggerStarted', { runId: res.data.runId }));
        } catch (e) {
            setTriggerMsg(e instanceof Error ? e.message : t('page.autoProspeccao.triggerError'));
        } finally {
            setTriggering(false);
        }
    }

    async function handleDryRun() {
        setDryRunLoading(true);
        setDryRunResult(null);
        setDryRunError('');
        try {
            const res = await autoProspApi.triggerDryRun();
            setDryRunResult(res.data);
        } catch (e) {
            setDryRunError(e instanceof Error ? e.message : t('page.autoProspeccao.dryRunErrorMsg'));
        } finally {
            setDryRunLoading(false);
        }
    }

    const headerProps = {
        title: t('page.autoProspeccao.title'),
        subtitle: t('page.autoProspeccao.subtitle'),
        breadcrumb: t('page.autoProspeccao.breadcrumb'),
    };

    if (loading) {
        return (
            <>
                <HeaderDashboard {...headerProps} />
                <div className="p-6 sm:p-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <HeaderDashboard {...headerProps} />
                <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
                    <EmptyState
                        icon={AlertCircle}
                        title={t('page.autoProspeccao.unavailable')}
                        description={error.includes('403') || error.includes('habilitado')
                            ? t('page.autoProspeccao.unavailableDesc')
                            : error}
                    />
                </div>
            </>
        );
    }

    const quickLinks = [
        { label: t('page.autoProspeccao.link.leads'), to: '/dashboard/auto-prospeccao/leads', icon: Target },
        { label: t('page.autoProspeccao.link.profiles'), to: '/dashboard/auto-prospeccao/perfis', icon: Bot },
        { label: t('page.autoProspeccao.link.history'), to: '/dashboard/auto-prospeccao/historico', icon: Clock },
        { label: t('page.autoProspeccao.link.config'), to: '/dashboard/auto-prospeccao/configuracoes', icon: Settings },
    ] as const;

    return (
        <>
            <HeaderDashboard
                title={t('page.autoProspeccao.title')}
                subtitle={stats?.isActive ? t('page.autoProspeccao.subtitleActive') : t('page.autoProspeccao.subtitleInactive')}
                breadcrumb={t('page.autoProspeccao.breadcrumb')}
            />
            <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">

                <div className="flex items-center gap-3 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${stats?.isActive ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${stats?.isActive ? 'bg-green-400' : 'bg-muted-foreground'}`} />
                        {stats?.isActive ? t('page.autoProspeccao.statusActive') : t('page.autoProspeccao.statusInactive')}
                    </span>

                    <button
                        onClick={handleTrigger}
                        disabled={triggering}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60"
                    >
                        {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        {t('page.autoProspeccao.runNow')}
                    </button>

                    <button
                        onClick={handleDryRun}
                        disabled={dryRunLoading}
                        title={t('page.autoProspeccao.dryRunTooltip')}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border border-amber-500/40 text-amber-400 text-sm font-medium hover:bg-amber-500/10 transition disabled:opacity-60"
                    >
                        {dryRunLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                        {t('page.autoProspeccao.dryRun')}
                    </button>

                    <button
                        onClick={() => navigate('/dashboard/auto-prospeccao/configuracoes')}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted/60 transition"
                    >
                        <Settings className="w-4 h-4" />
                        {t('page.autoProspeccao.settings')}
                    </button>

                    {triggerMsg && (
                        <span className="text-xs text-muted-foreground">{triggerMsg}</span>
                    )}
                </div>

                {(dryRunResult || dryRunError) && (
                    <div className={`rounded-xl border p-5 space-y-3 ${dryRunError ? 'border-destructive/40 bg-destructive/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            {dryRunError
                                ? <AlertCircle className="w-4 h-4 text-destructive" />
                                : <FlaskConical className="w-4 h-4 text-amber-400" />}
                            {dryRunError
                                ? t('page.autoProspeccao.dryRunErrorTitle')
                                : t('page.autoProspeccao.dryRunResult', { count: dryRunResult!.totalWouldFind })}
                            <button
                                onClick={() => { setDryRunResult(null); setDryRunError(''); }}
                                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                            >
                                {t('common.close')}
                            </button>
                        </div>

                        {dryRunError && (
                            <p className="text-xs text-destructive">{dryRunError}</p>
                        )}

                        {dryRunResult && (
                            <div className="space-y-2">
                                {dryRunResult.profiles.map((p) => (
                                    <div key={p.profileId} className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">{p.profileName}</span>
                                        <span className="flex items-center gap-3">
                                            <span className="text-amber-400 font-mono">{t('page.autoProspeccao.dryRunNew', { count: p.wouldFind })}</span>
                                            {p.dedupSkip > 0 && (
                                                <span className="text-muted-foreground font-mono">{t('page.autoProspeccao.dryRunExisting', { count: p.dedupSkip })}</span>
                                            )}
                                        </span>
                                    </div>
                                ))}
                                <div className="pt-2 border-t border-amber-500/20 flex items-center gap-2 text-xs text-amber-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {t('page.autoProspeccao.dryRunFooter')}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard value={stats?.totalLeads ?? 0} label={t('page.autoProspeccao.stat.totalLeads')} color="text-blue-400" icon={Bot} />
                    <StatCard value={stats?.leadsHot ?? 0} label={t('page.autoProspeccao.stat.hot')} color="text-red-400" icon={Zap} />
                    <StatCard value={stats?.leadsWarm ?? 0} label={t('page.autoProspeccao.stat.warm')} color="text-orange-400" icon={TrendingUp} />
                    <StatCard value={stats?.crmPushed ?? 0} label={t('page.autoProspeccao.stat.crmPushed')} color="text-green-400" icon={Target} />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard value={stats?.emailsSent ?? 0} label={t('page.autoProspeccao.stat.emailsSent')} color="text-purple-400" icon={Mail} />
                    <StatCard value={stats?.leadsConverted ?? 0} label={t('page.autoProspeccao.stat.converted')} color="text-emerald-400" icon={Target} />
                    <StatCard value={stats?.runsLast7d ?? 0} label={t('page.autoProspeccao.stat.runs7d')} color="text-sky-400" icon={Clock} />
                    <StatCard value={stats?.leadsCold ?? 0} label={t('page.autoProspeccao.stat.discarded')} color="text-muted-foreground" icon={AlertCircle} />
                </div>

                <div className="rounded-xl border border-border bg-card p-5 space-y-2">
                    <div className="text-sm font-medium">{t('page.autoProspeccao.schedule.title')}</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-muted-foreground mb-0.5">{t('page.autoProspeccao.schedule.lastRun')}</div>
                            <div className="font-mono text-xs">
                                {stats?.lastRunAt ? new Date(stats.lastRunAt).toLocaleString(dateLocale) : '—'}
                            </div>
                        </div>
                        <div>
                            <div className="text-muted-foreground mb-0.5">{t('page.autoProspeccao.schedule.nextRun')}</div>
                            <div className="font-mono text-xs">
                                {stats?.nextRunAt ? new Date(stats.nextRunAt).toLocaleString(dateLocale) : t('page.autoProspeccao.schedule.nextRunAuto')}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {quickLinks.map(({ label, to, icon: Icon }) => (
                        <button
                            key={to}
                            onClick={() => navigate(to)}
                            className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition text-left"
                        >
                            <Icon className="w-5 h-5 text-primary flex-shrink-0" />
                            <span className="text-sm font-medium">{label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}
