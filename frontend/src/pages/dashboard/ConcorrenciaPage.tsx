import { useState, useCallback, useMemo } from 'react';
import { Lock, Loader2, Search, Target, Globe, Star, MessageSquare, Phone, Shield, CheckCircle2, Zap, Download } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';
import type { SessionUser, CompetitorAnalysisResult } from '@/lib/api';
import { competitorApi } from '@/lib/api';
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
import { getActiveMarket } from '@/lib/market';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

function getBarrierConfig(t: TranslateFn, key: 'alto' | 'medio' | 'baixo') {
    const styles = {
        alto: { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', icon: '🛑', tone: 'rose' as const },
        medio: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: '⚡', tone: 'amber' as const },
        baixo: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: '✅', tone: 'emerald' as const },
    };
    return { ...styles[key], label: t(`page.concorrencia.barrier.${key}`) };
}

function getOpportunityScoreClasses(score: number): { badge: string; bar: string } {
    if (score >= 60) return { badge: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' };
    if (score >= 35) return { badge: 'bg-amber-500/20 text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
    return { badge: 'bg-surface text-muted', bar: 'bg-surface' };
}

export default function ConcorrenciaPage() {
    const { user } = useOutletContext<{ user: SessionUser }>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { t, locale } = useI18n();
    const numberLocale = useMemo(() => {
        if (getActiveMarket() === 'US' || locale === 'en') return 'en-US';
        if (locale === 'es') return 'es-ES';
        return 'pt-BR';
    }, [locale]);

    const [query, setQuery] = useState('');
    const [location, setLocation] = useState<LocationFieldsValue>(() => createDefaultLocationValue({ neighborhood: '' }));
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<CompetitorAnalysisResult | null>(null);
    const [error, setError] = useState('');

    const hasAccess = user.plan === 'PRO' || user.plan === 'BUSINESS' || user.plan === 'SCALE';

    const exportCSV = useCallback(() => {
        if (!data) return;
        const rows: string[][] = [[
            t('page.concorrencia.csv.name'),
            t('page.concorrencia.csv.rating'),
            t('page.concorrencia.csv.reviews'),
            t('page.concorrencia.csv.website'),
            t('page.concorrencia.csv.phone'),
            t('page.concorrencia.csv.opportunityScore'),
        ]];
        const seen = new Set<string>();

        for (const opp of data.topOpportunities ?? []) {
            seen.add(opp.id);
            rows.push([
                opp.name,
                '', '',
                opp.scoreFactors.noWebsite ? t('common.no') : t('common.yes'),
                opp.phone || (opp.scoreFactors.noPhone ? t('common.no') : t('common.yes')),
                String(opp.score),
            ]);
        }

        for (const entry of data.rankingByRating) {
            if (seen.has(entry.id)) continue;
            seen.add(entry.id);
            const review = data.rankingByReviews.find((r) => r.id === entry.id);
            rows.push([
                entry.name,
                entry.rating != null ? entry.rating.toFixed(1) : '',
                review?.reviewCount != null ? String(review.reviewCount) : '',
                '', '', '',
            ]);
        }

        for (const entry of data.rankingByReviews) {
            if (seen.has(entry.id)) continue;
            seen.add(entry.id);
            rows.push([entry.name, '', String(entry.reviewCount ?? ''), '', '', '']);
        }

        const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `competitors-${query.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [data, query, t]);

    const runAnalyze = useCallback(async () => {
        if (!query.trim()) return;
        setLoading(true);
        setData(null);
        setError('');
        try {
            const textParts = [query];
            if (location.neighborhood?.trim()) textParts.push(location.neighborhood.trim());
            if (location.city.trim()) textParts.push(location.city.trim());
            if (location.state && location.state !== 'Todos') textParts.push(location.state);
            const result = await competitorApi.analyze({
                textQuery: textParts.join(', '),
                city: location.city || undefined,
                state: location.state !== 'Todos' ? location.state : undefined,
                country: location.country,
                pageSize: 60,
            });
            setData(result);
            window.dispatchEvent(new Event('refresh-user'));
            addToast('success', t('page.concorrencia.toast.success', { count: result.totalCount }));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t('page.concorrencia.toast.error');
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
                <HeaderDashboard compact title={t('page.concorrencia.title')} subtitle={t('page.concorrencia.subtitleLocked')} breadcrumb={t('page.concorrencia.breadcrumb')} />
                <div className={INTELLIGENCE_CONTENT_CLASS}>
                    <EmptyState
                        icon={Lock}
                        title={t('page.concorrencia.lockedTitle')}
                        description={t('page.concorrencia.lockedDesc')}
                        actionLabel={t('page.concorrencia.upgrade')}
                        onAction={() => navigate('/dashboard/configuracoes')}
                    />
                </div>
            </>
        );
    }

    const playbook = data?.aiPlaybook;
    const barrierCfg = playbook ? getBarrierConfig(t, playbook.entryBarrier) : null;

    return (
        <>
            <HeaderDashboard compact title={t('page.concorrencia.title')} subtitle={t('page.concorrencia.subtitle')} breadcrumb={t('page.concorrencia.breadcrumb')} />
            <div className={INTELLIGENCE_CONTENT_CLASS}>
                <IntelligenceFormCard>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('page.concorrencia.analyze')}</h3>
                        <Link to="/dashboard/historico?tab=intelligence&module=COMPETITORS" className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-semibold">
                            {t('page.concorrencia.viewHistory')}
                        </Link>
                    </div>
                    <form onSubmit={handleAnalyze} className="space-y-4">
                        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('page.concorrencia.placeholder')} className="h-11 w-full bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50" required />
                        <LocationFields
                            value={location}
                            onChange={(v) => setLocation((prev) => ({ ...prev, ...v }))}
                            disabled={loading}
                            showNeighborhood
                            accent="violet"
                        />
                        <Button type="submit" variant="primary" disabled={loading || !query.trim()} icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} className="h-11 px-6 w-full rounded-xl font-bold whitespace-nowrap">
                            {loading ? t('page.concorrencia.analyzing') : t('page.concorrencia.submitRegion')}
                        </Button>
                    </form>
                </IntelligenceFormCard>

                {error && !loading && !data && (
                    <IntelligenceErrorBanner message={error} onRetry={runAnalyze} />
                )}

                {loading && <IntelligenceLoadingSkeleton statCount={5} />}

                {data && !loading && (
                    <>
                        <div className={INTELLIGENCE_STAT_GRID_CLASS}>
                            <StatCard compact value={data.totalCount} label={t('page.concorrencia.stat.competitors')} color="violet" />
                            <StatCard compact value={data.avgRating != null ? Number(data.avgRating.toFixed(1)) : 0} label={t('page.concorrencia.stat.avgRating')} color="amber" suffix="★" />
                            <StatCard compact value={data.digitalPresence.withWebsite} label={t('page.concorrencia.stat.withWebsite')} color="emerald" />
                            <StatCard compact value={data.digitalPresence.withPhone} label={t('page.concorrencia.stat.withPhone')} color="blue" />
                            <StatCard compact value={data.topOpportunities?.length ?? 0} label={t('page.concorrencia.stat.topOpportunities')} color="amber" />
                        </div>

                        <div className="flex justify-end">
                            <button type="button" onClick={exportCSV} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors">
                                <Download size={14} /> {t('page.concorrencia.exportCsv')}
                            </button>
                        </div>

                        {playbook && barrierCfg && (
                            <AiInsightsPanel
                                title={t('page.concorrencia.analyze')}
                                summary={[playbook.entryBarrierExplanation, playbook.marketSummary].filter(Boolean).join(' ')}
                                chips={[
                                    { label: `${barrierCfg.icon} ${barrierCfg.label}`, tone: barrierCfg.tone },
                                    { label: `${data.topOpportunities?.length ?? 0} ${t('page.concorrencia.stat.topOpportunities').toLowerCase()}`, tone: 'violet' },
                                ]}
                                tabs={[
                                    { key: 'seo', label: t('page.concorrencia.seoChecklist'), icon: Shield, items: playbook.seoChecklist ?? [], bulletClass: 'text-violet-600 dark:text-violet-400' },
                                    { key: 'reviews', label: t('page.concorrencia.reviewStrategy'), icon: Star, items: playbook.reviewStrategy ?? [], bulletClass: 'text-amber-600 dark:text-amber-400' },
                                    { key: 'wins', label: t('page.concorrencia.quickWins'), icon: Zap, items: playbook.quickWins ?? [], bulletClass: 'text-emerald-600 dark:text-emerald-400' },
                                ]}
                            />
                        )}

                        <IntelligenceSectionCard>
                            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Globe size={14} className="text-violet-600 dark:text-violet-400" /> {t('page.concorrencia.digitalPresence')}
                            </h3>
                            <div className="space-y-3">
                                <PresenceBar label={t('page.concorrencia.presence.withWebsite')} count={data.digitalPresence.withWebsite} total={data.totalCount} color="bg-emerald-500" />
                                <PresenceBar label={t('page.concorrencia.presence.withoutWebsite')} count={data.digitalPresence.withoutWebsite} total={data.totalCount} color="bg-rose-500" />
                                <PresenceBar label={t('page.concorrencia.presence.withPhone')} count={data.digitalPresence.withPhone} total={data.totalCount} color="bg-blue-500" />
                                <PresenceBar label={t('page.concorrencia.presence.withoutPhone')} count={data.digitalPresence.withoutPhone} total={data.totalCount} color="bg-orange-500" />
                            </div>
                        </IntelligenceSectionCard>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <IntelligenceSectionCard>
                                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Star size={14} className="text-amber-600 dark:text-amber-400" /> {t('page.concorrencia.rankingByRating')}
                                </h3>
                                <div className="space-y-2">
                                    {(data.rankingByRating ?? []).map((entry) => (
                                        <div key={entry.id} className="flex items-center gap-3 p-2.5 bg-surface rounded-lg border border-border/50">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${entry.position <= 3 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-surface text-muted'}`}>{entry.position}</div>
                                            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{entry.name}</p></div>
                                            <div className="flex items-center gap-1 text-sm font-bold text-amber-600 dark:text-amber-400"><Star size={14} fill="currentColor" />{entry.rating?.toFixed(1)}</div>
                                        </div>
                                    ))}
                                    {(data.rankingByRating ?? []).length === 0 && <p className="text-sm text-muted text-center py-4">{t('page.concorrencia.noData')}</p>}
                                </div>
                            </IntelligenceSectionCard>
                            <IntelligenceSectionCard>
                                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <MessageSquare size={14} className="text-blue-600 dark:text-blue-400" /> {t('page.concorrencia.rankingByReviews')}
                                </h3>
                                <div className="space-y-2">
                                    {(data.rankingByReviews ?? []).map((entry) => (
                                        <div key={entry.id} className="flex items-center gap-3 p-2.5 bg-surface rounded-lg border border-border/50">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${entry.position <= 3 ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-surface text-muted'}`}>{entry.position}</div>
                                            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{entry.name}</p></div>
                                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">{entry.reviewCount?.toLocaleString(numberLocale)}</span>
                                        </div>
                                    ))}
                                    {(data.rankingByReviews ?? []).length === 0 && <p className="text-sm text-muted text-center py-4">{t('page.concorrencia.noData')}</p>}
                                </div>
                            </IntelligenceSectionCard>
                        </div>

                        {data.topOpportunities && data.topOpportunities.length > 0 && (
                            <IntelligenceSectionCard>
                                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                                    <Target size={14} className="text-amber-600 dark:text-amber-400" /> {t('page.concorrencia.topOpportunitiesTitle')}
                                </h3>
                                <p className="text-xs text-muted mb-3">{t('page.concorrencia.topOpportunitiesDesc')}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-1">
                                    {data.topOpportunities.map((opp) => {
                                        const scoreCls = getOpportunityScoreClasses(opp.score);
                                        return (
                                            <div key={opp.id} className="p-3 bg-surface rounded-lg border border-border/50 flex flex-col gap-2 hover:border-violet-500/30 transition-colors">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-sm font-bold text-foreground truncate flex-1">{opp.name}</p>
                                                    <span className={`shrink-0 text-xs font-black px-2 py-0.5 rounded-full ${scoreCls.badge}`}>{opp.score}</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-card rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all duration-500 ${scoreCls.bar}`} style={{ width: `${opp.score}%` }} />
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {opp.scoreFactors.noWebsite && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full"><Globe size={9} />{t('page.concorrencia.badge.noWebsite')}</span>}
                                                    {opp.scoreFactors.noPhone && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full"><Phone size={9} />{t('page.concorrencia.badge.noPhone')}</span>}
                                                    {opp.scoreFactors.fewReviews && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full"><MessageSquare size={9} />{t('page.concorrencia.badge.fewReviews')}</span>}
                                                    {opp.scoreFactors.lowRating && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full"><Star size={9} />{t('page.concorrencia.badge.lowRating')}</span>}
                                                </div>
                                                {opp.phone && <p className="text-[10px] text-muted flex items-center gap-1"><Phone size={10} />{opp.phone}</p>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </IntelligenceSectionCard>
                        )}

                        {(data.opportunities?.length ?? 0) > 0 && (
                            <IntelligenceSectionCard>
                                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                                    <CheckCircle2 size={14} className="text-amber-600 dark:text-amber-400" /> {t('page.concorrencia.allOpportunitiesTitle')}
                                </h3>
                                <p className="text-xs text-muted mb-3">{t('page.concorrencia.allOpportunitiesDesc')}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
                                    {(data.opportunities ?? []).map((opp) => (
                                        <div key={opp.id} className="p-3 bg-surface rounded-lg border border-border/50 flex flex-col gap-1.5">
                                            <p className="text-sm font-medium text-foreground truncate">{opp.name}</p>
                                            <div className="flex gap-2 flex-wrap">
                                                {opp.missingWebsite && (<span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full"><Globe size={10} /> {t('page.concorrencia.badge.noWebsite')}</span>)}
                                                {opp.missingPhone && (<span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full"><Phone size={10} /> {t('page.concorrencia.badge.noPhoneFull')}</span>)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </IntelligenceSectionCard>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
