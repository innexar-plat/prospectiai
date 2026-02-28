import { useState } from 'react';
import { Lock, Loader2, Search, TrendingUp, Globe, Phone, Layers, Lightbulb, Target, Brain, Star } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { SessionUser, MarketReport, ScoredPlace } from '@/lib/api';
import { searchApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';

const UF_OPTIONS = ['', 'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

const SATURATION_LABELS: Record<number, { text: string; color: string }> = {
  0: { text: 'Mercado Inexplorado', color: 'text-emerald-400' },
  1: { text: 'Baixíssima Saturação', color: 'text-emerald-400' },
  2: { text: 'Baixa Saturação', color: 'text-emerald-400' },
  3: { text: 'Saturação Moderada-Baixa', color: 'text-blue-400' },
  4: { text: 'Saturação Moderada', color: 'text-blue-400' },
  5: { text: 'Saturação Mediana', color: 'text-amber-400' },
  6: { text: 'Saturação Acima da Média', color: 'text-amber-400' },
  7: { text: 'Saturação Alta', color: 'text-orange-400' },
  8: { text: 'Saturação Muito Alta', color: 'text-rose-400' },
  9: { text: 'Mercado Super Saturado', color: 'text-rose-400' },
  10: { text: 'Mercado Saturado ao Extremo', color: 'text-rose-500' },
};

function getSaturationInfo(index: number) {
  const clamped = Math.min(10, Math.max(0, index));
  return SATURATION_LABELS[clamped] || SATURATION_LABELS[5];
}

export default function RelatoriosPage() {
  const { user } = useOutletContext<{ user: SessionUser }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<MarketReport | null>(null);

  const hasAccess = user.plan === 'BUSINESS' || user.plan === 'SCALE';

  const handleGenerate = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const textParts = [query];
      if (city.trim()) textParts.push(city.trim());
      if (state.trim()) textParts.push(state.trim());
      const result = await searchApi.marketReport({ textQuery: textParts.join(' em '), pageSize: 60 });
      setReport(result as MarketReport);
      window.dispatchEvent(new Event('refresh-user'));
      addToast('success', 'Relatório de mercado gerado!');
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao gerar relatório.');
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess) {
    return (
      <>
        <HeaderDashboard title="Inteligência de Mercado" subtitle="Análise profunda do seu nicho local." breadcrumb="Prospecção Ativa / Relatórios" />
        <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
          <div className="rounded-[2.4rem] bg-gradient-to-br from-violet-900/40 to-background border border-violet-500/20 p-12 flex flex-col items-center justify-center gap-6 min-h-[400px] text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-violet-500/10 blur-[100px] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none" />
            <div className="w-20 h-20 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center relative z-10">
              <Lock size={32} className="text-violet-400" />
            </div>
            <div className="space-y-2 relative z-10 max-w-xl">
              <h2 className="text-2xl font-black text-foreground">Inteligência de Mercado</h2>
              <p className="text-muted leading-relaxed">
                Descubra a saturação do mercado, segmentos dominantes, maturidade digital e tendências da sua região.
              </p>
            </div>
            <Button variant="primary" onClick={() => navigate('/dashboard/configuracoes')} className="mt-4 min-h-[56px] px-8 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/25 border-0 transition-all hover:-translate-y-0.5 relative z-10">
              Faça Upgrade para Enterprise
            </Button>
          </div>
        </div>
      </>
    );
  }

  const satInfo = report ? getSaturationInfo(report.saturationIndex) : null;

  return (
    <>
      <HeaderDashboard title="Inteligência de Mercado" subtitle="Saturação, segmentos, oportunidades e insights com IA." breadcrumb="Prospecção Ativa / Relatórios" />
      <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">

        {/* Search */}
        <div className="rounded-3xl bg-card border border-border p-6 sm:p-8">
          <h3 className="text-lg font-bold text-foreground mb-4">Gerar Relatório de Mercado</h3>
          <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tipo de negócio (ex: restaurantes, academias...)" className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50 sm:col-span-2" required />
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

        {loading && (
          <div className="flex flex-col items-center justify-center p-16 gap-4">
            <Loader2 size={40} className="animate-spin text-violet-400" />
            <p className="text-sm text-muted">Coletando dados, analisando segmentos e gerando insights com IA...</p>
            <p className="text-xs text-muted/60">Isso pode levar até 30 segundos</p>
          </div>
        )}

        {report && !loading && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-card border border-border p-5 flex flex-col items-center text-center gap-1">
                <div className="text-3xl font-black text-violet-400 tabular-nums">{report.totalBusinesses}</div>
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Negócios</div>
              </div>
              <div className="rounded-2xl bg-card border border-border p-5 flex flex-col items-center text-center gap-1">
                <div className="text-3xl font-black text-blue-400 tabular-nums">{report.segments.length}</div>
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Segmentos</div>
              </div>
              <div className="rounded-2xl bg-card border border-border p-5 flex flex-col items-center text-center gap-1">
                <div className="text-3xl font-black text-amber-400 tabular-nums">{report.avgRating?.toFixed(1) ?? '—'}<span className="text-lg">★</span></div>
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Rating Médio</div>
              </div>
              <div className="rounded-2xl bg-card border border-border p-5 flex flex-col items-center text-center gap-2 relative overflow-hidden">
                <div className={`text-3xl font-black tabular-nums ${satInfo?.color}`}>{report.saturationIndex}</div>
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Saturação</div>
                <span className={`text-[9px] font-bold ${satInfo?.color}`}>{satInfo?.text}</span>
              </div>
            </div>

            {/* AI Insights */}
            {report.aiInsights && (
              <div className="rounded-3xl bg-gradient-to-br from-card to-surface border border-border p-6">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Brain size={16} className="text-violet-400" /> Análise Executiva com IA
                </h3>
                <p className="text-sm text-muted leading-relaxed mb-5">{report.aiInsights.executiveSummary}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-surface rounded-xl border border-border/50">
                    <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <TrendingUp size={12} /> Tendências
                    </h4>
                    <ul className="space-y-2">
                      {report.aiInsights.marketTrends.map((t, i) => (
                        <li key={i} className="text-xs text-muted flex items-start gap-2"><span className="text-violet-400 shrink-0 mt-0.5">→</span>{t}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 bg-surface rounded-xl border border-border/50">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Target size={12} /> Oportunidades
                    </h4>
                    <ul className="space-y-2">
                      {report.aiInsights.opportunities.map((o, i) => (
                        <li key={i} className="text-xs text-muted flex items-start gap-2"><span className="text-emerald-400 shrink-0 mt-0.5">→</span>{o}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 bg-surface rounded-xl border border-border/50">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Lightbulb size={12} /> Recomendações
                    </h4>
                    <ul className="space-y-2">
                      {report.aiInsights.recommendations.map((r, i) => (
                        <li key={i} className="text-xs text-muted flex items-start gap-2"><span className="text-amber-400 shrink-0 mt-0.5">→</span>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Digital Maturity */}
            <div className="rounded-3xl bg-card border border-border p-6">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" /> Maturidade Digital da Região
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <AnimatedBar icon={<Globe size={16} className="text-emerald-400" />} label="Possuem Website" count={report.digitalMaturity.withWebsite} total={report.digitalMaturity.total} pct={report.digitalMaturity.withWebsitePercent} color="bg-emerald-500" />
                <AnimatedBar icon={<Phone size={16} className="text-blue-400" />} label="Possuem Telefone" count={report.digitalMaturity.withPhone} total={report.digitalMaturity.total} pct={report.digitalMaturity.withPhonePercent} color="bg-blue-500" />
              </div>
            </div>

            {/* Top Opportunities */}
            {report.topOpportunities && report.topOpportunities.length > 0 && (
              <div className="rounded-3xl bg-card border border-border p-6">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Target size={16} className="text-amber-400" /> Top Oportunidades com Score
                </h3>
                <p className="text-xs text-muted mb-4">Leads com maior potencial de oportunidade comercial neste mercado.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-2">
                  {report.topOpportunities.map((opp: ScoredPlace) => (
                    <div key={opp.id} className="p-3 bg-surface rounded-xl border border-border/50 flex flex-col gap-2 hover:border-violet-500/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-foreground truncate flex-1">{opp.name}</p>
                        <span className={`shrink-0 text-xs font-black px-2 py-0.5 rounded-full ${opp.score >= 60 ? 'bg-emerald-500/20 text-emerald-400' : opp.score >= 35 ? 'bg-amber-500/20 text-amber-400' : 'bg-surface text-muted'}`}>
                          {opp.score}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-card rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${opp.score >= 60 ? 'bg-emerald-500' : opp.score >= 35 ? 'bg-amber-500' : 'bg-surface'}`} style={{ width: `${opp.score}%` }} />
                      </div>
                      {opp.rating != null && <p className="text-[10px] text-muted flex items-center gap-1"><Star size={10} className="text-amber-400" />{opp.rating?.toFixed(1)}★ · {opp.reviewCount ?? 0} reviews</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Segments Table */}
            <div className="rounded-3xl bg-card border border-border p-6">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Layers size={16} className="text-violet-400" /> Segmentos Encontrados
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider">#</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider">Tipo</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider text-right">Quantidade</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider text-right">Rating Médio</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-muted uppercase tracking-wider">Participação</th>
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
                          <td className="py-3 px-4 text-right tabular-nums text-amber-400 font-bold">{seg.avgRating?.toFixed(1) ?? '—'}</td>
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
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ─── Animated Bar Component ────────────────────────────────────────────────── */

function AnimatedBar({ icon, label, count, total, pct, color }: { icon: React.ReactNode; label: string; count: number; total: number; pct: number; color: string }) {
  return (
    <div className="p-5 bg-surface rounded-2xl border border-border">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm font-bold text-foreground">{label}</span>
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-3xl font-black text-foreground tabular-nums">{pct}%</span>
        <span className="text-xs text-muted tabular-nums">{count} de {total}</span>
      </div>
      <div className="w-full h-3 bg-card rounded-full overflow-hidden border border-border/50">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
