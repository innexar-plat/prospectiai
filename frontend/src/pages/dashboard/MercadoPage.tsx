import { useState } from 'react';
import { Lock, Loader2, Search, Globe, TrendingUp, BarChart3, Lightbulb, Target, Star, Layers } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';
import type { SessionUser, MarketReport } from '@/lib/api';
import { searchApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { StatCard, PresenceBar, EmptyState } from '@/components/dashboard/shared/DashboardUI';

const UF_OPTIONS = ['', 'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

function getSaturationLabel(idx: number): { label: string; color: string; bg: string } {
    if (idx >= 15) return { label: 'Saturado', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' };
    if (idx >= 8) return { label: 'Competitivo', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' };
    return { label: 'Baixa Concorrência', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' };
}

export default function MercadoPage() {
    const { user } = useOutletContext<{ user: SessionUser }>();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [query, setQuery] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<MarketReport | null>(null);

    const hasAccess = user.plan === 'BUSINESS' || user.plan === 'SCALE';

    const handleAnalyze = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!query.trim()) return;
        setLoading(true);
        try {
            const result = await searchApi.marketReport({
                textQuery: query.trim(),
                city: city || undefined,
                state: state || undefined,
                pageSize: 60,
            });
            setData(result);
            window.dispatchEvent(new Event('refresh-user'));
            addToast('success', `Relatório concluído: ${result.totalBusinesses} negócios mapeados.`);
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : 'Erro ao gerar relatório de mercado.');
        } finally {
            setLoading(false);
        }
    };

    if (!hasAccess) {
        return (
            <>
                <HeaderDashboard title="Inteligência de Mercado" subtitle="Mapeamento completo do mercado local com IA." breadcrumb="Inteligência / Mercado" />
                <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
                    <EmptyState
                        icon={Lock}
                        title="Inteligência de Mercado"
                        description="Mapeie segmentos, maturidade digital, saturação e oportunidades em qualquer região. Insights estratégicos gerados por IA."
                        actionLabel="Upgrade para Business"
                        onAction={() => navigate('/dashboard/planos')}
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <HeaderDashboard title="Inteligência de Mercado" subtitle="Mapeamento completo com segmentação, maturidade digital e insights IA." breadcrumb="Inteligência / Mercado" />
            <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">

                {/* Search Form */}
                <div className="rounded-3xl bg-card border border-border p-6 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h3 className="text-lg font-bold text-foreground">Analisar Mercado</h3>
                        <Link to="/dashboard/historico?tab=intelligence&module=MARKET" className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium">
                            Ver histórico
                        </Link>
                    </div>
                    <form onSubmit={handleAnalyze} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex: restaurantes, academias, clínicas..." className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50 sm:col-span-2" required />
                        <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
                        <select value={state} onChange={(e) => setState(e.target.value)} className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50">
                            <option value="">Estado (UF)</option>
                            {UF_OPTIONS.filter(Boolean).map((uf) => (<option key={uf} value={uf}>{uf}</option>))}
                        </select>
                        <Button type="submit" variant="primary" disabled={loading || !query.trim()} icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} className="h-12 px-6 rounded-xl font-bold whitespace-nowrap sm:col-span-2 lg:col-span-4">
                            {loading ? 'Analisando mercado...' : 'Gerar Relatório'}
                        </Button>
                    </form>
                </div>

                {/* Results */}
                {data && (
                    <>
                        {/* KPIs */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard icon={Layers} label="Negócios Mapeados" value={data.totalBusinesses} color="violet" />
                            <StatCard icon={BarChart3} label="Segmentos" value={data.segments.length} color="blue" />
                            <StatCard icon={Star} label="Rating Médio" value={data.avgRating?.toFixed(1) ?? 'N/A'} color="amber" />
                            {(() => {
                                const sat = getSaturationLabel(data.saturationIndex);
                                return <StatCard icon={TrendingUp} label="Saturação" value={`${data.saturationIndex} — ${sat.label}`} color="emerald" />;
                            })()}
                        </div>

                        {/* Digital Maturity */}
                        <div className="rounded-3xl bg-card border border-border p-6">
                            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                                <Globe size={20} className="text-violet-500" /> Maturidade Digital
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <PresenceBar label="Com Website" count={data.digitalMaturity.withWebsite} total={data.digitalMaturity.total} color="bg-violet-500" />
                                <PresenceBar label="Com Telefone" count={data.digitalMaturity.withPhone} total={data.digitalMaturity.total} color="bg-blue-500" />
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                                <div className="rounded-xl bg-surface p-4">
                                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{data.digitalMaturity.withWebsitePercent}%</p>
                                    <p className="text-xs text-muted mt-1">possuem website</p>
                                </div>
                                <div className="rounded-xl bg-surface p-4">
                                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.digitalMaturity.withPhonePercent}%</p>
                                    <p className="text-xs text-muted mt-1">possuem telefone</p>
                                </div>
                            </div>
                        </div>

                        {/* Segments */}
                        <div className="rounded-3xl bg-card border border-border p-6">
                            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                                <Layers size={20} className="text-violet-500" /> Segmentação do Mercado
                            </h3>
                            <div className="space-y-2">
                                {data.segments.slice(0, 12).map((seg) => (
                                    <div key={seg.type} className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-sm font-medium text-foreground truncate">{seg.type.replace(/_/g, ' ')}</span>
                                            {seg.avgRating != null && (
                                                <span className="text-xs text-muted flex items-center gap-1"><Star size={12} className="text-amber-500" /> {seg.avgRating}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-24 h-1.5 bg-background rounded-full overflow-hidden">
                                                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min((seg.count / data.totalBusinesses) * 100, 100)}%` }} />
                                            </div>
                                            <span className="text-xs font-semibold text-muted tabular-nums w-8 text-right">{seg.count}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top Opportunities */}
                        {data.topOpportunities.length > 0 && (
                            <div className="rounded-3xl bg-card border border-border p-6">
                                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                                    <Target size={20} className="text-emerald-500" /> Top Oportunidades
                                </h3>
                                <div className="space-y-2">
                                    {data.topOpportunities.slice(0, 10).map((opp, i) => (
                                        <div key={opp.id || i} className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-foreground truncate">{opp.name}</p>
                                                <p className="text-xs text-muted truncate">{opp.formattedAddress}</p>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0 ml-3">
                                                {opp.rating != null && (
                                                    <span className="text-xs text-muted flex items-center gap-1"><Star size={12} className="text-amber-500" /> {opp.rating}</span>
                                                )}
                                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">{opp.score ?? '-'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AI Insights */}
                        {data.aiInsights && (
                            <div className="rounded-3xl bg-card border border-border p-6 space-y-5">
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <Lightbulb size={20} className="text-amber-500" /> Insights de Mercado (IA)
                                </h3>

                                {/* Executive Summary */}
                                <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-4">
                                    <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-2">Resumo Executivo</p>
                                    <p className="text-sm text-foreground leading-relaxed">{data.aiInsights.executiveSummary}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Trends */}
                                    <div className="rounded-xl bg-surface p-4">
                                        <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                            <TrendingUp size={16} className="text-blue-500" /> Tendências
                                        </p>
                                        <ul className="space-y-2">
                                            {data.aiInsights.marketTrends.map((t, i) => (
                                                <li key={i} className="text-xs text-muted leading-relaxed flex gap-2">
                                                    <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                                                    <span>{t}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Opportunities */}
                                    <div className="rounded-xl bg-surface p-4">
                                        <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                            <Target size={16} className="text-emerald-500" /> Oportunidades
                                        </p>
                                        <ul className="space-y-2">
                                            {data.aiInsights.opportunities.map((o, i) => (
                                                <li key={i} className="text-xs text-muted leading-relaxed flex gap-2">
                                                    <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
                                                    <span>{o}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Recommendations */}
                                    <div className="rounded-xl bg-surface p-4">
                                        <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                            <Lightbulb size={16} className="text-amber-500" /> Recomendações
                                        </p>
                                        <ul className="space-y-2">
                                            {data.aiInsights.recommendations.map((r, i) => (
                                                <li key={i} className="text-xs text-muted leading-relaxed flex gap-2">
                                                    <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                                                    <span>{r}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
