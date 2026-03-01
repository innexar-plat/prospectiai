import { useState } from 'react';
import { Lock, Loader2, Search, Target, Globe, Star } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';
import type { SessionUser, CompetitorAnalysisResult } from '@/lib/api';
import { competitorApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { StatCard, PresenceBar, EmptyState } from '@/components/dashboard/shared/DashboardUI';

const UF_OPTIONS = ['', 'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

const BARRIER_CONFIG = {
    alto: { label: 'Barreira Alta', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', icon: '🛑' },
    medio: { label: 'Barreira Média', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: '⚡' },
    baixo: { label: 'Barreira Baixa', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: '✅' },
};

export default function ConcorrenciaPage() {
    const { user } = useOutletContext<{ user: SessionUser }>();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [query, setQuery] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<CompetitorAnalysisResult | null>(null);

    const hasAccess = user.plan === 'PRO' || user.plan === 'BUSINESS' || user.plan === 'SCALE';

    const handleAnalyze = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!query.trim()) return;
        setLoading(true);
        try {
            const textParts = [query];
            if (neighborhood.trim()) textParts.push(neighborhood.trim());
            if (city.trim()) textParts.push(city.trim());
            if (state.trim()) textParts.push(state.trim());
            const result = await competitorApi.analyze({
                textQuery: textParts.join(', '),
                city: city || undefined,
                state: state || undefined,
                pageSize: 60,
            });
            setData(result);
            window.dispatchEvent(new Event('refresh-user'));
            addToast('success', `Análise concluída: ${result.totalCount} concorrentes mapeados.`);
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : 'Erro ao analisar concorrência.');
        } finally {
            setLoading(false);
        }
    };

    if (!hasAccess) {
        return (
            <>
                <HeaderDashboard title="Análise de Concorrência" subtitle="Ranking e gaps vs concorrentes na sua região." breadcrumb="Prospecção Ativa / Concorrência" />
                <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
                    <EmptyState
                        icon={Lock}
                        title="Análise de Concorrência"
                        description="Descubra quem são seus concorrentes no raio, quem tem mais avaliações, quem não tem site ou redes sociais, e identifique oportunidades de venda reais."
                        actionLabel="Faça Upgrade para Growth"
                        onAction={() => navigate('/dashboard/configuracoes')}
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <HeaderDashboard title="Análise de Concorrência" subtitle="Ranking, playbook de ataque e oportunidades com IA." breadcrumb="Prospecção Ativa / Concorrência" />
            <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">

                {/* Search Form */}
                <div className="rounded-3xl bg-card border border-border p-6 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h3 className="text-lg font-bold text-foreground">Analisar Concorrência</h3>
                        <Link to="/dashboard/historico?tab=intelligence&module=COMPETITORS" className="text-sm text-violet-400 hover:text-violet-300 font-medium">
                            Ver histórico
                        </Link>
                    </div>
                    <form onSubmit={handleAnalyze} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex: pizzarias, salões de beleza..." className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50 sm:col-span-2" required />
                        <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
                        <select value={state} onChange={(e) => setState(e.target.value)} className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50">
                            <option value="">Estado (UF)</option>
                            {UF_OPTIONS.filter(Boolean).map((uf) => (<option key={uf} value={uf}>{uf}</option>))}
                        </select>
                        <input type="text" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Bairro (opcional)" className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50 sm:col-span-2" />
                        <Button type="submit" variant="primary" disabled={loading || !query.trim()} icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} className="h-12 px-6 rounded-xl font-bold whitespace-nowrap sm:col-span-2 lg:col-span-1">
                            {loading ? 'Analisando...' : 'Analisar Região'}
                        </Button>
                    </form>
                </div>

                {loading && (
                    <div className="flex flex-col items-center justify-center p-16 gap-4">
                        <Loader2 size={40} className="animate-spin text-violet-400" />
                        <p className="text-sm text-muted">Analisando concorrentes, scoring e gerando playbook com IA...</p>
                        <p className="text-xs text-muted/60">Isso pode levar até 30 segundos</p>
                    </div>
                )}

                {data && !loading && (
                    <>
                        {/* Overview Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            <StatCard value={data.totalCount} label="Concorrentes" color="violet" />
                            <StatCard value={data.avgRating != null ? Number(data.avgRating.toFixed(1)) : 0} label="Rating Médio" color="amber" suffix="★" />
                            <StatCard value={data.digitalPresence.withWebsite} label="Com Website" color="emerald" />
                            <StatCard value={data.digitalPresence.withPhone} label="Com Telefone" color="blue" />
                            <StatCard value={data.topOpportunities?.length ?? 0} label="Top Oportunidades" color="amber" />
                        </div>

                        {/* Entry Barrier + Market Summary */}
                        {data.aiPlaybook && (
                            <div className="rounded-3xl bg-card border border-border p-6">
                                <div className="flex flex-col sm:flex-row items-start gap-6">
                                    <div className={`shrink-0 px-5 py-3 rounded-2xl border font-black text-sm flex items-center gap-2 ${BARRIER_CONFIG[data.aiPlaybook.entryBarrier]?.bg || ''}`}>
                                        <span className="text-lg">{BARRIER_CONFIG[data.aiPlaybook.entryBarrier]?.icon}</span>
                                        <span className={BARRIER_CONFIG[data.aiPlaybook.entryBarrier]?.color}>{BARRIER_CONFIG[data.aiPlaybook.entryBarrier]?.label}</span>
                                    </div>
                                    <div className="space-y-2 flex-1">
                                        <p className="text-sm font-bold text-foreground">{data.aiPlaybook.entryBarrierExplanation}</p>
                                        <p className="text-sm text-muted leading-relaxed">{data.aiPlaybook.marketSummary}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Digital Presence */}
                        <div className="rounded-3xl bg-card border border-border p-6">
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
                                <Globe size={16} className="text-violet-400" /> Presença Digital na Região
                            </h3>
                            <div className="space-y-4">
                                <PresenceBar label="Possuem Website" count={data.digitalPresence.withWebsite} total={data.totalCount} color="bg-emerald-500" />
                                <PresenceBar label="Sem Website" count={data.digitalPresence.withoutWebsite} total={data.totalCount} color="bg-rose-500" />
                                <PresenceBar label="Possuem Telefone" count={data.digitalPresence.withPhone} total={data.totalCount} color="bg-blue-500" />
                                <PresenceBar label="Sem Telefone" count={data.digitalPresence.withoutPhone} total={data.totalCount} color="bg-orange-500" />
                            </div>
                        </div>

                        {/* Rankings */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="rounded-3xl bg-card border border-border p-6">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Star size={16} className="text-amber-400" /> Top 10 por Avaliação
                                </h3>
                                <div className="space-y-2">
                                    {data.rankingByRating.map((entry) => (
                                        <div key={entry.id} className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border/50">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${entry.position <= 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-surface text-muted'}`}>{entry.position}</div>
                                            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{entry.name}</p></div>
                                            <div className="flex items-center gap-1 text-sm font-bold text-amber-400"><Star size={14} fill="currentColor" />{entry.rating?.toFixed(1)}</div>
                                        </div>
                                    ))}
                                    {data.rankingByRating.length === 0 && <p className="text-sm text-muted text-center py-4">Sem dados suficientes</p>}
                                </div>
                            </div>
                            <div className="rounded-3xl bg-card border border-border p-6">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <MessageSquare size={16} className="text-blue-400" /> Top 10 por Volume de Avaliações
                                </h3>
                                <div className="space-y-2">
                                    {data.rankingByReviews.map((entry) => (
                                        <div key={entry.id} className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border/50">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${entry.position <= 3 ? 'bg-blue-500/20 text-blue-400' : 'bg-surface text-muted'}`}>{entry.position}</div>
                                            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{entry.name}</p></div>
                                            <span className="text-sm font-bold text-blue-400 tabular-nums">{entry.reviewCount?.toLocaleString('pt-BR')}</span>
                                        </div>
                                    ))}
                                    {data.rankingByReviews.length === 0 && <p className="text-sm text-muted text-center py-4">Sem dados suficientes</p>}
                                </div>
                            </div>
                        </div>

                        {/* Top Opportunities with Score */}
                        {data.topOpportunities && data.topOpportunities.length > 0 && (
                            <div className="rounded-3xl bg-card border border-border p-6">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Target size={16} className="text-amber-400" /> Top Oportunidades (Score de Oportunidade)
                                </h3>
                                <p className="text-xs text-muted mb-4">Empresas com maior potencial de conversão. Score maior = mais fácil de fechar.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-2">
                                    {data.topOpportunities.map((opp) => (
                                        <div key={opp.id} className="p-4 bg-surface rounded-xl border border-border/50 flex flex-col gap-2 hover:border-violet-500/30 transition-colors">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-bold text-foreground truncate flex-1">{opp.name}</p>
                                                <span className={`shrink-0 text-xs font-black px-2 py-0.5 rounded-full ${(() => {
                                                    if (opp.score >= 60) return 'bg-emerald-500/20 text-emerald-400';
                                                    if (opp.score >= 35) return 'bg-amber-500/20 text-amber-400';
                                                    return 'bg-surface text-muted';
                                                })()}`}>
                                                    {opp.score}
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-card rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-500 ${(() => {
                                                    if (opp.score >= 60) return 'bg-emerald-500';
                                                    if (opp.score >= 35) return 'bg-amber-500';
                                                    return 'bg-surface';
                                                })()}`} style={{ width: `${opp.score}%` }} />
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {opp.scoreFactors.noWebsite && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full"><Globe size={9} />Sem site</span>}
                                                {opp.scoreFactors.noPhone && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full"><Phone size={9} />Sem tel</span>}
                                                {opp.scoreFactors.fewReviews && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full"><MessageSquare size={9} />Poucas reviews</span>}
                                                {opp.scoreFactors.lowRating && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full"><Star size={9} />Rating baixo</span>}
                                            </div>
                                            {opp.phone && <p className="text-[10px] text-muted flex items-center gap-1"><Phone size={10} />{opp.phone}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AI Playbook */}
                        {data.aiPlaybook && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="rounded-3xl bg-card border border-border p-6">
                                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Shield size={16} className="text-violet-400" /> SEO Local — Checklist
                                    </h3>
                                    <ul className="space-y-2.5">
                                        {data.aiPlaybook.seoChecklist.map((item) => (
                                            <li key={`seo-${String(item).slice(0, 80)}`} className="flex items-start gap-2 text-sm text-muted">
                                                <CheckCircle2 size={14} className="text-violet-400 shrink-0 mt-0.5" />{item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="rounded-3xl bg-card border border-border p-6">
                                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Star size={16} className="text-amber-400" /> Estratégia de Reviews
                                    </h3>
                                    <ul className="space-y-2.5">
                                        {data.aiPlaybook.reviewStrategy.map((item) => (
                                            <li key={`review-${String(item).slice(0, 80)}`} className="flex items-start gap-2 text-sm text-muted">
                                                <CheckCircle2 size={14} className="text-amber-400 shrink-0 mt-0.5" />{item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="rounded-3xl bg-card border border-border p-6">
                                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Zap size={16} className="text-emerald-400" /> Quick Wins (24-72h)
                                    </h3>
                                    <ul className="space-y-2.5">
                                        {data.aiPlaybook.quickWins.map((item) => (
                                            <li key={`quick-${String(item).slice(0, 80)}`} className="flex items-start gap-2 text-sm text-muted">
                                                <Zap size={14} className="text-emerald-400 shrink-0 mt-0.5" />{item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Legacy Opportunities */}
                        {data.opportunities.length > 0 && (
                            <div className="rounded-3xl bg-card border border-border p-6">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-amber-400" /> Todas as Oportunidades de Venda
                                </h3>
                                <p className="text-xs text-muted mb-4">Empresas sem website ou telefone — potenciais clientes para serviços digitais.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2">
                                    {data.opportunities.map((opp) => (
                                        <div key={opp.id} className="p-3 bg-surface rounded-xl border border-border/50 flex flex-col gap-1.5">
                                            <p className="text-sm font-medium text-foreground truncate">{opp.name}</p>
                                            <div className="flex gap-2">
                                                {opp.missingWebsite && (<span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full"><Globe size={10} /> Sem site</span>)}
                                                {opp.missingPhone && (<span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full"><Phone size={10} /> Sem telefone</span>)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}

