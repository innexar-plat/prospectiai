import { useState, useEffect } from 'react';
import { Lock, Loader2, Target, TrendingUp, DollarSign, Clock, Phone, ArrowRight, Zap, BarChart3, AlertTriangle } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { SessionUser, PipelineBrief } from '@/lib/api';
import { pipelineApi } from '@/lib/api';
import { StatCard, EmptyState } from '@/components/dashboard/shared/DashboardUI';

const LOST_REASON_LABELS: Record<string, string> = {
    PRICE: 'Preço',
    NO_NEED: 'Sem necessidade',
    COMPETITOR: 'Concorrente',
    NO_RESPONSE: 'Sem resposta',
    OTHER: 'Outro',
};

export default function PipelinePage() {
    const { user } = useOutletContext<{ user: SessionUser }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<PipelineBrief | null>(null);
    const [error, setError] = useState('');

    const hasAccess = user.plan === 'PRO' || user.plan === 'BUSINESS' || user.plan === 'SCALE';

    useEffect(() => {
        if (!hasAccess) { setLoading(false); return; }
        pipelineApi.getDailyBrief()
            .then(setData)
            .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar pipeline'))
            .finally(() => setLoading(false));
    }, [hasAccess]);

    if (!hasAccess) {
        return (
            <>
                <HeaderDashboard title="Pipeline Inteligente" subtitle="IA analisa seus leads e sugere os melhores para contatar hoje." breadcrumb="Inteligência / Pipeline" />
                <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
                    <EmptyState icon={Lock} title="Pipeline Inteligente" description="Veja probabilidade de fechamento, valor estimado do deal e recomendações diárias com IA." actionLabel="Faça Upgrade para PRO" onAction={() => navigate('/dashboard/configuracoes')} />
                </div>
            </>
        );
    }

    return (
        <>
            <HeaderDashboard title="Pipeline Inteligente" subtitle="Recomendações diárias baseadas em IA e seus dados de conversão." breadcrumb="Inteligência / Pipeline" />
            <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">

                {loading && (
                    <div className="flex flex-col items-center justify-center p-16 gap-4">
                        <Loader2 size={40} className="animate-spin text-violet-600 dark:text-violet-400" />
                        <p className="text-sm text-muted">Calculando pipeline inteligente...</p>
                    </div>
                )}

                {error && !loading && (
                    <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-6 text-center">
                        <AlertTriangle size={24} className="mx-auto text-rose-500 mb-2" />
                        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
                    </div>
                )}

                {data && !loading && (
                    <>
                        {/* KPIs */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            <StatCard value={data.stats.totalActive} label="Leads Ativos" color="violet" />
                            <StatCard value={data.stats.hotLeads} label="Leads Quentes" color="amber" suffix="🔥" />
                            <StatCard value={`${data.stats.avgCloseProbability}%`} label="Prob. Média" color="emerald" />
                            <StatCard value={`R$ ${(data.stats.pipelineValue / 1000).toFixed(0)}k`} label="Pipeline Total" color="blue" />
                            <StatCard value={data.stats.conversionRate != null ? `${data.stats.conversionRate}%` : '-'} label="Taxa Conversão" color="amber" />
                        </div>

                        {/* Extra stats row */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {data.stats.avgDealValue != null && (
                                <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
                                    <DollarSign size={20} className="text-emerald-500 shrink-0" />
                                    <div>
                                        <p className="text-xs text-muted">Ticket Médio</p>
                                        <p className="text-sm font-bold text-foreground">R$ {data.stats.avgDealValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
                                    </div>
                                </div>
                            )}
                            {data.stats.avgCycleDays != null && (
                                <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
                                    <Clock size={20} className="text-blue-500 shrink-0" />
                                    <div>
                                        <p className="text-xs text-muted">Ciclo Médio</p>
                                        <p className="text-sm font-bold text-foreground">{data.stats.avgCycleDays} dias</p>
                                    </div>
                                </div>
                            )}
                            <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
                                <TrendingUp size={20} className="text-emerald-500 shrink-0" />
                                <div>
                                    <p className="text-xs text-muted">Convertidos</p>
                                    <p className="text-sm font-bold text-foreground">{data.stats.totalConverted}</p>
                                </div>
                            </div>
                            <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
                                <BarChart3 size={20} className="text-rose-500 shrink-0" />
                                <div>
                                    <p className="text-xs text-muted">Perdidos</p>
                                    <p className="text-sm font-bold text-foreground">{data.stats.totalLost}</p>
                                </div>
                            </div>
                        </div>

                        {/* Top Lost Reasons */}
                        {data.stats.topLostReasons.length > 0 && (
                            <div className="rounded-2xl bg-card border border-border p-4">
                                <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Principais Motivos de Perda</h4>
                                <div className="flex flex-wrap gap-2">
                                    {data.stats.topLostReasons.map((r) => (
                                        <span key={r.reason} className="px-3 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full text-xs font-medium">
                                            {LOST_REASON_LABELS[r.reason] || r.reason} ({r.count}x)
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recommendations */}
                        <div className="rounded-3xl bg-card border border-border p-6">
                            <div className="flex items-center gap-2 mb-1">
                                <Zap size={20} className="text-violet-600 dark:text-violet-400" />
                                <h3 className="text-lg font-bold text-foreground">Contate Hoje</h3>
                            </div>
                            <p className="text-xs text-muted mb-4">IA ranqueou os leads com maior potencial de fechar agora.</p>

                            {data.recommendations.length === 0 ? (
                                <p className="text-sm text-muted text-center py-8">Nenhum lead ativo no pipeline. Comece prospectando!</p>
                            ) : (
                                <div className="space-y-3">
                                    {data.recommendations.map((rec) => (
                                        <button
                                            key={rec.analysisId}
                                            type="button"
                                            onClick={() => navigate(`/dashboard/lead/${rec.leadPlaceId || rec.leadId}`)}
                                            className="w-full text-left p-4 bg-surface rounded-xl border border-border/50 hover:border-violet-500/30 transition-colors flex items-start gap-4"
                                        >
                                            {/* Rank */}
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                                                rec.rank <= 3 ? 'bg-violet-600/20 text-violet-600 dark:text-violet-400' : 'bg-surface text-muted'
                                            }`}>
                                                #{rec.rank}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-bold text-foreground truncate">{rec.leadName}</p>
                                                    {rec.scoreLabel && (
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                            rec.scoreLabel === 'Muito Quente' || rec.scoreLabel === 'Very Hot' ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                                                            : rec.scoreLabel === 'Quente' || rec.scoreLabel === 'Hot' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                                            : 'bg-surface text-muted'
                                                        }`}>
                                                            {rec.scoreLabel}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 mb-1.5">
                                                    {rec.reasons.map((reason, idx) => (
                                                        <span key={idx} className="text-[10px] text-muted bg-card px-2 py-0.5 rounded-full border border-border/50">
                                                            {reason}
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-muted">
                                                    {rec.closeProbability != null && (
                                                        <span className="flex items-center gap-1">
                                                            <Target size={12} className="text-emerald-500" />
                                                            {rec.closeProbability}% chance
                                                        </span>
                                                    )}
                                                    {rec.estimatedDealValue != null && (
                                                        <span className="flex items-center gap-1">
                                                            <DollarSign size={12} className="text-emerald-500" />
                                                            R$ {rec.estimatedDealValue.toLocaleString('pt-BR')}
                                                        </span>
                                                    )}
                                                    {rec.bestContactWindow && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={12} className="text-blue-500" />
                                                            {rec.bestContactWindow}
                                                        </span>
                                                    )}
                                                    {rec.phone && (
                                                        <span className="flex items-center gap-1">
                                                            <Phone size={12} />
                                                            {rec.phone}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action */}
                                            <div className="shrink-0 flex flex-col items-end gap-1">
                                                <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400">{rec.suggestedAction}</span>
                                                <ArrowRight size={16} className="text-muted" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
