import { useState, useCallback } from "react";
import {
    Search, Clock, Settings, MapPin, Sparkles,
    SlidersHorizontal, LogOut, ChevronRight,
    BarChart3, Target, Zap, Loader2, AlertCircle
} from "lucide-react";
import { type SessionUser, type Place, authApi, searchApi } from "@/lib/api";
import { getPlanDisplayName } from "@/lib/billing-config";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/brand/Logo";

const SIDEBAR_ITEMS = [
    { id: 'busca', icon: Search, label: 'Nova Busca' },
    { id: 'historico', icon: Clock, label: 'Histórico' },
    { id: 'leads', icon: Target, label: 'Leads Salvos' },
    { id: 'listas', icon: Target, label: 'Listas' },
    { id: 'relatorios', icon: BarChart3, label: 'Relatórios' },
] as const;

const NICHE_OPTIONS = ['SaaS', 'Tecnologia', 'Vendas', 'Marketing', 'E-commerce', 'Serviços'];
const VOLUME_OPTIONS = [10, 20, 50, 100] as const;

export default function Dashboard({ user }: { user: SessionUser }) {
    const [activeNav, setActiveNav] = useState<string>('busca');
    const [volume, setVolume] = useState<number>(20);
    const [radiusKm, setRadiusKm] = useState(20);
    const [niches, setNiches] = useState<string[]>(['SaaS', 'Tecnologia', 'Vendas']);
    const [advancedTerm, setAdvancedTerm] = useState('');
    const [searchState, setSearchState] = useState<{
        loading: boolean;
        error: string | null;
        places: Place[] | null;
    }>({ loading: false, error: null, places: null });

    const handleLogout = async () => {
        await authApi.signOut();
        window.location.href = '/auth/signin';
    };

    const toggleNiche = (n: string) => {
        setNiches(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);
    };

    const startSearch = useCallback(async () => {
        const textQuery = advancedTerm.trim()
            || `empresas ${niches.join(' ')} Brasil`;
        setSearchState({ loading: true, error: null, places: null });
        try {
            const res = await searchApi.search({
                textQuery,
                pageSize: volume,
            });
            setSearchState({ loading: false, error: null, places: res.places ?? [] });
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Erro ao buscar';
            setSearchState({
                loading: false,
                error: message,
                places: null,
            });
        }
    }, [advancedTerm, niches, volume]);

    return (
        <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
            {/* SIDEBAR - visual original */}
            <aside className="w-72 min-w-[288px] bg-card border-r border-border flex flex-col relative overflow-hidden hidden md:flex">
                <div className="p-8 z-10 relative">
                    <div className="mb-12">
                        <Logo iconSize={40} iconOnly={false} className="gap-3" textClassName="font-black text-xl tracking-tighter" />
                    </div>
                    <nav className="space-y-2">
                        {SIDEBAR_ITEMS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    if (item.id === 'busca') setActiveNav('busca');
                                    else window.alert('Em breve: ' + item.label);
                                }}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group ${activeNav === item.id
                                    ? 'bg-violet-600/10 text-violet-400 border border-violet-500/20 shadow-lg'
                                    : 'text-muted hover:text-foreground hover:bg-surface'
                                    }`}
                            >
                                <div className="flex items-center gap-4 font-bold text-sm">
                                    <item.icon size={20} />
                                    {item.label}
                                </div>
                                {activeNav === item.id && <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="mt-auto p-6 z-10 relative">
                    <div className="p-6 rounded-[2rem] bg-surface border border-border space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                            <span>Créditos ({getPlanDisplayName(user.plan)})</span>
                            <span className="text-violet-400">{user.leadsUsed}/{user.leadsLimit}</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                            <div
                                className="h-full bg-violet-600 rounded-full shadow-[0_0_10px_rgba(139,92,246,0.5)] transition-all duration-1000"
                                style={{ width: `${(user.leadsUsed / user.leadsLimit) * 100}%` }}
                            />
                        </div>
                        <div className="flex items-center gap-3 pt-4 border-t border-border">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-sm text-white">
                                {user.name?.[0] || user.email?.[0] || 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate text-foreground">{user.name || 'Usuário'}</p>
                                <p className="text-[10px] text-muted font-bold uppercase truncate tracking-widest">{getPlanDisplayName(user.plan)}</p>
                            </div>
                            <button type="button" onClick={handleLogout} className="text-muted hover:text-red-400 transition-colors p-2 hover:bg-red-500/10 rounded-xl" aria-label="Sair">
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>
                </div>
                <div className="absolute -left-20 bottom-0 opacity-5 select-none pointer-events-none text-[300px] font-black leading-none tracking-tighter">P</div>
            </aside>

            <main className="flex-1 flex flex-col overflow-y-auto relative">
                <div className="absolute top-0 right-0 w-[600px] h-[300px] bg-violet-600/5 blur-[120px] rounded-full pointer-events-none" />

                <header className="px-8 top-0 sticky bg-background/80 backdrop-blur-3xl z-30 border-b border-border pt-10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 bg-violet-600/10 border border-violet-500/20 text-violet-400 text-[10px] font-black tracking-widest uppercase rounded-full">Prospecção Ativa</span>
                            <span className="text-muted text-xs font-bold">/</span>
                            <span className="text-muted text-xs font-bold">Nova Busca</span>
                        </div>
                        <h1 className="text-4xl font-black text-foreground mb-1 tracking-tighter">Parâmetros de Busca</h1>
                        <p className="text-sm text-muted font-medium">
                            Configure seu público-alvo e nossa <span className="text-violet-500 font-bold">IA</span> fará o resto.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <Button variant="secondary" size="sm" className="text-xs font-bold hidden sm:flex" icon={<Clock size={16} />}>
                            Histórico
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            className="flex-1 md:flex-none shadow-violet-600/20"
                            icon={searchState.loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                            onClick={startSearch}
                            disabled={searchState.loading}
                        >
                            {searchState.loading ? 'Buscando...' : 'Iniciar Busca'}
                        </Button>
                    </div>
                </header>

                <div className="p-8 max-w-6xl mx-auto w-full space-y-8 animate-fade">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* LOCALIZAÇÃO CARD */}
                        <div className="group p-1 rounded-[2.5rem] bg-gradient-to-br from-foreground/10 to-transparent hover:from-violet-500/20 transition-all duration-500">
                            <div className="bg-card p-8 rounded-[2.4rem] h-full space-y-8">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-violet-600/10 flex items-center justify-center text-violet-400">
                                            <MapPin size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-xl">Localização</h3>
                                            <p className="text-xs text-muted font-bold uppercase tracking-widest">Geografia do Lead</p>
                                        </div>
                                    </div>
                                    <button type="button" className="text-muted hover:text-foreground transition-colors">
                                        <Settings size={20} />
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    <div className="p-5 rounded-3xl bg-surface border border-border hover:border-violet-500/30 transition-all cursor-pointer group/item flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl">🇧🇷</span>
                                            <div>
                                                <p className="text-xs font-black text-muted uppercase tracking-widest">País Selecionado</p>
                                                <p className="font-bold">Brasil</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-muted group-hover/item:text-violet-400 transition-colors" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-5 rounded-3xl bg-surface border border-border hover:border-violet-500/30 transition-all cursor-pointer">
                                            <p className="text-xs font-black text-muted uppercase tracking-widest mb-1">Estado</p>
                                            <p className="font-bold text-muted italic">Todos</p>
                                        </div>
                                        <div className="p-5 rounded-3xl bg-surface border border-border hover:border-violet-500/30 transition-all cursor-pointer">
                                            <p className="text-xs font-black text-muted uppercase tracking-widest mb-1">Cidade</p>
                                            <p className="font-bold text-muted italic">Opcional</p>
                                        </div>
                                    </div>
                                    <div className="p-5 rounded-3xl bg-surface border border-border">
                                        <div className="flex justify-between items-center mb-4">
                                            <p className="text-xs font-black text-muted uppercase tracking-widest">Raio de Busca</p>
                                            <span className="text-violet-400 font-black text-sm">{radiusKm} km</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={5}
                                            max={100}
                                            step={5}
                                            value={radiusKm}
                                            onChange={(e) => setRadiusKm(Number(e.target.value))}
                                            className="w-full h-1.5 bg-surface rounded-full appearance-none accent-violet-600"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* INTELIGÊNCIA CARD */}
                        <div className="group p-1 rounded-[2.5rem] bg-gradient-to-br from-white/10 to-transparent hover:from-cyan-500/20 transition-all duration-500">
                            <div className="bg-card p-8 rounded-[2.4rem] h-full space-y-8">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-cyan-600/10 flex items-center justify-center text-cyan-400">
                                            <Sparkles size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-xl">Inteligência</h3>
                                            <p className="text-xs text-muted font-bold uppercase tracking-widest">Nicho e Termos</p>
                                        </div>
                                    </div>
                                    <button type="button" className="text-muted hover:text-foreground transition-colors">
                                        <SlidersHorizontal size={20} />
                                    </button>
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Nicho / Segmento</label>
                                        <div className="flex flex-wrap gap-2">
                                            {NICHE_OPTIONS.map((tag) => (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => toggleNiche(tag)}
                                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${niches.includes(tag)
                                                        ? 'bg-violet-600/10 border-violet-500/20 text-violet-400'
                                                        : 'bg-surface border-border text-muted hover:text-foreground hover:border-border'
                                                    }`}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                            <button type="button" className="px-4 py-2 bg-violet-600/10 border border-violet-500/20 rounded-xl text-xs font-black text-violet-400 hover:bg-violet-600/20">+ Adicionar</button>
                                        </div>
                                    </div>
                                    <div className="p-5 rounded-3xl bg-surface border border-border">
                                        <div className="flex justify-between items-center mb-4">
                                            <p className="text-xs font-black text-muted uppercase tracking-widest">Volume de Resultados</p>
                                            <span className="text-cyan-400 font-black text-sm">Top {volume}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {VOLUME_OPTIONS.map((v) => (
                                                <button
                                                    key={v}
                                                    type="button"
                                                    onClick={() => setVolume(v)}
                                                    className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${v === volume ? 'bg-cyan-600 text-white' : 'bg-surface text-muted hover:bg-surface'}`}
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Termo de Pesquisa Avançada</label>
                                        <div className="p-4 rounded-2xl bg-surface border border-border">
                                            <Input
                                                placeholder="Ex: Empresas de logistica em São Paulo com foco em e-commerce..."
                                                value={advancedTerm}
                                                onChange={(e) => setAdvancedTerm(e.target.value)}
                                                className="rounded-2xl text-sm border-0 bg-transparent p-0 focus-visible:ring-0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {searchState.error && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
                            <AlertCircle size={20} />
                            <span className="text-sm font-medium">{searchState.error}</span>
                        </div>
                    )}
                    {searchState.places && (
                        <div className="p-6 rounded-[2.4rem] bg-card border border-border">
                            <h3 className="font-bold text-foreground mb-3">
                                {searchState.places.length} resultado(s) encontrado(s)
                            </h3>
                            <ul className="space-y-2 max-h-60 overflow-y-auto">
                                {searchState.places.slice(0, 20).map((p) => (
                                    <li key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                                        <span className="font-medium truncate pr-2">{p.displayName?.text ?? p.id}</span>
                                        <span className="text-muted text-xs shrink-0">{p.formattedAddress ?? '—'}</span>
                                    </li>
                                ))}
                            </ul>
                            {searchState.places.length > 20 && (
                                <p className="text-xs text-muted mt-2">Mostrando 20 de {searchState.places.length}</p>
                            )}
                        </div>
                    )}

                    {/* ACTION FOOTER - visual original */}
                    <div className="p-8 rounded-[3rem] bg-gradient-to-r from-violet-600 to-indigo-700 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                        <div className="relative z-10 flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[2rem] bg-white/10 backdrop-blur-xl flex items-center justify-center text-white">
                                <Zap size={32} className="fill-current" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white mb-1">Pronto para prospectar?</h3>
                                <p className="text-foreground font-bold">Estimamos <span className="text-white underline decoration-2 decoration-muted underline-offset-4">1.5M+ empresas</span> na sua região.</p>
                            </div>
                        </div>
                        <div className="relative z-10 flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1">Custo Estimado</p>
                                <p className="text-xl font-black text-foreground">20 Créditos</p>
                            </div>
                            <Button
                                variant="secondary"
                                size="lg"
                                className="bg-white text-violet-600 h-16 px-10 text-lg hover:bg-white/90 hover:scale-105 border-0 font-black"
                                onClick={startSearch}
                                disabled={searchState.loading}
                                icon={searchState.loading ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />}
                            >
                                {searchState.loading ? 'Buscando...' : 'Iniciar Busca IA'}
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
