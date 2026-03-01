import { useState } from 'react';
import { TrendingUp, Lock, Loader2, Search, Target, Globe, AlertTriangle, CheckCircle2, MapPin, DollarSign, Lightbulb, ShieldAlert, Phone, Star, Layers, Zap, MessageSquare } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';
import type { SessionUser, ViabilityReport, ViabilityMode } from '@/lib/api';
import { viabilityApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { StatCard, EmptyState } from '@/components/dashboard/shared/DashboardUI';

const UF_OPTIONS = ['', 'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

const GO_CONFIG = {
    GO: { label: '✅ GO — Abrir esse Negócio!', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30', glow: 'shadow-emerald-500/25' },
    CAUTION: { label: '⚡ CAUTION — Analisar Melhor', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30', glow: 'shadow-amber-500/25' },
    NO_GO: { label: '🛑 NO GO — Não Recomendado', color: 'text-rose-400', bg: 'bg-rose-500/15 border-rose-500/30', glow: 'shadow-rose-500/25' },
};

const OPP_LEVEL_CONFIG = {
    alta: { label: 'Alta', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    media: { label: 'Média', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    baixa: { label: 'Baixa', color: 'text-rose-400', bg: 'bg-rose-500/10' },
};

function getScoreColor(s: number) {
    if (s >= 8) return 'text-emerald-400';
    if (s >= 6) return 'text-blue-400';
    if (s >= 4) return 'text-amber-400';
    return 'text-rose-400';
}

function getScoreGradient(s: number) {
    if (s >= 8) return 'from-emerald-500 to-emerald-600';
    if (s >= 6) return 'from-blue-500 to-blue-600';
    if (s >= 4) return 'from-amber-500 to-amber-600';
    return 'from-rose-500 to-rose-600';
}

function getScoreBadgeBarClasses(score: number): { badge: string; bar: string } {
    if (score >= 60) return { badge: 'bg-emerald-500/20 text-emerald-400', bar: 'bg-emerald-500' };
    if (score >= 35) return { badge: 'bg-amber-500/20 text-amber-400', bar: 'bg-amber-500' };
    return { badge: 'bg-surface text-muted', bar: 'bg-surface' };
}

export default function ViabilidadePage() {
    const { user } = useOutletContext<{ user: SessionUser }>();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [mode, setMode] = useState<ViabilityMode>('new_business');
    const [businessType, setBusinessType] = useState('');
    const [useProfileForExpand, setUseProfileForExpand] = useState(false);
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<ViabilityReport | null>(null);

    const hasAccess = user.plan === 'BUSINESS' || user.plan === 'SCALE';

    const profileBusinessLabel = [user.companyName, user.productService].filter(Boolean).join(' — ') || '';
    const myBusinessProfileEmpty = !(user.companyName?.trim() || user.productService?.trim());

    const useProfileLabel = mode === 'my_business' || (mode === 'expand' && useProfileForExpand);
    const effectiveBusinessType = useProfileLabel ? profileBusinessLabel : businessType;

    const canSubmit =
        city.trim().length > 0 &&
        (mode === 'my_business' ? !myBusinessProfileEmpty : effectiveBusinessType.trim().length >= 2);

    const handleAnalyze = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!canSubmit) return;
        setLoading(true);
        setReport(null);
        try {
            const payload =
                mode === 'my_business'
                    ? { mode: 'my_business' as const, city: city.trim(), state: state || undefined }
                    : { mode, businessType: effectiveBusinessType.trim(), city: city.trim(), state: state || undefined };
            const result = await viabilityApi.analyze(payload);
            setReport(result);
            window.dispatchEvent(new Event('refresh-user'));
            addToast('success', `Análise de viabilidade concluída! Score: ${result.score}/10`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Erro ao analisar viabilidade.';
            addToast('error', message);
        } finally {
            setLoading(false);
        }
    };

    if (!hasAccess) {
        return (
            <>
                <HeaderDashboard title="Viabilidade de Negócio" subtitle="Descubra se vale a pena abrir um negócio na região." breadcrumb="Inteligência / Viabilidade" />
                <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
                    <EmptyState
                        icon={Lock}
                        title="Análise de Viabilidade com IA"
                        description="Descubra se vale a pena abrir um negócio em determinada cidade ou bairro. A IA analisa concorrentes reais, saturação de mercado e sugere as melhores localizações."
                        actionLabel="Faça Upgrade para Enterprise"
                        onAction={() => navigate('/dashboard/configuracoes')}
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <HeaderDashboard title="Viabilidade de Negócio" subtitle="Analise a viabilidade de abrir um negócio em qualquer região." breadcrumb="Inteligência / Viabilidade" />
            <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">

                {/* Form */}
                <div className="rounded-3xl bg-card border border-border p-6 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h3 className="text-lg font-bold text-foreground">Devo abrir esse negócio aqui?</h3>
                        <Link to="/dashboard/historico?tab=intelligence&module=VIABILITY" className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">
                            Ver histórico
                        </Link>
                    </div>
                    <p className="text-xs text-muted mb-4">A IA analisa dados reais de concorrentes, saturação e presença digital para dar um score de viabilidade.</p>

                    {/* Mode selector */}
                    <div className="flex flex-wrap gap-2 mb-5">
                        {[
                            { value: 'new_business' as const, label: 'Quero abrir um novo negócio' },
                            { value: 'expand' as const, label: 'Quero expandir meu negócio' },
                            { value: 'my_business' as const, label: 'Viabilidade do meu negócio na cidade' },
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setMode(opt.value)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${mode === opt.value
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                    : 'bg-surface text-muted border border-border hover:border-emerald-500/30 hover:text-foreground'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {mode === 'my_business' && myBusinessProfileEmpty && (
                        <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-muted">
                            <p className="font-bold text-foreground mb-1">Complete seu perfil para usar esta análise</p>
                            <p className="mb-3">Informe empresa e serviço/produto em Configurações ou no onboarding.</p>
                            <Link to="/dashboard/configuracoes" className="inline-flex items-center gap-1.5 text-emerald-400 font-bold hover:underline">
                                Ir para Configurações
                            </Link>
                        </div>
                    )}

                    {mode === 'my_business' && !myBusinessProfileEmpty && (
                        <p className="text-sm text-muted mb-4">
                            Seu negócio: <span className="font-bold text-foreground">{profileBusinessLabel}</span>
                        </p>
                    )}

                    <form onSubmit={handleAnalyze} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {mode !== 'my_business' && (
                            <>
                                <input
                                    value={mode === 'expand' && useProfileForExpand ? profileBusinessLabel : businessType}
                                    onChange={(e) => setBusinessType(e.target.value)}
                                    disabled={mode === 'expand' && useProfileForExpand}
                                    placeholder={mode === 'expand' ? 'Tipo de negócio (ou use dados do perfil)' : 'Tipo de negócio (ex: pizzaria, barbearia, academia)'}
                                    className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 sm:col-span-2"
                                    required
                                />
                                {mode === 'expand' && (
                                    <label className="flex items-center gap-2 h-12 px-4 rounded-xl bg-surface border border-border cursor-pointer sm:col-span-2 lg:col-span-1">
                                        <input
                                            type="checkbox"
                                            checked={useProfileForExpand}
                                            onChange={(e) => setUseProfileForExpand(e.target.checked)}
                                            className="rounded border-border text-emerald-500 focus:ring-emerald-500/50"
                                        />
                                        <span className="text-sm font-medium text-foreground">Usar dados do meu perfil</span>
                                    </label>
                                )}
                            </>
                        )}
                        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade (ex: Santos, Curitiba)" className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/50" required />
                        <select value={state} onChange={(e) => setState(e.target.value)} className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                            <option value="">Estado (UF)</option>
                            {UF_OPTIONS.filter(Boolean).map((uf) => (<option key={uf} value={uf}>{uf}</option>))}
                        </select>
                        <Button type="submit" variant="primary" disabled={loading || !canSubmit} icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} className="h-12 px-6 rounded-xl font-bold whitespace-nowrap bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-lg shadow-emerald-500/25 border-0 sm:col-span-2 lg:col-span-4">
                            {loading ? 'Analisando...' : 'Analisar Viabilidade'}
                        </Button>
                    </form>
                </div>

                {loading && (
                    <div className="flex flex-col items-center justify-center p-16 gap-4">
                        <Loader2 size={40} className="animate-spin text-emerald-400" />
                        <p className="text-sm text-muted">Analisando concorrentes, mercado e gerando relatório com IA...</p>
                        <p className="text-xs text-muted/60">Isso pode levar até 60 segundos</p>
                    </div>
                )}

                {report && !loading && (
                    <>
                        {/* Go/No-Go Hero */}
                        {report.goNoGo && (
                            <div className={`rounded-3xl border p-6 text-center shadow-lg ${GO_CONFIG[report.goNoGo]?.bg} ${GO_CONFIG[report.goNoGo]?.glow}`}>
                                <p className={`text-xl font-black ${GO_CONFIG[report.goNoGo]?.color}`}>{GO_CONFIG[report.goNoGo]?.label}</p>
                            </div>
                        )}

                        {/* Score Hero */}
                        <div className="rounded-3xl bg-gradient-to-br from-card to-surface border border-border p-8 flex flex-col md:flex-row items-center gap-8">
                            <div className="relative w-36 h-36 shrink-0">
                                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-surface" />
                                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(report.score / 10) * 264} 264`} className={getScoreColor(report.score)} stroke="currentColor" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className={`text-4xl font-black tabular-nums ${getScoreColor(report.score)}`}>{report.score}</span>
                                    <span className="text-[10px] text-muted uppercase tracking-wider font-bold">/10</span>
                                </div>
                            </div>
                            <div className="flex-1 text-center md:text-left space-y-2">
                                <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-black bg-gradient-to-r ${getScoreGradient(report.score)} text-white`}>{report.verdict}</div>
                                <p className="text-sm text-muted leading-relaxed">{report.summary}</p>
                            </div>
                        </div>

                        {/* KPIs */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <StatCard icon={Target} value={report.competitorDensity} label="Concorrentes" color="violet" />
                            <StatCard icon={TrendingUp} value={report.saturationIndex} label="Saturação" color="amber" />
                            <StatCard icon={Globe} value={report.digitalMaturityPercent} label="Maturidade Digital" color="emerald" suffix="%" />
                            <StatCard icon={Zap} value={report.dailyLeadsTarget} label="Leads/Dia" color="blue" />
                        </div>

                        {/* Playbook: Offer + Ticket */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="rounded-2xl bg-gradient-to-br from-violet-900/20 to-card border border-violet-500/20 p-5">
                                <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Lightbulb size={12} />Oferta Sugerida</h4>
                                <p className="text-sm font-bold text-foreground">{report.suggestedOffer}</p>
                            </div>
                            <div className="rounded-2xl bg-gradient-to-br from-emerald-900/20 to-card border border-emerald-500/20 p-5">
                                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><DollarSign size={12} />Ticket Sugerido</h4>
                                <p className="text-sm font-bold text-foreground">{report.suggestedTicket}</p>
                            </div>
                            <div className="rounded-2xl bg-gradient-to-br from-blue-900/20 to-card border border-blue-500/20 p-5">
                                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><DollarSign size={12} />Investimento Estimado</h4>
                                <p className="text-sm font-bold text-foreground">{report.estimatedInvestment}</p>
                            </div>
                        </div>

                        {/* Strengths & Risks */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="rounded-3xl bg-card border border-border p-6">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-400" /> Pontos Fortes
                                </h3>
                                <ul className="space-y-3">
                                    {report.strengths.map((s) => (
                                        <li key={`str-${String(s).slice(0, 80)}`} className="flex items-start gap-3 text-sm text-muted">
                                            <span className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5"><CheckCircle2 size={12} className="text-emerald-400" /></span>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="rounded-3xl bg-card border border-border p-6">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <ShieldAlert size={16} className="text-rose-400" /> Riscos Identificados
                                </h3>
                                <ul className="space-y-3">
                                    {report.risks.map((r) => (
                                        <li key={`risk-${String(r).slice(0, 80)}`} className="flex items-start gap-3 text-sm text-muted">
                                            <span className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0 mt-0.5"><AlertTriangle size={12} className="text-rose-400" /></span>
                                            {r}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Segment Breakdown */}
                        {report.segmentBreakdown && report.segmentBreakdown.length > 0 && (
                            <div className="rounded-3xl bg-card border border-border p-6">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Layers size={16} className="text-violet-400" /> Oportunidade por Segmento
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border text-left">
                                                <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider">Segmento</th>
                                                <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider text-right">Qtd</th>
                                                <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider text-right">Rating</th>
                                                <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider">Oportunidade</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {report.segmentBreakdown.map((seg) => {
                                                const oppCfg = OPP_LEVEL_CONFIG[seg.opportunityLevel] || OPP_LEVEL_CONFIG.media;
                                                return (
                                                    <tr key={seg.segment} className="border-b border-border/30 hover:bg-surface/50 transition-colors">
                                                        <td className="py-3 px-4 font-medium text-foreground capitalize">{seg.segment.replace(/_/g, ' ')}</td>
                                                        <td className="py-3 px-4 text-right tabular-nums text-foreground font-bold">{seg.count}</td>
                                                        <td className="py-3 px-4 text-right tabular-nums text-amber-400 font-bold">{seg.avgRating?.toFixed(1) ?? '—'}</td>
                                                        <td className="py-3 px-4">
                                                            <span className={`text-[10px] font-black px-2 py-1 rounded-full ${oppCfg.bg} ${oppCfg.color}`}>{oppCfg.label}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Top Opportunities with Score */}
                        {report.topOpportunities && report.topOpportunities.length > 0 && (
                            <div className="rounded-3xl bg-card border border-border p-6">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Target size={16} className="text-amber-400" /> Top 20 Leads com Score
                                </h3>
                                <p className="text-xs text-muted mb-4">Leads com maior potencial de conversão neste nicho/região.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2">
                                    {report.topOpportunities.map((opp) => (
                                        <div key={opp.id} className="p-4 bg-surface rounded-xl border border-border/50 flex flex-col gap-2 hover:border-emerald-500/30 transition-colors">
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
                                                {opp.scoreFactors?.noWebsite && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full"><Globe size={9} />Sem site</span>}
                                                {opp.scoreFactors?.noPhone && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full"><Phone size={9} />Sem tel</span>}
                                                {opp.scoreFactors?.fewReviews && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full"><MessageSquare size={9} />Reviews</span>}
                                                {opp.scoreFactors?.lowRating && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full"><Star size={9} />Rating</span>}
                                            </div>
                                            {opp.phone && <p className="text-[10px] text-muted flex items-center gap-1"><Phone size={10} />{opp.phone}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recommendations */}
                        <div className="rounded-3xl bg-card border border-border p-6">
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Lightbulb size={16} className="text-amber-400" /> Recomendações
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {report.recommendations.map((rec, i) => (
                                    <div key={`rec-${String(rec).slice(0, 80)}`} className="flex items-start gap-3 p-4 bg-surface rounded-xl border border-border/50">
                                        <span className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">{i + 1}</span>
                                        <p className="text-sm text-muted">{rec}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Locations */}
                        <div className="rounded-3xl bg-card border border-border p-6">
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                <MapPin size={16} className="text-violet-400" /> Melhores Localizações
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {report.bestLocations.map((loc) => (
                                    <span key={`loc-${String(loc).slice(0, 80)}`} className="px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-xl text-sm font-medium text-violet-400">{loc}</span>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
