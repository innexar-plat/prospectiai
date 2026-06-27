import { useState, useCallback, useRef } from 'react';
import { Lock, Loader2, Search, TrendingUp, Globe, Phone, Layers, Lightbulb, Target, Star, BarChart3 } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { SessionUser, MarketReport, ScoredPlace } from '@/lib/api';
import { searchApi } from '@/lib/api';
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
  AiInsightsPanel,
} from '@/components/dashboard/shared/IntelligenceUI';
import { LocationFields, createDefaultLocationValue, type LocationFieldsValue } from '@/components/dashboard/LocationFields';
import { useI18n } from '@/lib/i18n';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const SATURATION_COLORS: Record<number, string> = {
  0: 'text-emerald-600 dark:text-emerald-400',
  1: 'text-emerald-600 dark:text-emerald-400',
  2: 'text-emerald-600 dark:text-emerald-400',
  3: 'text-blue-600 dark:text-blue-400',
  4: 'text-blue-600 dark:text-blue-400',
  5: 'text-amber-600 dark:text-amber-400',
  6: 'text-amber-600 dark:text-amber-400',
  7: 'text-orange-400',
  8: 'text-rose-600 dark:text-rose-400',
  9: 'text-rose-600 dark:text-rose-400',
  10: 'text-rose-500',
};

function getSaturationInfo(t: TranslateFn, index: number) {
  const clamped = Math.min(10, Math.max(0, index));
  return { text: t(`page.relatorios.saturation.${clamped}`), color: SATURATION_COLORS[clamped] || SATURATION_COLORS[5] };
}

