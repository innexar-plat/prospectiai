import { useState, useMemo, useCallback } from 'react';
import { TrendingUp, Lock, Loader2, Search, Target, Globe, AlertTriangle, CheckCircle2, MapPin, DollarSign, Lightbulb, ShieldAlert, Phone, Star, Layers, Zap, MessageSquare } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';
import type { SessionUser, ViabilityReport, ViabilityMode } from '@/lib/api';
import { viabilityApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { StatCard, EmptyState } from '@/components/dashboard/shared/DashboardUI';
import {
    INTELLIGENCE_CONTENT_CLASS,
    INTELLIGENCE_STAT_GRID_CLASS,
    IntelligenceFormCard,
    IntelligenceErrorBanner,
    IntelligenceLoadingSkeleton,
    IntelligenceSectionCard,
} from '@/components/dashboard/shared/IntelligenceUI';
import { LocationFields, createDefaultLocationValue, type LocationFieldsValue } from '@/components/dashboard/LocationFields';
import { useI18n } from '@/lib/i18n';
import { getActiveMarket } from '@/lib/market';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

function getVerdictLabel(t: TranslateFn, report: ViabilityReport): string {
    if (report.verdictKey) {
        const key = `page.viabilidade.verdict.${report.verdictKey.toLowerCase()}`;
        const translated = t(key);
        if (translated !== key) return translated;
    }
    return report.verdict;
}

function getSaturationLabel(t: TranslateFn, idx: number): { label: string; color: string } {
    if (idx >= 15) return { label: t('page.viabilidade.saturation.saturated'), color: 'text-rose-600 dark:text-rose-400' };
    if (idx >= 8) return { label: t('page.viabilidade.saturation.competitive'), color: 'text-amber-600 dark:text-amber-400' };
    return { label: t('page.viabilidade.saturation.lowCompetition'), color: 'text-emerald-600 dark:text-emerald-400' };
}

function getGoConfig(t: TranslateFn, key: 'GO' | 'CAUTION' | 'NO_GO') {
    const styles = {
        GO: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30', glow: 'shadow-emerald-500/25' },
        CAUTION: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30', glow: 'shadow-amber-500/25' },
        NO_GO: { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/15 border-rose-500/30', glow: 'shadow-rose-500/25' },
    };
    const labels = { GO: t('page.viabilidade.go.go'), CAUTION: t('page.viabilidade.go.caution'), NO_GO: t('page.viabilidade.go.noGo') };
    return { ...styles[key], label: labels[key] };
}

function getOppLevelConfig(t: TranslateFn, key: 'alta' | 'media' | 'baixa') {
    const styles = {
        alta: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
        media: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
        baixa: { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' },
    };
    return { ...styles[key], label: t(`page.viabilidade.opp.${key}`) };
}

function getScoreColor(s: number) {
    if (s >= 8) return 'text-emerald-600 dark:text-emerald-400';
    if (s >= 6) return 'text-blue-600 dark:text-blue-400';
    if (s >= 4) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
}

function getScoreGradient(s: number) {
    if (s >= 8) return 'from-emerald-500 to-emerald-600';
    if (s >= 6) return 'from-blue-500 to-blue-600';
    if (s >= 4) return 'from-amber-500 to-amber-600';
    return 'from-rose-500 to-rose-600';
}

function getScoreBadgeBarClasses(score: number): { badge: string; bar: string } {
    if (score >= 60) return { badge: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' };
    if (score >= 35) return { badge: 'bg-amber-500/20 text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
    return { badge: 'bg-surface text-muted', bar: 'bg-surface' };
}

export default function ViabilidadePage() {
    const { user } = useOutletContext<{ user: SessionUser }>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { t, locale } = useI18n();

    const [mode, setMode] = useState<ViabilityMode>('new_business');
    const [businessType, setBusinessType] = useState('');
    const [useProfileForExpand, setUseProfileForExpand] = useState(false);
    const [location, setLocation] = useState<LocationFieldsValue>(() => createDefaultLocationValue());
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<ViabilityReport | null>(null);
    const [error, setError] = useState('');

    const numberLocale = useMemo(() => {
        if (getActiveMarket() === 'US' || locale === 'en') return 'en-US';
        if (locale === 'es') return 'es-ES';
        return 'pt-BR';
    }, [locale]);

    const hasAccess = user.plan === 'BUSINESS' || user.plan === 'SCALE';

    const profileBusinessLabel = [user.companyName, user.productService].filter(Boolean).join(' — ') || '';
    const myBusinessProfileEmpty = !(user.companyName?.trim() || user.productService?.trim());

    const useProfileLabel = mode === 'my_business' || (mode === 'expand' && useProfileForExpand);
    const effectiveBusinessType = useProfileLabel ? profileBusinessLabel : businessType;

    const canSubmit =
        location.city.trim().length > 0 &&
        (mode === 'my_business' ? !myBusinessProfileEmpty : effectiveBusinessType.trim().length >= 2);

    const handleAnalyze = useCallback(async (e?: React.SyntheticEvent<HTMLFormElement>) => {
        e?.preventDefault();
        if (!canSubmit) return;
        setLoading(true);
        setReport(null);
        setError('');
        try {
            const payload =
                mode === 'my_business'
                    ? {
                        mode: 'my_business' as const,
                        city: location.city.trim(),
                        state: location.state !== 'Todos' ? location.state : undefined,
                        country: location.country,
                        locale,
                    }
                    : {
                        mode,
                        businessType: effectiveBusinessType.trim(),
                        city: location.city.trim(),
                        state: location.state !== 'Todos' ? location.state : undefined,
                        country: location.country,
                        locale,
                    };
            const result = await viabilityApi.analyze(payload);
            setReport(result);
            window.dispatchEvent(new Event('refresh-user'));
            addToast('success', t('page.viabilidade.toast.success', { score: result.score }));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t('page.viabilidade.toast.error');
            setError(message);
            addToast('error', message);
        } finally {
            setLoading(false);
        }
    }, [canSubmit, mode, location, locale, effectiveBusinessType, addToast, t]);

    if (!hasAccess) {
        return (
            <>
                <HeaderDashboard compact title={t('page.viabilidade.title')} subtitle={t('page.viabilidade.subtitleLocked')} breadcrumb={t('page.viabilidade.breadcrumb')} />
                <div className={INTELLIGENCE_CONTENT_CLASS}>
                    <EmptyState
                        icon={Lock}
                        title={t('page.viabilidade.lockedTitle')}
                        description={t('page.viabilidade.lockedDesc')}
                        actionLabel={t('page.viabilidade.upgrade')}
                        onAction={() => navigate('/dashboard/configuracoes')}
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <HeaderDashboard compact title={t('page.viabilidade.title')} subtitle={t('page.viabilidade.subtitle')} breadcrumb={t('page.viabilidade.breadcrumb')} />
            <div className={INTELLIGENCE_CONTENT_CLASS}>

                <IntelligenceFormCard>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h3 className="text-lg font-bold text-foreground">{t('page.viabilidade.formTitle')}</h3>
                        <Link to="/dashboard/historico?tab=intelligence&module=VIABILITY" className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium">
                            {t('page.viabilidade.viewHistory')}
                        </Link>
                    </div>
                    <p className="text-xs text-muted mb-4">{t('page.viabilidade.formDesc')}</p>

                    {/* Mode selector */}
                    <div className="flex flex-wrap gap-2 mb-5">
                        {[
                            { value: 'new_business' as const, label: t('page.viabilidade.mode.newBusiness') },
                            { value: 'expand' as const, label: t('page.viabilidade.mode.expand') },
                            { value: 'my_business' as const, label: t('page.viabilidade.mode.myBusiness') },
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setMode(opt.value)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${mode === opt.value
                                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                                    : 'bg-surface text-muted border border-border hover:border-emerald-500/30 hover:text-foreground'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {mode === 'my_business' && myBusinessProfileEmpty && (
                        <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-muted">
                            <p className="font-bold text-foreground mb-1">{t('page.viabilidade.profileIncompleteTitle')}</p>
                            <p className="mb-3">{t('page.viabilidade.profileIncompleteDesc')}</p>
                            <Link to="/dashboard/configuracoes" className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
                                {t('page.viabilidade.goToSettings')}
                            </Link>
                        </div>
                    )}

                    {mode === 'my_business' && !myBusinessProfileEmpty && (
                        <p className="text-sm text-muted mb-4">
                            {t('page.viabilidade.yourBusiness')} <span className="font-bold text-foreground">{profileBusinessLabel}</span>
                        </p>
                    )}

                    <form onSubmit={handleAnalyze} className="space-y-4">
                        {mode !== 'my_business' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <input
                                    value={mode === 'expand' && useProfileForExpand ? profileBusinessLabel : businessType}
                                    onChange={(e) => setBusinessType(e.target.value)}
                                    disabled={mode === 'expand' && useProfileForExpand}
                                    placeholder={mode === 'expand' ? t('page.viabilidade.placeholder.expand') : t('page.viabilidade.placeholder.businessType')}
                                    className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60"
                                    required
                                />
                                {mode === 'expand' && (
                                    <label className="flex items-center gap-2 h-12 px-4 rounded-xl bg-surface border border-border cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={useProfileForExpand}
                                            onChange={(e) => setUseProfileForExpand(e.target.checked)}
                                            className="rounded border-border text-emerald-500 focus:ring-emerald-500/50"
                                        />
                                        <span className="text-sm font-medium text-foreground">{t('page.viabilidade.useProfileData')}</span>
                                    </label>
                                )}
                            </div>
                        )}
                        <LocationFields value={location} onChange={(v) => setLocation((prev) => ({ ...prev, ...v }))} disabled={loading} accent="emerald" gridClass="grid-cols-1 sm:grid-cols-3" />
                        <Button type="submit" variant="primary" disabled={loading || !canSubmit} icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} className="w-full h-12 px-6 rounded-xl font-bold whitespace-nowrap bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-lg shadow-emerald-500/25 border-0">
                            {loading ? t('page.viabilidade.analyzing') : t('page.viabilidade.analyze')}
                        </Button>
                    </form>
                </IntelligenceFormCard>

                {error && !loading && !report && (
                    <IntelligenceErrorBanner message={error} onRetry={() => handleAnalyze()} />
                )}

                {loading && <IntelligenceLoadingSkeleton statCount={4} />}

                {report && !loading && (
                    <>
                        {report.goNoGo && (
                            <div className={`rounded-xl border p-4 text-center ${getGoConfig(t, report.goNoGo)?.bg}`}>
                                <p className={`text-lg font-black ${getGoConfig(t, report.goNoGo)?.color}`}>{getGoConfig(t, report.goNoGo)?.label}</p>
                                {report.goNoGo === 'CAUTION' && report.summary && (
                                    <p className="mt-3 text-sm text-muted leading-relaxed max-w-3xl mx-auto">{report.summary}</p>
                                )}
                            </div>
                        )}

                        <IntelligenceSectionCard className="flex flex-col md:flex-row items-center gap-6">
                            <div className="relative w-36 h-36 shrink-0">
                                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-surface" />
                                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(report.score / 10) * 264} 264`} className={getScoreColor(report.score)} stroke="currentColor" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className={`text-4xl font-black tabular-nums ${getScoreColor(report.score)}`}>{report.score.toLocaleString(numberLocale)}</span>
                                    <span className="text-[10px] text-muted uppercase tracking-wider font-bold">{t('page.viabilidade.scoreOutOf')}</span>
                                </div>
                            </div>
                            <div className="flex-1 text-center md:text-left space-y-3">
                                <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-black bg-gradient-to-r ${getScoreGradient(report.score)} text-white`}>
                                    {getVerdictLabel(t, report)}
                                </div>
                                {report.goNoGo !== 'CAUTION' && (
                                    <p className="text-sm text-muted leading-relaxed">{report.summary}</p>
                                )}
                            </div>
                        </IntelligenceSectionCard>

                        <div className={INTELLIGENCE_STAT_GRID_CLASS}>
                            <StatCard compact icon={Target} value={report.competitorDensity.toLocaleString(numberLocale)} label={t('page.viabilidade.stat.competitors')} color="violet" hint={t('page.viabilidade.stat.competitorsHint')} />
                            <StatCard compact icon={TrendingUp} value={report.saturationIndex.toLocaleString(numberLocale)} label={t('page.viabilidade.stat.saturation')} color="amber" hint={t('page.viabilidade.stat.saturationHint')} sublabel={getSaturationLabel(t, report.saturationIndex).label} sublabelColor={getSaturationLabel(t, report.saturationIndex).color} />
                            <StatCard compact icon={Globe} value={report.digitalMaturityPercent} label={t('page.viabilidade.stat.digitalMaturity')} color="emerald" suffix="%" hint={t('page.viabilidade.stat.digitalMaturityHint')} />
                            <StatCard compact icon={Zap} value={report.dailyLeadsTarget.toLocaleString(numberLocale)} label={t('page.viabilidade.stat.leadsPerDay')} color="blue" hint={t('page.viabilidade.stat.leadsPerDayHint')} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                                <h4 className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Lightbulb size={12} />{t('page.viabilidade.suggestedOffer')}</h4>
                                <p className="text-sm font-bold text-foreground">{report.suggestedOffer}</p>
                            </div>
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><DollarSign size={12} />{t('page.viabilidade.suggestedTicket')}</h4>
                                <p className="text-sm font-bold text-foreground">{report.suggestedTicket}</p>
                            </div>
                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                                <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><DollarSign size={12} />{t('page.viabilidade.estimatedInvestment')}</h4>
                                <p className="text-sm font-bold text-foreground">{report.estimatedInvestment}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <IntelligenceSectionCard>
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" /> {t('page.viabilidade.strengths')}
                                </h3>
                                <ul className="space-y-3">
                                    {report.strengths.map((s) => (
                                        <li key={`str-${String(s).slice(0, 80)}`} className="flex items-start gap-3 text-sm text-muted">
                                            <span className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5"><CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" /></span>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </IntelligenceSectionCard>
                            <IntelligenceSectionCard>
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <ShieldAlert size={16} className="text-rose-600 dark:text-rose-400" /> {t('page.viabilidade.risks')}
                                </h3>
                                <ul className="space-y-3">
                                    {report.risks.map((r) => (
                                        <li key={`risk-${String(r).slice(0, 80)}`} className="flex items-start gap-3 text-sm text-muted">
                                            <span className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0 mt-0.5"><AlertTriangle size={12} className="text-rose-600 dark:text-rose-400" /></span>
                                            {r}
                                        </li>
                                    ))}
                                </ul>
                            </IntelligenceSectionCard>
                        </div>

                        {report.segmentBreakdown && report.segmentBreakdown.length > 0 && (
                            <IntelligenceSectionCard>
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Layers size={16} className="text-violet-600 dark:text-violet-400" /> {t('page.viabilidade.segmentTitle')}
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border text-left">
                                                <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider">{t('page.viabilidade.segment')}</th>
                                                <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider text-right">{t('page.viabilidade.qty')}</th>
                                                <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider text-right">{t('page.viabilidade.rating')}</th>
                                                <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider">{t('page.viabilidade.opportunity')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {report.segmentBreakdown.map((seg) => {
                                                const oppCfg = getOppLevelConfig(t, seg.opportunityLevel) || getOppLevelConfig(t, 'media');
                                                return (
                                                    <tr key={seg.segment} className="border-b border-border/30 hover:bg-surface/50 transition-colors">
                                                        <td className="py-3 px-4 font-medium text-foreground capitalize">{seg.segment.replace(/_/g, ' ')}</td>
                                                        <td className="py-3 px-4 text-right tabular-nums text-foreground font-bold">{seg.count}</td>
                                                        <td className="py-3 px-4 text-right tabular-nums text-amber-600 dark:text-amber-400 font-bold">{seg.avgRating?.toFixed(1) ?? '—'}</td>
                                                        <td className="py-3 px-4">
                                                            <span className={`text-[10px] font-black px-2 py-1 rounded-full ${oppCfg.bg} ${oppCfg.color}`}>{oppCfg.label}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </IntelligenceSectionCard>
                        )}

                        {report.topOpportunities && report.topOpportunities.length > 0 && (
                            <IntelligenceSectionCard>
                                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Target size={14} className="text-amber-600 dark:text-amber-400" /> {t('page.viabilidade.topLeadsTitle')}
                                </h3>
                                <p className="text-xs text-muted mb-3">{t('page.viabilidade.topLeadsDesc')}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
                                    {report.topOpportunities.map((opp) => (
                                        <div key={opp.id} className="p-3 bg-surface rounded-lg border border-border/50 flex flex-col gap-2 hover:border-emerald-500/30 transition-colors">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-bold text-foreground truncate flex-1">{opp.name}</p>
                                                <span className={`shrink-0 text-xs font-black px-2 py-0.5 rounded-full ${getScoreBadgeBarClasses(opp.score).badge}`}>
                                                    {opp.score}
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-card rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-500 ${getScoreBadgeBarClasses(opp.score).bar}`} style={{ width: `${opp.score}%` }} />
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {opp.scoreFactors?.noWebsite && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full"><Globe size={9} />{t('page.concorrencia.badge.noWebsite')}</span>}
                                                {opp.scoreFactors?.noPhone && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full"><Phone size={9} />{t('page.concorrencia.badge.noPhone')}</span>}
                                                {opp.scoreFactors?.fewReviews && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full"><MessageSquare size={9} />{t('page.concorrencia.badge.fewReviews')}</span>}
                                                {opp.scoreFactors?.lowRating && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full"><Star size={9} />{t('page.viabilidade.rating')}</span>}
                                            </div>
                                            {opp.phone && <p className="text-[10px] text-muted flex items-center gap-1"><Phone size={10} />{opp.phone}</p>}
                                        </div>
                                    ))}
                                </div>
                            </IntelligenceSectionCard>
                        )}

                        <IntelligenceSectionCard>
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Lightbulb size={16} className="text-amber-600 dark:text-amber-400" /> {t('page.viabilidade.recommendations')}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {report.recommendations.map((rec, i) => (
                                    <div key={`rec-${String(rec).slice(0, 80)}`} className="flex items-start gap-3 p-4 bg-surface rounded-xl border border-border/50">
                                        <span className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center font-bold text-xs text-amber-600 dark:text-amber-400 shrink-0">{i + 1}</span>
                                        <p className="text-sm text-muted">{rec}</p>
                                    </div>
                                ))}
                            </div>
                        </IntelligenceSectionCard>

                        <IntelligenceSectionCard>
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                <MapPin size={16} className="text-violet-600 dark:text-violet-400" /> {t('page.viabilidade.bestLocations')}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {report.bestLocations.map((loc) => (
                                    <span key={`loc-${String(loc).slice(0, 80)}`} className="px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-xl text-sm font-medium text-violet-600 dark:text-violet-400">{loc}</span>
                                ))}
                            </div>
                        </IntelligenceSectionCard>
                    </>
                )}
            </div>
        </>
    );
}
