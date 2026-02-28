import { useState } from 'react';
import { Lock, Loader2, Search, Link as LinkIcon, Star, AlertTriangle, CheckCircle2, Lightbulb, Share2, User, Globe } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';
import type { SessionUser, CompanyAnalysisReport } from '@/lib/api';
import { companyAnalysisApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';

const UF_OPTIONS = ['', 'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

type AnalysisMode = 'profile' | 'search';

export default function MinhaEmpresaPage() {
    const { user } = useOutletContext<{ user: SessionUser }>();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [mode, setMode] = useState<AnalysisMode>('profile');
    const [companyName, setCompanyName] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [searchCompanyName, setSearchCompanyName] = useState('');
    const [searchCity, setSearchCity] = useState('');
    const [searchState, setSearchState] = useState('');
    const [searchProductService, setSearchProductService] = useState('');
    const [searchWebsiteUrl, setSearchWebsiteUrl] = useState('');
    const [searchLinkedInUrl, setSearchLinkedInUrl] = useState('');
    const [searchInstagramUrl, setSearchInstagramUrl] = useState('');
    const [searchFacebookUrl, setSearchFacebookUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<CompanyAnalysisReport | null>(null);

    const hasAccess = user.plan === 'BUSINESS' || user.plan === 'SCALE';
    const workspaceName = user.companyName ?? '';
    const profileEmpty = !workspaceName?.trim();

    const canSubmitProfile = !profileEmpty || companyName.trim().length > 0;
    const canSubmitSearch = searchCompanyName.trim().length > 0;
    const canSubmit = mode === 'profile' ? canSubmitProfile : canSubmitSearch;

    const handleAnalyze = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!canSubmit) return;
        setLoading(true);
        setReport(null);
        try {
            const body =
                mode === 'profile'
                    ? {
                          useProfile: true,
                          companyName: companyName.trim() || undefined,
                          city: city.trim() || undefined,
                          state: state || undefined,
                      }
                    : {
                          useProfile: false,
                          companyName: searchCompanyName.trim(),
                          city: searchCity.trim() || undefined,
                          state: searchState || undefined,
                          productService: searchProductService.trim() || undefined,
                          websiteUrl: searchWebsiteUrl.trim() || undefined,
                          linkedInUrl: searchLinkedInUrl.trim() || undefined,
                          instagramUrl: searchInstagramUrl.trim() || undefined,
                          facebookUrl: searchFacebookUrl.trim() || undefined,
                      };
            const result = await companyAnalysisApi.run(body);
            setReport(result);
            addToast('success', 'Análise concluída!');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Erro ao gerar análise.';
            addToast('error', message);
        } finally {
            setLoading(false);
        }
    };

    if (!hasAccess) {
        return (
            <>
                <HeaderDashboard title="Análise da minha empresa" subtitle="Diagnóstico com Reclame Aqui, Google e redes sociais." breadcrumb="Inteligência / Minha empresa" />
                <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
                    <div className="rounded-[2.4rem] bg-gradient-to-br from-violet-900/30 via-emerald-900/20 to-background border border-violet-500/20 p-12 flex flex-col items-center justify-center gap-6 min-h-[400px] text-center shadow-2xl relative overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-violet-500/10 blur-[100px] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none" />
                        <div className="w-20 h-20 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center relative z-10">
                            <Lock size={32} className="text-violet-400" />
                        </div>
                        <div className="space-y-2 relative z-10 max-w-xl">
                            <h2 className="text-2xl font-black text-foreground">Análise da minha empresa</h2>
                            <p className="text-muted leading-relaxed">
                                A IA analisa <span className="text-violet-400 font-bold">Reclame Aqui</span>, avaliações Google,
                                <span className="text-violet-400 font-bold"> redes sociais</span> (link + dados públicos) e sugere nicho e modelo de negócio.
                            </p>
                        </div>
                        <Button variant="primary" onClick={() => navigate('/dashboard/planos')} className="mt-4 min-h-[56px] px-8 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 shadow-lg shadow-violet-500/25 border-0 relative z-10">
                            Faça upgrade para acessar
                        </Button>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <HeaderDashboard title="Análise da minha empresa" subtitle="Diagnóstico com Reclame Aqui, Google, redes sociais e IA." breadcrumb="Inteligência / Minha empresa" />
            <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">

                <div className="rounded-3xl bg-card border border-border p-6 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h3 className="text-lg font-bold text-foreground">Gerar análise da empresa</h3>
                        <Link to="/dashboard/historico?tab=intelligence&module=MY_COMPANY" className="text-sm text-violet-400 hover:text-violet-300 font-medium">
                            Ver histórico
                        </Link>
                    </div>
                    <p className="text-xs text-muted mb-4">
                        Use o <strong>perfil da empresa</strong> (dados salvos em Empresa) ou <strong>pesquise por nome e cidade</strong> para analisar com dados informados aqui, sem depender do perfil.
                    </p>

                    <div className="flex gap-2 mb-6 p-1 rounded-xl bg-surface border border-border w-fit">
                        <button
                            type="button"
                            onClick={() => setMode('profile')}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${mode === 'profile' ? 'bg-violet-500/20 text-violet-400' : 'text-muted hover:text-foreground'}`}
                        >
                            <User size={16} />
                            Usar perfil da empresa
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('search')}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${mode === 'search' ? 'bg-violet-500/20 text-violet-400' : 'text-muted hover:text-foreground'}`}
                        >
                            <Globe size={16} />
                            Pesquisar por nome e cidade
                        </button>
                    </div>

                    {mode === 'profile' && (
                        <>
                            {profileEmpty && (
                                <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-muted">
                                    <p className="font-bold text-foreground mb-1">Preencha o perfil da empresa</p>
                                    <p className="mb-3">Informe o nome da empresa (e opcionalmente produto/serviço e redes) em Empresa para que a análise use seus dados.</p>
                                    <Link to="/dashboard/empresa" className="inline-flex items-center gap-1.5 text-violet-400 font-bold hover:underline">
                                        Ir para Perfil da empresa
                                    </Link>
                                </div>
                            )}
                            {!profileEmpty && (
                                <p className="text-sm text-muted mb-4">
                                    Perfil atual: <span className="font-bold text-foreground">{workspaceName}</span>
                                </p>
                            )}
                            <form onSubmit={handleAnalyze} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <input
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder={profileEmpty ? 'Nome da empresa (obrigatório)' : 'Sobrescrever nome (opcional)'}
                                    className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50 sm:col-span-2"
                                />
                                <input
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    placeholder="Cidade (opcional, para Google)"
                                    className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                />
                                <select
                                    value={state}
                                    onChange={(e) => setState(e.target.value)}
                                    className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                >
                                    <option value="">Estado (UF)</option>
                                    {UF_OPTIONS.filter(Boolean).map((uf) => (
                                        <option key={uf} value={uf}>{uf}</option>
                                    ))}
                                </select>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={loading || !canSubmit}
                                    icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                                    className="h-12 px-6 rounded-xl font-bold whitespace-nowrap bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 shadow-lg shadow-violet-500/25 border-0 sm:col-span-2 lg:col-span-4"
                                >
                                    {loading ? 'Gerando análise...' : 'Gerar análise'}
                                </Button>
                            </form>
                        </>
                    )}

                    {mode === 'search' && (
                        <form onSubmit={handleAnalyze} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <input
                                    value={searchCompanyName}
                                    onChange={(e) => setSearchCompanyName(e.target.value)}
                                    placeholder="Nome da empresa (obrigatório)"
                                    className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50 sm:col-span-2"
                                    required
                                />
                                <input
                                    value={searchCity}
                                    onChange={(e) => setSearchCity(e.target.value)}
                                    placeholder="Cidade (opcional)"
                                    className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                />
                                <select
                                    value={searchState}
                                    onChange={(e) => setSearchState(e.target.value)}
                                    className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                >
                                    <option value="">Estado (UF)</option>
                                    {UF_OPTIONS.filter(Boolean).map((uf) => (
                                        <option key={uf} value={uf}>{uf}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <input
                                    value={searchProductService}
                                    onChange={(e) => setSearchProductService(e.target.value)}
                                    placeholder="Produto/serviço (opcional)"
                                    className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                />
                                <input
                                    value={searchWebsiteUrl}
                                    onChange={(e) => setSearchWebsiteUrl(e.target.value)}
                                    placeholder="Site (opcional)"
                                    type="url"
                                    className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <input
                                    value={searchLinkedInUrl}
                                    onChange={(e) => setSearchLinkedInUrl(e.target.value)}
                                    placeholder="LinkedIn (opcional)"
                                    type="url"
                                    className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                />
                                <input
                                    value={searchInstagramUrl}
                                    onChange={(e) => setSearchInstagramUrl(e.target.value)}
                                    placeholder="Instagram (opcional)"
                                    type="url"
                                    className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                />
                                <input
                                    value={searchFacebookUrl}
                                    onChange={(e) => setSearchFacebookUrl(e.target.value)}
                                    placeholder="Facebook (opcional)"
                                    type="url"
                                    className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                />
                            </div>
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={loading || !canSubmit}
                                icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                                className="h-12 px-6 rounded-xl font-bold whitespace-nowrap bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 shadow-lg shadow-violet-500/25 border-0"
                            >
                                {loading ? 'Gerando análise...' : 'Gerar análise'}
                            </Button>
                        </form>
                    )}
                </div>

                {loading && (
                    <div className="flex flex-col items-center justify-center p-16 gap-4">
                        <Loader2 size={40} className="animate-spin text-violet-400" />
                        <p className="text-sm text-muted">Buscando Reclame Aqui, avaliações, redes sociais e gerando relatório...</p>
                        <p className="text-xs text-muted/60">Isso pode levar até 60 segundos</p>
                    </div>
                )}

                {report && !loading && (
                    <>
                        <div className="rounded-3xl bg-gradient-to-br from-card to-surface border border-border p-6 sm:p-8">
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">Resumo</h3>
                            <p className="text-muted leading-relaxed">{report.summary}</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="rounded-3xl bg-card border border-border p-6">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-400" /> Pontos fortes
                                </h3>
                                <ul className="space-y-2">
                                    {report.strengths.map((s) => (
                                        <li key={`strength-${String(s).slice(0, 80)}`} className="flex items-start gap-2 text-sm text-muted">
                                            <span className="w-5 h-5 rounded bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                                <CheckCircle2 size={12} className="text-emerald-400" />
                                            </span>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="rounded-3xl bg-card border border-border p-6">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-amber-400" /> Pontos fracos
                                </h3>
                                <ul className="space-y-2">
                                    {report.weaknesses.map((w) => (
                                        <li key={`weak-${String(w).slice(0, 80)}`} className="flex items-start gap-2 text-sm text-muted">
                                            <span className="w-5 h-5 rounded bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                                <AlertTriangle size={12} className="text-amber-400" />
                                            </span>
                                            {w}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {report.opportunities.length > 0 && (
                            <div className="rounded-3xl bg-card border border-border p-6">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Lightbulb size={16} className="text-violet-400" /> Oportunidades
                                </h3>
                                <ul className="space-y-2">
                                    {report.opportunities.map((o, i) => (
                                        <li key={`opp-${String(o).slice(0, 80)}`} className="text-sm text-muted flex items-start gap-2">
                                            <span className="text-violet-400 font-bold shrink-0">{i + 1}.</span>
                                            {o}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {(report.reclameAquiSummary ?? report.googlePresenceScore != null) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {report.reclameAquiSummary && (
                                    <div className="rounded-2xl bg-card border border-border p-5">
                                        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Reclame Aqui</h4>
                                        <p className="text-sm text-muted">{report.reclameAquiSummary}</p>
                                    </div>
                                )}
                                {report.googlePresenceScore != null && (
                                    <div className="rounded-2xl bg-card border border-border p-5 flex flex-col gap-2">
                                        <h4 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                                            <Star size={12} className="text-amber-400" /> Presença Google
                                        </h4>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-foreground">{report.googlePresenceScore}</span>
                                            <span className="text-muted">/10</span>
                                        </div>
                                        {report.googleRating != null && (
                                            <p className="text-sm text-muted">Nota: {report.googleRating} ({report.googleReviewCount ?? 0} avaliações)</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {report.socialNetworks?.presence && (
                            <div className="rounded-3xl bg-card border border-border p-6">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Share2 size={16} className="text-blue-400" /> Redes sociais
                                </h3>
                                <p className="text-sm text-muted mb-4">{report.socialNetworks.presence}</p>
                                {report.socialNetworks.perNetwork && report.socialNetworks.perNetwork.length > 0 && (
                                    <div className="space-y-3">
                                        {report.socialNetworks.perNetwork.map((n) => (
                                            <div key={`network-${n.network}-${n.link ?? ''}`} className="p-4 bg-surface rounded-xl border border-border/50">
                                                <p className="font-bold text-foreground text-sm mb-1">{n.network}</p>
                                                {n.link && <p className="text-xs text-muted flex items-center gap-1 mb-1"><LinkIcon size={10} /> {n.link}</p>}
                                                {n.found && <p className="text-sm text-muted mb-1">{n.found}</p>}
                                                {n.suggestions && <p className="text-xs text-violet-400">{n.suggestions}</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {report.socialNetworks.consistency && (
                                    <p className="text-sm text-muted mt-3 pt-3 border-t border-border">Consistência: {report.socialNetworks.consistency}</p>
                                )}
                                {report.socialNetworks.recommendations && report.socialNetworks.recommendations.length > 0 && (
                                    <ul className="mt-3 space-y-1 text-sm text-muted">
                                        {report.socialNetworks.recommendations.map((r) => (
                                            <li key={`rec-${String(r).slice(0, 80)}`}>• {r}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {(report.suggestedNiche || report.suggestedBusinessModel) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {report.suggestedNiche && (
                                    <div className="rounded-2xl bg-gradient-to-br from-violet-900/20 to-card border border-violet-500/20 p-5">
                                        <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">Nicho sugerido</h4>
                                        <p className="text-sm font-bold text-foreground">{report.suggestedNiche}</p>
                                    </div>
                                )}
                                {report.suggestedBusinessModel && (
                                    <div className="rounded-2xl bg-gradient-to-br from-emerald-900/20 to-card border border-emerald-500/20 p-5">
                                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Modelo de negócio sugerido</h4>
                                        <p className="text-sm font-bold text-foreground">{report.suggestedBusinessModel}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="rounded-3xl bg-card border border-border p-6">
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Lightbulb size={16} className="text-amber-400" /> Recomendações
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {report.recommendations.map((rec, i) => (
                                    <div key={`recommendation-${String(rec).slice(0, 80)}`} className="flex items-start gap-3 p-4 bg-surface rounded-xl border border-border/50">
                                        <span className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">{i + 1}</span>
                                        <p className="text-sm text-muted">{rec}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