function getScoreBadgeBarClasses(score: number): { badge: string; bar: string } {
  if (score >= 60) return { badge: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' };
  if (score >= 35) return { badge: 'bg-amber-500/20 text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
  return { badge: 'bg-surface text-muted', bar: 'bg-surface' };
}

export default function RelatoriosPage() {
  const { user } = useOutletContext<{ user: SessionUser }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { t } = useI18n();

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState<LocationFieldsValue>(() => createDefaultLocationValue());
  const locationRef = useRef(location);
  locationRef.current = location;
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<MarketReport | null>(null);
  const [error, setError] = useState('');

  const hasAccess = user.plan === 'BUSINESS' || user.plan === 'SCALE';

  const runGenerate = useCallback(async () => {
    const loc = locationRef.current;
    if (!query.trim()) return;
    setLoading(true);
    setReport(null);
    setError('');
    try {
      const result = await searchApi.marketReport({
        textQuery: query.trim(),
        city: loc.city.trim() || undefined,
        state: loc.state && loc.state !== 'Todos' ? loc.state : undefined,
        country: loc.country,
        pageSize: 60,
      });
      setReport(result as MarketReport);
      window.dispatchEvent(new Event('refresh-user'));
      addToast('success', t('page.relatorios.toast.success'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('page.relatorios.toast.error');
      setError(message);
      addToast('error', message);
    } finally {
      setLoading(false);
    }
  }, [query, addToast, t]);

  const handleGenerate = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    await runGenerate();
  };

  if (!hasAccess) {
    return (
      <>
        <HeaderDashboard compact title={t('page.relatorios.title')} subtitle={t('page.relatorios.subtitle')} breadcrumb={t('page.relatorios.breadcrumb')} />
        <div className={INTELLIGENCE_CONTENT_CLASS}>
          <EmptyState
            icon={Lock}
            title={t('page.relatorios.lockedTitle')}
            description={t('page.relatorios.lockedDesc')}
            actionLabel={t('page.relatorios.upgradeEnterprise')}
            onAction={() => navigate('/dashboard/configuracoes')}
          />
        </div>
      </>
    );
  }

  const satInfo = report ? getSaturationInfo(t, report.saturationIndex) : null;

  return (
    <>
      <HeaderDashboard compact title={t('page.relatorios.title')} subtitle={t('page.relatorios.subtitleActive')} breadcrumb={t('page.relatorios.breadcrumb')} />
      <div className={INTELLIGENCE_CONTENT_CLASS}>
        <IntelligenceFormCard>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">{t('page.relatorios.formTitle')}</h3>
          <form onSubmit={handleGenerate} className="space-y-3">
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('page.relatorios.placeholder.businessType')} className="h-11 w-full bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50" required />
            <LocationFields
              value={location}
              onChange={(v) => setLocation((prev) => ({ ...prev, ...v }))}
              disabled={loading}
              accent="violet"
              gridClass="grid-cols-1 sm:grid-cols-3"
            />
            <Button type="submit" variant="primary" disabled={loading || !query.trim()} icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} className="h-11 px-6 w-full rounded-xl font-bold whitespace-nowrap">
              {loading ? t('page.relatorios.analyzing') : t('page.relatorios.generate')}
            </Button>
          </form>
        </IntelligenceFormCard>

        {error && !loading && !report && (
          <IntelligenceErrorBanner message={error} onRetry={runGenerate} />
        )}

        {loading && <IntelligenceLoadingSkeleton statCount={4} />}

        {report && !loading && (
          <>
            <div className={INTELLIGENCE_STAT_GRID_CLASS}>
              <StatCard compact value={report.totalBusinesses} label={t('page.relatorios.stat.businesses')} color="violet" icon={BarChart3} />
              <StatCard compact value={report.segments.length} label={t('page.relatorios.stat.segments')} color="blue" icon={Layers} />
              <StatCard compact value={report.avgRating?.toFixed(1) ?? '—'} label={t('page.relatorios.stat.avgRating')} color="amber" suffix="★" icon={Star} />
              <StatCard
                compact
                value={report.saturationIndex}
                label={satInfo?.text ?? t('page.relatorios.stat.saturation')}
                color="emerald"
                icon={TrendingUp}
              />
            </div>

            {report.aiInsights && (
              <AiInsightsPanel
                title={t('page.relatorios.aiExecutive')}
                summary={report.aiInsights.executiveSummary}
                chips={[
                  { label: `${(report.aiInsights.marketTrends ?? []).length} ${t('page.relatorios.trends').toLowerCase()}`, tone: 'violet' },
                  { label: `${(report.aiInsights.opportunities ?? []).length} ${t('page.relatorios.opportunities').toLowerCase()}`, tone: 'emerald' },
                  { label: `${(report.aiInsights.recommendations ?? []).length} ${t('page.relatorios.recommendations').toLowerCase()}`, tone: 'amber' },
                ]}
                tabs={[
                  { key: 'trends', label: t('page.relatorios.trends'), icon: TrendingUp, items: report.aiInsights.marketTrends ?? [], bulletClass: 'text-violet-600 dark:text-violet-400' },
                  { key: 'opportunities', label: t('page.relatorios.opportunities'), icon: Target, items: report.aiInsights.opportunities ?? [], bulletClass: 'text-emerald-600 dark:text-emerald-400' },
                  { key: 'recommendations', label: t('page.relatorios.recommendations'), icon: Lightbulb, items: report.aiInsights.recommendations ?? [], bulletClass: 'text-amber-600 dark:text-amber-400' },
                ]}
              />
            )}

            <IntelligenceSectionCard>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />{t('page.relatorios.digitalMaturity')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AnimatedBar icon={<Globe size={16} className="text-emerald-600 dark:text-emerald-400" />} label={t('page.relatorios.presence.withWebsite')} count={report.digitalMaturity.withWebsite} total={report.digitalMaturity.total} pct={report.digitalMaturity.withWebsitePercent} color="bg-emerald-500" countLabel={t('page.relatorios.countOf', { count: report.digitalMaturity.withWebsite, total: report.digitalMaturity.total })} />
                <AnimatedBar icon={<Phone size={16} className="text-blue-600 dark:text-blue-400" />} label={t('page.relatorios.presence.withPhone')} count={report.digitalMaturity.withPhone} total={report.digitalMaturity.total} pct={report.digitalMaturity.withPhonePercent} color="bg-blue-500" countLabel={t('page.relatorios.countOf', { count: report.digitalMaturity.withPhone, total: report.digitalMaturity.total })} />
              </div>
            </IntelligenceSectionCard>

            {report.topOpportunities && report.topOpportunities.length > 0 && (
              <IntelligenceSectionCard>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Target size={14} className="text-amber-600 dark:text-amber-400" />{t('page.relatorios.topOpportunitiesTitle')}
                </h3>
                <p className="text-xs text-muted mb-3">{t('page.relatorios.topOpportunitiesDesc')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                  {report.topOpportunities.map((opp: ScoredPlace) => (
                    <div key={opp.id} className="p-3 bg-surface rounded-lg border border-border/50 flex flex-col gap-2 hover:border-violet-500/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-foreground truncate flex-1">{opp.name}</p>
                        <span className={`shrink-0 text-xs font-black px-2 py-0.5 rounded-full ${getScoreBadgeBarClasses(opp.score).badge}`}>
                          {opp.score}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-card rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${getScoreBadgeBarClasses(opp.score).bar}`} style={{ width: `${opp.score}%` }} />
                      </div>
                      {opp.rating != null && <p className="text-[10px] text-muted flex items-center gap-1"><Star size={10} className="text-amber-600 dark:text-amber-400" />{t('page.relatorios.reviews', { rating: opp.rating?.toFixed(1), count: opp.reviewCount ?? 0 })}</p>}
                    </div>
                  ))}
                </div>
              </IntelligenceSectionCard>
            )}

            <IntelligenceSectionCard>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Layers size={14} className="text-violet-600 dark:text-violet-400" />{t('page.relatorios.segmentsTitle')}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider">#</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider">{t('page.relatorios.col.type')}</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider text-right">{t('page.relatorios.col.quantity')}</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider text-right">{t('page.relatorios.col.avgRating')}</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider">{t('page.relatorios.col.share')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.segments.map((seg, i) => {
                      const pct = report.totalBusinesses > 0 ? Math.round((seg.count / report.totalBusinesses) * 100) : 0;
                      return (
                        <tr key={seg.type} className="border-b border-border/30 hover:bg-surface/50 transition-colors">
                          <td className="py-3 px-4 text-muted tabular-nums">{i + 1}</td>
                          <td className="py-3 px-4 font-medium text-foreground capitalize">{seg.type.replace(/_/g, ' ')}</td>
                          <td className="py-3 px-4 text-right tabular-nums text-foreground font-bold">{seg.count}</td>
                          <td className="py-3 px-4 text-right tabular-nums text-amber-600 dark:text-amber-400 font-bold">{seg.avgRating?.toFixed(1) ?? '—'}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden border border-border/50">
                                <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-muted tabular-nums w-10 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </IntelligenceSectionCard>
          </>
        )}
      </div>
    </>
  );
}

function AnimatedBar({ icon, label, pct, color, countLabel }: { icon: React.ReactNode; label: string; count: number; total: number; pct: number; color: string; countLabel: string }) {
  return (
    <div className="p-4 bg-surface rounded-xl border border-border/50">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm font-bold text-foreground">{label}</span>
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-2xl font-black text-foreground tabular-nums">{pct}%</span>
        <span className="text-xs text-muted tabular-nums">{countLabel}</span>
      </div>
      <div className="w-full h-2.5 bg-card rounded-full overflow-hidden border border-border/50">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
