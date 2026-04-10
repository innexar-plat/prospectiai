import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useOutletContext, useSearchParams, Link } from 'react-router-dom';
import { Zap, Loader2, Sparkles, UtensilsCrossed, Scissors, Dumbbell, Stethoscope, ShoppingBag, Wrench, Building2, Scale, PawPrint, Heart, Hotel, Pill, GraduationCap, Globe, Phone, type LucideIcon, Megaphone, ShieldCheck, Laptop, Plane, HardHat, Coffee, Eye, Car, Pizza, BookOpen, Clock, ArrowRight } from 'lucide-react';
import { Target, Star, TrendingUp, Search as SearchIcon } from 'lucide-react';
import { leadsApi, searchApi, type LeadStats, type SearchHistoryItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { SearchFiltersRow } from '@/components/dashboard/SearchFiltersRow';
import { SearchSegmentRow } from '@/components/dashboard/SearchSegmentRow';
import { CnaeAutocomplete } from '@/components/dashboard/CnaeAutocomplete';
import { Button } from '@/components/ui/Button';
import { startSearch, validateSearchPayload, buildTextQuery } from '@/lib/searchService';
import { useToast } from '@/contexts/ToastContext';
import { useSearchResults } from '@/contexts/SearchResultsContext';
import { DEFAULT_SEARCH_VALUES } from '@/lib/searchFormSchema';
import type { SearchFormValues } from '@/lib/searchFormSchema';
import type { LocationFormValues } from '@/components/dashboard/SearchParamsLocationCard';
import type { IntelligenceFormValues } from '@/components/dashboard/SearchParamsIntelligenceCard';
import { getCountryLabel } from '@/lib/locationData';
import type { SessionUser } from '@/lib/api';
import { UpgradeCTAModal } from '@/components/dashboard/UpgradeCTAModal';

const MIN_ADVANCED_TERM = 3;

const QUICK_TEMPLATES: { label: string; icon: LucideIcon; niches: string[]; includedType?: string; cnaes?: string[] }[] = [
  { label: 'Restaurantes', icon: UtensilsCrossed, niches: ['restaurante'], includedType: 'restaurant', cnaes: ['5611201', '5611202', '5611203'] },
  { label: 'Salões de Beleza', icon: Scissors, niches: ['salão de beleza', 'barbearia'], includedType: 'beauty_salon', cnaes: ['9602501', '9602502'] },
  { label: 'Academias', icon: Dumbbell, niches: ['academia', 'fitness'], includedType: 'gym', cnaes: ['9313100', '9319101'] },
  { label: 'Clínicas', icon: Stethoscope, niches: ['clínica', 'consultório'], includedType: 'doctor', cnaes: ['8630501', '8630502', '8630503', '8630504'] },
  { label: 'Lojas', icon: ShoppingBag, niches: ['loja', 'comércio'], includedType: 'store', cnaes: ['4712100', '4713002', '4713004'] },
  { label: 'Oficinas', icon: Wrench, niches: ['oficina mecânica', 'auto center'], includedType: 'car_repair', cnaes: ['4520001', '4520002', '4520003'] },
  { label: 'Imobiliárias', icon: Building2, niches: ['imobiliária'], includedType: 'real_estate_agency', cnaes: ['6821801', '6821802'] },
  { label: 'Advogados', icon: Scale, niches: ['advogado', 'escritório de advocacia'], includedType: 'lawyer', cnaes: ['6911701', '6911702', '6911703'] },
  { label: 'Contadores', icon: Building2, niches: ['contabilidade', 'contador'], includedType: 'accounting', cnaes: ['6920601', '6920602'] },
  { label: 'Pet Shops', icon: PawPrint, niches: ['pet shop', 'veterinário'], includedType: 'pet_store', cnaes: ['4789004', '7500100'] },
  { label: 'Dentistas', icon: Heart, niches: ['dentista', 'odontologia'], includedType: 'dentist', cnaes: ['8630506'] },
  { label: 'Hotéis', icon: Hotel, niches: ['hotel', 'pousada'], includedType: 'hotel', cnaes: ['5510801', '5510802', '5510803'] },
  { label: 'Farmácias', icon: Pill, niches: ['farmácia', 'drogaria'], includedType: 'pharmacy', cnaes: ['4771701', '4771702', '4771703'] },
  { label: 'Escolas', icon: GraduationCap, niches: ['escola', 'colégio'], includedType: 'school', cnaes: ['8511200', '8512100', '8513900'] },
  { label: 'Ag. Marketing', icon: Megaphone, niches: ['agência de marketing', 'marketing digital'], includedType: 'marketing_consultant', cnaes: ['7311400', '7312200', '6319400'] },
  { label: 'Seguradoras', icon: ShieldCheck, niches: ['seguradora', 'seguros'], includedType: 'insurance_agency', cnaes: ['6622300', '6621501', '6621502'] },
  { label: 'Coworkings', icon: Laptop, niches: ['coworking', 'escritório compartilhado'], includedType: 'coworking_space', cnaes: ['8211300'] },
  { label: 'Ag. Viagens', icon: Plane, niches: ['agência de viagens', 'turismo'], includedType: 'travel_agency', cnaes: ['7911200', '7912100'] },
  { label: 'Construtoras', icon: HardHat, niches: ['construtora', 'construção civil'], cnaes: ['4120400', '4110700'] },
  { label: 'Cafeterias', icon: Coffee, niches: ['cafeteria', 'padaria', 'café'], includedType: 'cafe', cnaes: ['5611203', '1091101', '1091102'] },
  { label: 'Óticas', icon: Eye, niches: ['ótica', 'óculos'], cnaes: ['4774100'] },
  { label: 'Lava-rápido', icon: Car, niches: ['lava-rápido', 'lavagem automotiva'], includedType: 'car_wash', cnaes: ['4520005'] },
  { label: 'Pizzarias', icon: Pizza, niches: ['pizzaria'], includedType: 'pizza_restaurant', cnaes: ['5611201'] },
  { label: 'Autoescolas', icon: BookOpen, niches: ['autoescola', 'centro de formação de condutores'], cnaes: ['8599604'] },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DashboardIndex() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useOutletContext<{ user: SessionUser }>();
  const { addToast } = useToast();
  const { setLastSearchResults } = useSearchResults();

  const [form, setForm] = useState<SearchFormValues>(DEFAULT_SEARCH_VALUES);
  const [loading, setLoading] = useState(false);
  const [advancedTermError, setAdvancedTermError] = useState<string | null>(null);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [showUpgradeCTA, setShowUpgradeCTA] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([]);

  // Pre-fill form from URL params (e.g. from "Rebuscar" in history)
  useEffect(() => {
    const q = searchParams.get('q');
    if (!q) return;
    setForm((prev) => ({
      ...prev,
      advancedTerm: q,
      country: searchParams.get('country') || prev.country,
      state: searchParams.get('state') || prev.state,
      city: searchParams.get('city') || prev.city,
      includedType: searchParams.get('type') || prev.includedType,
      radiusKm: searchParams.get('radius') ? Number(searchParams.get('radius')) : prev.radiusKm,
    }));
    // Clear URL params after applying
    setSearchParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    leadsApi.stats().then(setStats).catch(() => {/* silently ignore */});
    searchApi.history({ limit: 3 }).then((r) => setRecentSearches(r.items ?? [])).catch(() => {});
  }, []);

  const locationValue: LocationFormValues = useMemo(
    () => ({
      country: form.country,
      state: form.state,
      city: form.city ?? '',
      radiusKm: form.radiusKm,
    }),
    [form.country, form.state, form.city, form.radiusKm]
  );

  const intelligenceValue: IntelligenceFormValues = useMemo(
    () => ({
      niches: form.niches,
      includedType: form.includedType,
      advancedTerm: form.advancedTerm ?? '',
    }),
    [form.niches, form.includedType, form.advancedTerm]
  );

  const updateLocation = useCallback((v: Partial<LocationFormValues>) => {
    setForm((prev) => ({
      ...prev,
      ...v,
      city: v.city !== undefined ? v.city : prev.city,
    }));
  }, []);

  const updateIntelligence = useCallback((v: Partial<IntelligenceFormValues>) => {
    setForm((prev) => ({ ...prev, ...v }));
    if (v.advancedTerm !== undefined) {
      const t = v.advancedTerm.trim();
      setAdvancedTermError(
        t.length > 0 && t.length < MIN_ADVANCED_TERM
          ? `Mínimo ${MIN_ADVANCED_TERM} caracteres`
          : null
      );
    }
  }, []);

  const payload = useMemo(
    () => ({
      textQuery: '',
      country: getCountryLabel(form.country),
      countryCode: form.country,
      state: form.state,
      city: form.city ?? '',
      radiusKm: form.radiusKm,
      includedType: form.includedType,
      niches: form.niches,
      advancedTerm: form.advancedTerm ?? '',
      hasWebsite: form.hasWebsite,
      hasPhone: form.hasPhone,
      cnae: form.cnae,
      cnaeDescricao: form.cnaeDescricao,
      cnaes: form.cnaes,
    }),
    [form]
  );

  const validation = useMemo(() => validateSearchPayload(payload), [payload]);
  const canSearch = validation.ok;

  const runSearch = useCallback(async () => {
    if (!validation.ok) {
      addToast('error', validation.message);
      return;
    }
    if ((form.advancedTerm?.trim().length ?? 0) > 0 && (form.advancedTerm?.trim().length ?? 0) < MIN_ADVANCED_TERM) {
      addToast('error', `Termo avançado deve ter no mínimo ${MIN_ADVANCED_TERM} caracteres.`);
      return;
    }
    setLoading(true);
    try {
      const result = await startSearch(payload);
      const textQuery = buildTextQuery(payload);
      setLastSearchResults({
        places: result.places ?? [],
        nextPageToken: result.nextPageToken,
        params: {
          textQuery,
          includedType: payload.includedType?.trim() || undefined,
          city: payload.city?.trim() || undefined,
          state: payload.state?.trim() || undefined,
          radiusKm: payload.radiusKm,
          hasWebsite: payload.hasWebsite !== 'any' ? payload.hasWebsite : undefined,
          hasPhone: payload.hasPhone !== 'any' ? payload.hasPhone : undefined,
        },
      });
      window.dispatchEvent(new Event('refresh-user'));
      addToast('success', `${result.places.length} resultado(s) encontrado(s).`);
      navigate('/dashboard/resultados');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao buscar';
      if (message.toLowerCase().includes('limit')) {
        window.dispatchEvent(new Event('refresh-user'));
        setShowUpgradeCTA(true);
      } else {
        addToast('error', message);
        navigate('/dashboard/resultados', { state: { error: message } });
      }
    } finally {
      setLoading(false);
    }
  }, [payload, validation, form.advancedTerm, addToast, navigate, setLastSearchResults]);

  const goToHistorico = useCallback(() => navigate('/dashboard/historico'), [navigate]);

  const applyTemplate = useCallback((tpl: typeof QUICK_TEMPLATES[number]) => {
    setForm((prev) => ({
      ...prev,
      niches: tpl.niches,
      includedType: tpl.includedType,
      cnaes: tpl.cnaes ?? [],
      // Keep single cnae for backward compat (first code)
      cnae: tpl.cnaes?.[0],
      cnaeDescricao: tpl.cnaes?.length ? tpl.label : undefined,
    }));
  }, []);

  const firstName = user.name?.split(' ')[0] ?? 'Usuário';
  const remainingCredits = user.leadsLimit - user.leadsUsed;

  return (
    <>
      <HeaderDashboard
        title={`${getGreeting()}, ${firstName}!`}
        subtitle="O que vamos prospectar hoje?"
        breadcrumb="Prospecção Ativa / Nova Busca"
        onHistórico={goToHistorico}
        onIniciarBusca={runSearch}
        searchLoading={loading}
        primaryDisabled={!canSearch}
      />

      <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6" role="search"
        onKeyDown={(e) => { if (e.key === 'Enter' && canSearch && !loading) { e.preventDefault(); runSearch(); } }}
      >
        {/* Metrics */}
        {stats && (stats.total > 0 || stats.searchesThisMonth > 0) && (
          <section aria-label="Resumo da conta" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Leads salvos', value: stats.total, icon: Target, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
              { label: 'Score alto (≥60)', value: stats.highScore, icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
              { label: 'Favoritos', value: stats.favorites, icon: Star, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
              { label: 'Buscas este mês', value: stats.searchesThisMonth, icon: SearchIcon, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className={`rounded-2xl border ${bg} p-4 flex items-center gap-3`}>
                <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0`}>
                  <Icon size={18} className={color} />
                </div>
                <div>
                  <p className="text-xl font-black text-foreground tabular-nums">{value}</p>
                  <p className="text-[11px] text-muted leading-tight">{label}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Quick Templates */}
        <section aria-label="Templates rápidos" data-tour="quick-templates">
          <p className="text-xs text-muted mb-2 font-medium">Busca rápida:</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin sm:flex-wrap sm:overflow-visible sm:pb-0">
            {QUICK_TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              const isActive = tpl.includedType ? form.includedType === tpl.includedType : form.niches.length > 0 && tpl.niches.every((n) => form.niches.includes(n));
              return (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors shrink-0',
                    isActive
                      ? 'bg-violet-600/15 border-violet-500/40 text-violet-600 dark:text-violet-400'
                      : 'border-border bg-surface hover:bg-violet-600/10 hover:border-violet-500/30 text-foreground'
                  )}
                >
                  <Icon size={14} className={isActive ? 'text-violet-600 dark:text-violet-400' : 'text-violet-500'} aria-hidden />
                  {tpl.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Recent searches */}
        {recentSearches.length > 0 && (
          <section aria-label="Buscas recentes">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted font-medium flex items-center gap-1.5">
                <Clock size={12} className="text-muted" />
                Buscas recentes
              </p>
              <Link to="/dashboard/historico" className="text-[10px] text-violet-500 hover:text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-1 transition-colors">
                Ver tudo <ArrowRight size={10} />
              </Link>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {recentSearches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      advancedTerm: s.textQuery,
                      city: s.city ?? prev.city,
                      state: s.state ?? prev.state,
                      includedType: (s.filters as Record<string, string> | undefined)?.includedType || prev.includedType,
                    }));
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface/50 hover:bg-violet-600/10 hover:border-violet-500/30 transition-colors shrink-0 max-w-[240px]"
                  title={s.textQuery}
                >
                  <SearchIcon size={12} className="text-muted shrink-0" />
                  <span className="text-xs text-foreground truncate">{s.textQuery}</span>
                  <span className="text-[10px] text-muted tabular-nums shrink-0">{s.resultsCount}r</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Linha 1 – Filtros primários */}
        <section className="pb-4 border-b border-border" aria-label="Filtros de localização" data-tour="nova-busca">
          <SearchFiltersRow value={locationValue} onChange={updateLocation} disabled={loading} />
        </section>

        {/* Linha 2 – Segmentação */}
        <section className="pb-4 border-b border-border" aria-label="Segmentação e volume">
          <SearchSegmentRow
            value={intelligenceValue}
            onChange={updateIntelligence}
            disabled={loading}
            advancedTermError={advancedTermError ?? undefined}
          />
        </section>

        {/* Linha 2.5 – Filtro CNAE (atividade econômica) */}
        {form.country === 'BR' && (
          <section className="pb-4 border-b border-border" aria-label="Filtro por CNAE">
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={14} className="text-violet-500 shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Atividade Econômica (CNAE)</span>
              <span className="text-[10px] text-muted/60 italic">Dados da Receita Federal</span>
            </div>
            <CnaeAutocomplete
              values={form.cnaes ?? []}
              onChange={(codes, desc) => setForm((prev) => ({ ...prev, cnaes: codes, cnae: codes[0], cnaeDescricao: desc }))}
              disabled={loading}
            />
          </section>
        )}

        {/* Linha 3 – Filtros de resultado */}
        <section className="pb-4 border-b border-border" aria-label="Filtros de resultado">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-violet-500 shrink-0" aria-hidden />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Website:</span>
              {(['any', 'yes', 'no'] as const).map((opt) => (
                <button
                  key={`web-${opt}`}
                  type="button"
                  disabled={loading}
                  onClick={() => setForm((prev) => ({ ...prev, hasWebsite: opt }))}
                  className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
                    form.hasWebsite === opt
                      ? 'bg-violet-600 text-white'
                      : 'bg-surface border border-border text-muted hover:border-violet-500/30 hover:text-foreground'
                  }`}
                >
                  {opt === 'any' ? 'Todos' : opt === 'yes' ? 'Com site' : 'Sem site'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-violet-500 shrink-0" aria-hidden />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Telefone:</span>
              {(['any', 'yes', 'no'] as const).map((opt) => (
                <button
                  key={`phone-${opt}`}
                  type="button"
                  disabled={loading}
                  onClick={() => setForm((prev) => ({ ...prev, hasPhone: opt }))}
                  className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
                    form.hasPhone === opt
                      ? 'bg-violet-600 text-white'
                      : 'bg-surface border border-border text-muted hover:border-violet-500/30 hover:text-foreground'
                  }`}
                >
                  {opt === 'any' ? 'Todos' : opt === 'yes' ? 'Com tel.' : 'Sem tel.'}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Linha 3 – Ação principal */}
        <section className="flex flex-col items-center gap-2 pt-2" aria-label="Iniciar prospecção">
          <Button
            variant="primary"
            size="lg"
            className="min-w-[240px] h-12 px-8 text-base font-bold shadow-lg shadow-violet-600/25"
            icon={
              loading ? (
                <Loader2 size={20} className="animate-spin" aria-hidden />
              ) : (
                <Zap size={20} aria-hidden />
              )
            }
            onClick={runSearch}
            disabled={!canSearch || loading}
            aria-label={loading ? 'Buscando...' : 'Iniciar Prospecção'}
          >
            {loading ? 'Buscando...' : 'Iniciar Prospecção'}
          </Button>
          <span className="flex items-center gap-1 text-xs text-muted">
            <Sparkles size={12} className="text-violet-500" />
            <span className="tabular-nums font-medium text-violet-500">{remainingCredits}</span>
            créditos restantes
          </span>
        </section>
      </div>

      {showUpgradeCTA && (
        <UpgradeCTAModal
          currentPlan={user.plan}
          leadsUsed={user.leadsUsed}
          leadsLimit={user.leadsLimit}
          onClose={() => setShowUpgradeCTA(false)}
        />
      )}
    </>
  );
}
