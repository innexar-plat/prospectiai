import { useState, useCallback } from 'react';
import { Lock, Loader2, Search, Globe, TrendingUp, BarChart3, Lightbulb, Target, Star, Layers, Phone, MessageSquare } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';
import type { SessionUser, MarketReport } from '@/lib/api';
import { searchApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { StatCard, PresenceBar, EmptyState } from '@/components/dashboard/shared/DashboardUI';
import {
    INTELLIGENCE_CONTENT_CLASS,
    INTELLIGENCE_STAT_GRID_CLASS,
    IntelligenceFormCard,
    IntelligenceErrorBanner,
    IntelligenceLoadingSkeleton,
    IntelligenceSectionCard,
    AiInsightsPanel,
} from '@/components/dashboard/shared/IntelligenceUI';
import { LocationFields, createDefaultLocationValue, type LocationFieldsValue } from '@/components/dashboard/LocationFields';
import { useI18n } from '@/lib/i18n';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

function getSaturationLabel(t: TranslateFn, idx: number): { label: string; color: string; bg: string } {
    if (idx >= 15) return { label: t('page.mercado.saturation.saturated'), color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' };
    if (idx >= 8) return { label: t('page.mercado.saturation.competitive'), color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' };
    return { label: t('page.mercado.saturation.lowCompetition'), color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' };
}

function getScoreBadgeBarClasses(score: number): { badge: string; bar: string } {
    if (score >= 60) return { badge: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' };
    if (score >= 35) return { badge: 'bg-amber-500/20 text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
    return { badge: 'bg-surface text-muted', bar: 'bg-surface' };
}

export default function MercadoPage() {
    const { user } = useOutletContext<{ user: SessionUser }>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { t } = useI18n();

    const [query, setQuery] = useState('');
    const [location, setLocation] = useState<LocationFieldsValue>(() => createDefaultLocationValue());
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<MarketReport | null>(null);
    const [error, setError] = useState('');

    const hasAccess = user.plan === 'BUSINESS' || user.plan === 'SCALE';

    const runAnalyze = useCallback(async () => {
        if (!query.trim()) return;
        setLoading(true);
        setData(null);
        setError('');
        try {
            const result = await searchApi.marketReport({
                textQuery: query.trim(),
                city: location.city || undefined,
                state: location.state !== 'Todos' ? location.state : undefined,
                country: location.country,
                pageSize: 60,
            });
            setData(result);
            window.dispatchEvent(new Event('refresh-user'));
            addToast('success', t('page.mercado.toast.success', { count: result.totalBusinesses }));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t('page.mercado.toast.error');
            setError(message);
            addToast('error', message);
        } finally {
            setLoading(false);
        }
    }, [query, location, addToast, t]);

    const handleAnalyze = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        await runAnalyze();
    };

    if (!hasAccess) {
        return (
            <>
                <HeaderDashboard compact title={t('page.mercado.title')} subtitle={t('page.mercado.subtitleLocked')} breadcrumb={t('page.mercado.breadcrumb')} />
                <div className={INTELLIGENCE_CONTENT_CLASS}>
                    <EmptyState
                        icon={Lock}
                        title={t('page.mercado.lockedTitle')}
                        description={t('page.mercado.lockedDesc')}
                        actionLabel={t('page.mercado.upgrade')}
                        onAction={() => navigate('/dashboard/planos')}
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <HeaderDashboard compact title={t('page.mercado.title')} subtitle={t('page.mercado.subtitle')} breadcrumb={t('page.mercado.breadcrumb')} />
            <div className={INTELLIGENCE_CONTENT_CLASS}>
                <IntelligenceFormCard>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('page.mercado.formTitle')}</h3>
                        <Link to="/dashboard/historico?tab=intelligence&module=MARKET" className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-semibold">
                            {t('page.mercado.viewHistory')}
                        </Link>
                    </div>
                    <form onSubmit={handleAnalyze} className="space-y-4">
                        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('page.mercado.placeholder')} className="h-11 w-full bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50" required />
                        <LocationFields
                            value={location}
                            onChange={(v) => setLocation((prev) => ({ ...prev, ...v }))}
                            disabled={loading}
                            accent="violet"
                            gridClass="grid-cols-1 sm:grid-cols-3"
                        />
                        <Button type="submit" variant="primary" disabled={loading || !query.trim()} icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} className="h-11 px-6 w-full rounded-xl font-bold whitespace-nowrap">
                            {loading ? t('page.mercado.analyzing') : t('page.mercado.generate')}
                        </Button>
                    </form>
                </IntelligenceFormCard>

                {error && !loading && !data && (
                    <IntelligenceErrorBanner message={error} onRetry={runAnalyze} />
                )}

                {loading && <IntelligenceLoadingSkeleton statCount={4} />}

                {data && !loading && (
                    <>
                        <div className={INTELLIGENCE_STAT_GRID_CLASS}>
                            <StatCard compact icon={Layers} label={t('page.mercado.stat.businesses')} value={data.totalBusinesses} color="violet" />
                            <StatCard compact icon={BarChart3} label={t('page.mercado.stat.segments')} value={data.segments.length} color="blue" />
                            <StatCard compact icon={Star} label={t('page.mercado.stat.avgRating')} value={data.avgRating?.toFixed(1) ?? 'N/A'} color="amber" />
                            {(() => {
                                const sat = getSaturationLabel(t, data.saturationIndex);
                                return (
                                    <StatCard
                                        compact
                                        icon={TrendingUp}
                                        label={t('page.mercado.stat.saturation')}
                                        value={data.saturationIndex}
                                        color="emerald"
                                        suffix={` — ${sat.label}`}
                                    />
                                );
                            })()}
                        </div>

                        {data.aiInsights && (
                            <AiInsightsPanel
                                title={t('page.mercado.aiInsights')}
                                summary={data.aiInsights.executiveSummary}
                                summaryLabel={t('page.mercado.executiveSummary')}
                                chips={[
                                    { label: `${(data.aiInsights.marketTrends ?? []).length} ${t('page.mercado.trends').toLowerCase()}`, tone: 'blue' },
                                    { label: `${(data.aiInsights.opportunities ?? []).length} ${t('page.mercado.opportunities').toLowerCase()}`, tone: 'emerald' },
                                    { label: `${(data.aiInsights.recommendations ?? []).length} ${t('page.mercado.recommendations').toLowerCase()}`, tone: 'amber' },
                                ]}
                                tabs={[
                                    { key: 'trends', label: t('page.mercado.trends'), icon: TrendingUp, items: data.aiInsights.marketTrends ?? [], bulletClass: 'text-blue-500' },
                                    { key: 'opportunities', label: t('page.mercado.opportunities'), icon: Target, items: data.aiInsights.opportunities ?? [], bulletClass: 'text-emerald-500' },
                                    { key: 'recommendations', label: t('page.mercado.recommendations'), icon: Lightbulb, items: data.aiInsights.recommendations ?? [], bulletClass: 'text-amber-500' },
                                ]}
                            />
                        )}

                        <IntelligenceSectionCard>
                            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Globe size={14} className="text-violet-600 dark:text-violet-400" /> {t('page.mercado.digitalMaturity')}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <PresenceBar label={t('page.mercado.withWebsite')} count={data.digitalMaturity.withWebsite} total={data.digitalMaturity.total} color="bg-violet-500" />
                                <PresenceBar label={t('page.mercado.withPhone')} count={data.digitalMaturity.withPhone} total={data.digitalMaturity.total} color="bg-blue-500" />
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-surface p-3 text-center border border-border/50">
                                    <p className="text-xl font-black text-violet-600 dark:text-violet-400 tabular-nums">{data.digitalMaturity.withWebsitePercent}%</p>
                                    <p className="text-[10px] text-muted mt-1 font-semibold uppercase tracking-wider">{t('page.mercado.haveWebsite')}</p>
                                </div>
                                <div className="rounded-lg bg-surface p-3 text-center border border-border/50">
                                    <p className="text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums">{data.digitalMaturity.withPhonePercent}%</p>
                                    <p className="text-[10px] text-muted mt-1 font-semibold uppercase tracking-wider">{t('page.mercado.havePhone')}</p>
                                </div>
                            </div>
                        </IntelligenceSectionCard>

                        <IntelligenceSectionCard>
                            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Layers size={14} className="text-violet-600 dark:text-violet-400" /> {t('page.mercado.segmentation')}
                            </h3>
                            <div className="space-y-2">
                                {data.segments.slice(0, 12).map((seg) => (
                                    <div key={seg.type} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2.5 border border-border/50">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-sm font-medium text-foreground truncate">{seg.type.replace(/_/g, ' ')}</span>
                                            {seg.avgRating != null && (
                                                <span className="text-xs text-muted flex items-center gap-1"><Star size={12} className="text-amber-500" /> {seg.avgRating}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="w-20 sm:w-24 h-1.5 bg-background rounded-full overflow-hidden">
                                                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min((seg.count / data.totalBusinesses) * 100, 100)}%` }} />
                                            </div>
                                            <span className="text-xs font-semibold text-muted tabular-nums w-8 text-right">{seg.count}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </IntelligenceSectionCard>

                        {data.topOpportunities.length > 0 && (
                            <IntelligenceSectionCard>
                                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Target size={14} className="text-emerald-600 dark:text-emerald-400" /> {t('page.mercado.topOpportunities')}
                                </h3>
                                <p className="text-xs text-muted mb-4">{t('page.concorrencia.topOpportunitiesDesc')}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-2">
                                    {data.topOpportunities.slice(0, 10).map((opp, i) => {
                                        const scoreClasses = getScoreBadgeBarClasses(opp.score ?? 0);
                                        return (
                                            <div key={opp.id || i} className="p-4 bg-surface rounded-xl border border-border/50 flex flex-col gap-2 hover:border-violet-500/30 transition-colors">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-sm font-bold text-foreground truncate flex-1">{opp.name}</p>
                                                    <span className={`shrink-0 text-xs font-black px-2 py-0.5 rounded-full ${scoreClasses.badge}`}>
                                                        {opp.score ?? '-'}
                                                    </span>
                                                </div>
                                                {opp.score != null && (
                                                    <div className="w-full h-1.5 bg-card rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all duration-500 ${scoreClasses.bar}`} style={{ width: `${opp.score}%` }} />
                                                    </div>
                                                )}
                                                {opp.formattedAddress && (
                                                    <p className="text-xs text-muted truncate">{opp.formattedAddress}</p>
                                                )}
                                                <div className="flex flex-wrap gap-1.5">
                                                    {opp.scoreFactors?.noWebsite && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full"><Globe size={9} />{t('page.concorrencia.badge.noWebsite')}</span>}
                                                    {opp.scoreFactors?.noPhone && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full"><Phone size={9} />{t('page.concorrencia.badge.noPhone')}</span>}
                                                    {opp.scoreFactors?.fewReviews && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full"><MessageSquare size={9} />{t('page.concorrencia.badge.fewReviews')}</span>}
                                                    {opp.scoreFactors?.lowRating && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full"><Star size={9} />{t('page.concorrencia.badge.lowRating')}</span>}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted">
                                                    {opp.rating != null && (
                                                        <span className="flex items-center gap-1"><Star size={10} className="text-amber-500" /> {opp.rating}</span>
                                                    )}
                                                    {opp.reviewCount != null && (
                                                        <span>{opp.reviewCount} {t('page.concorrencia.csv.reviews').toLowerCase()}</span>
                                                    )}
                                                    {opp.phone && <span className="flex items-center gap-1"><Phone size={10} />{opp.phone}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </IntelligenceSectionCard>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
